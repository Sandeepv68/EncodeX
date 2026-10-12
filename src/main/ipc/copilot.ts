/**
 * @fileoverview IPC handler for the desktop Copilot panel (roadmap 7.4, R6).
 *
 * The renderer asks main to plan a natural-language goal against a folder of
 * media; this handler scans the inputs, probes every media file, plans one
 * conversion per file with the deterministic agent (F20), and returns the plan
 * plus the ready-to-enqueue `ConversionOptions` for each action. Committing the
 * work stays in the existing Batch Queue — the panel only proposes.
 *
 * The whole pipeline is deterministic (§7.3): no model call happens here; the
 * "rules" provider and the arithmetic it composes are code and unit-tested.
 */

import { ipcMain } from 'electron';
import { readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { createTranscoder } from '../transcoders/factory';
import { getEncoderCapabilities } from '../capabilities';
import { BUILTIN_PROFILES } from '../../shared/profiles/builtin';
import { extractMediaFacts, planAgent, planWorkflow } from '../../shared/ai';
import type { MediaFacts } from '../../shared/ai/types';
import type { EncoderCapabilities, MediaInfo } from '../../shared/types';
import { buildConversionOptions, resolveOutputPath } from '../../mcp/conversion-options';
import type { MCPConversionFields } from '../../mcp/conversion-options';
import type { CopilotPlan, CopilotPlanRequest, CopilotAction } from '../../shared/copilot';
import { createError, formatError, ErrorCode } from '../../shared/errors';
import { LOG_COPILOT_PLAN_CALLED, LOG_COPILOT_PLAN_COMPLETED, LOG_COPILOT_PLAN_FAILED } from '../../shared/log-constants';

const log = new Logger('main/ipc/copilot');

/**
 * Default and upper bound on planned actions, mirroring the MCP `plan_agent`
 * tool so both surfaces budget the same amount of work.
 * @const {number} COPILOT_MAX_FILES
 */
const COPILOT_MAX_FILES = 50;

/** Empty capability set so a failed probe still yields a deterministic plan. */
const EMPTY_CAPABILITIES: EncoderCapabilities = { videoEncoders: [], audioEncoders: [], hwaccels: [] };

/**
 * Media file extensions the Copilot scan accepts, mirroring the MCP folder
 * analysis so both surfaces agree on what counts as a candidate.
 * @const {Set<string>} MEDIA_EXTENSIONS
 */
const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mkv',
  'mov',
  'avi',
  'webm',
  'flv',
  'wmv',
  'mpg',
  'mpeg',
  'ts',
  'm2ts',
  'mp3',
  'aac',
  'm4a',
  'flac',
  'wav',
  'ogg',
  'opus',
  'wma',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'heic',
]);

/**
 * Whether a path looks like a media file by extension.
 * @param {string} file - The candidate file path.
 * @returns {boolean} True when the extension is in {@link MEDIA_EXTENSIONS}.
 */
function isMediaPath(file: string): boolean {
  return MEDIA_EXTENSIONS.has(extname(file).slice(1).toLowerCase());
}

/**
 * Expands a mixed list of files and folders into sorted, unique media paths.
 * Unreadable entries are skipped and recursion is bounded by `max`.
 * @param {string[]} inputs - Raw input paths.
 * @param {boolean} recursive - Whether to descend into subdirectories.
 * @param {number} max - Maximum number of files to return.
 * @returns {string[]} Sorted, unique media paths.
 */
function scanMedia(inputs: string[], recursive: boolean, max: number): string[] {
  const collected = new Set<string>();
  const visit = (candidate: string): void => {
    if (collected.size >= max) return;
    let stat;
    try {
      stat = statSync(candidate);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      let entries: string[];
      try {
        entries = readdirSync(candidate);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (collected.size >= max) return;
        const child = join(candidate, entry);
        let childStat;
        try {
          childStat = statSync(child);
        } catch {
          continue;
        }
        if (childStat.isDirectory()) {
          if (recursive) visit(child);
        } else if (isMediaPath(child)) {
          collected.add(child);
        }
      }
    } else if (isMediaPath(candidate)) {
      collected.add(candidate);
    }
  };
  for (const input of inputs) visit(input);
  return [...collected].sort();
}

/**
 * Derives a non-colliding output path for a planned conversion: the input stem
 * suffixed with `_optimized`, numbering any further actions to the same stem.
 * @param {string} input - The source file path.
 * @param {number} index - The action index.
 * @returns {string} The output file path.
 */
function optimizedOutput(input: string, index: number): string {
  const ext = extname(input);
  const stem = ext ? input.slice(0, -ext.length) : input;
  return index === 0 ? `${stem}_optimized${ext}` : `${stem}_optimized_${index + 1}${ext}`;
}

/**
 * Registers the Copilot planning IPC handler.
 * @returns {void} Nothing is returned.
 */
export function registerCopilotHandlers(): void {
  ipcMain.handle(IPC.COPILOT_PLAN, async (_event, request: CopilotPlanRequest): Promise<CopilotPlan> => {
    log.info(LOG_COPILOT_PLAN_CALLED);
    try {
      const goal = typeof request?.goal === 'string' ? request.goal.trim() : '';
      const inputs = Array.isArray(request?.inputs) ? request.inputs.filter((input) => typeof input === 'string' && input.length > 0) : [];
      const recursive = request?.recursive === true;
      const maxFiles = Math.max(1, Math.min(COPILOT_MAX_FILES, Number(request?.maxFiles) || COPILOT_MAX_FILES));

      if (!goal) throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'A goal is required to build a Copilot plan.');
      if (inputs.length === 0)
        throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'At least one file or folder is required to build a Copilot plan.');

      const files = scanMedia(inputs, recursive, maxFiles);
      if (files.length === 0) throw createError(ErrorCode.FILE_NOT_FOUND, 'No media files matched the given inputs.');

      const transcoder = createTranscoder('FFMPEG');
      const facts: MediaFacts[] = [];
      for (const file of files) {
        try {
          const info: MediaInfo = await transcoder.getInfo(file);
          facts.push(extractMediaFacts(info));
        } catch {
          // One unreadable file must not fail the whole plan; it is omitted.
        }
      }
      if (facts.length === 0) throw createError(ErrorCode.PROBE_FAILED, 'None of the matched media files could be read.');

      const agentPlan = planAgent({
        intent: goal,
        files: facts,
        profiles: BUILTIN_PROFILES,
        capabilities: getEncoderCapabilities() ?? EMPTY_CAPABILITIES,
        ...(request?.minSavings !== undefined ? { options: { maxFiles, minSavings: request.minSavings } } : { options: { maxFiles } }),
        resolveOutput: (fact, index) => optimizedOutput(fact.file, index),
      });

      const stepsById = new Map(agentPlan.workflow.steps.map((step) => [step.id, step.args]));
      const actions: CopilotAction[] = [];
      const dropped: string[] = [];
      for (const action of agentPlan.actions) {
        try {
          const args = (stepsById.get(action.id) ?? {}) as MCPConversionFields;
          const fields: MCPConversionFields = { ...args, output: action.output };
          const options = buildConversionOptions(fields);
          const output = action.output ?? resolveOutputPath(action.input, fields, options);
          actions.push({ ...action, output, options });
        } catch {
          dropped.push(action.input);
        }
      }
      if (dropped.length > 0) {
        const extra = dropped.map((input) => ({ input, reason: 'The planned settings could not be turned into conversion options.' }));
        agentPlan.skips.push(...extra);
      }

      const plan = planWorkflow(agentPlan.workflow);
      log.info(LOG_COPILOT_PLAN_COMPLETED, goal, actions.length, 'actions,', agentPlan.skips.length, 'skips');
      return {
        goal: agentPlan.goal,
        actions,
        skips: agentPlan.skips,
        rationale: agentPlan.rationale,
        notes: agentPlan.notes,
        plan,
        isEstimated: true,
      };
    } catch (err) {
      log.error(LOG_COPILOT_PLAN_FAILED, err);
      throw formatError(err);
    }
  });
}
