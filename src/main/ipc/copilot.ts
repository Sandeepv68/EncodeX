/**
 * @fileoverview IPC handler for the desktop Copilot panel (roadmap 7.4, R6;
 * AI connector plan §7.2).
 *
 * The renderer asks main to plan a natural-language goal against media files
 * and/or folders. This handler scans the inputs, probes every media file, routes
 * the goal to one EncodeX operation (deterministically, or via a configured AI
 * provider), and returns the plan: ready-to-enqueue `ConversionOptions` for
 * queue-backed operations, read-only findings for `analyze`, plus skips and
 * rationale. Committing the work stays in the existing Batch Queue — the panel
 * only proposes.
 *
 * The op builders are the same ones the MCP tools use, so a Copilot job, an MCP
 * call and a CLI command produce identical output.
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
import type { EncoderCapabilities, MediaInfo } from '../../shared/types';
import { buildConversionOptions, resolveOutputPath } from '../../mcp/conversion-options';
import type { MCPConversionFields } from '../../mcp/conversion-options';
import type { CopilotAction, CopilotPlan, CopilotPlanRequest } from '../../shared/copilot';
import { createError, formatError, ErrorCode } from '../../shared/errors';
import { routeOperationDeterministic, buildOperationActions } from '../ai/operation-router';
import type { ProbedEntry } from '../ai/operation-router';
import { buildIntelligenceResults, isIntelligenceOperation } from '../ai/intelligence';
import { resolveLLMOperationRouter } from '../ai/provider-registry';
import type { RoutedOperation } from '../../shared/ai/llm';
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
 * Chooses the operation for a goal: an explicit choice wins, otherwise a
 * configured AI provider is consulted and the deterministic router is the
 * fallback.
 * @param {string} goal - The natural-language goal.
 * @param {import('../../shared/copilot').CopilotOperation | null} forced - Explicit operation, or null.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {EncoderCapabilities} capabilities - Detected encoders.
 * @param {string} inputExt - Input extension for container defaults.
 * @returns {Promise<RoutedOperation>} The routed operation.
 */
async function routeOperation(
  goal: string,
  forced: import('../../shared/copilot').CopilotOperation | null,
  entries: ProbedEntry[],
  capabilities: EncoderCapabilities,
  inputExt: string,
): Promise<RoutedOperation> {
  if (forced) return routeOperationDeterministic({ goal, operation: forced, inputExt });
  const router = resolveLLMOperationRouter();
  if (router) {
    const routed = await router({
      goal,
      operation: null,
      files: entries.map((entry) => entry.facts),
      profiles: BUILTIN_PROFILES,
      capabilities,
    });
    if (routed) return routed;
  }
  return routeOperationDeterministic({ goal, operation: null, inputExt });
}

/**
 * Builds the convert operation's actions via the deterministic agent, turning
 * each planned workflow step into a queue-ready {@link CopilotAction}.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {string} goal - The goal text.
 * @param {number} maxFiles - Action cap.
 * @param {number | undefined} minSavings - Minimum estimated savings.
 * @param {EncoderCapabilities} capabilities - Detected encoders.
 * @returns {Promise<{ actions: CopilotAction[]; skips: import('../../shared/ai/agent').AgentSkip[]; rationale: string[]; notes: string[]; plan: import('../../shared/ai/workflow').WorkflowPlan }>} The convert plan.
 */
async function buildConvertPlan(
  entries: ProbedEntry[],
  goal: string,
  maxFiles: number,
  minSavings: number | undefined,
  capabilities: EncoderCapabilities,
) {
  const facts = entries.map((entry) => entry.facts);
  const agentPlan = await planAgent({
    intent: goal,
    files: facts,
    profiles: BUILTIN_PROFILES,
    capabilities,
    ...(minSavings !== undefined ? { options: { maxFiles, minSavings } } : { options: { maxFiles } }),
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
      actions.push({ ...action, operation: 'convert', output, options });
    } catch {
      dropped.push(action.input);
    }
  }
  for (const input of dropped) {
    agentPlan.skips.push({ input, reason: 'The planned settings could not be turned into conversion options.' });
  }

  return {
    actions,
    skips: agentPlan.skips,
    rationale: agentPlan.rationale,
    notes: agentPlan.notes,
    plan: planWorkflow(agentPlan.workflow),
  };
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
      const forced = request?.operation && request.operation !== 'auto' ? request.operation : null;

      if (!goal) throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'A goal is required to build a Copilot plan.');
      if (inputs.length === 0)
        throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'At least one file or folder is required to build a Copilot plan.');

      const files = scanMedia(inputs, recursive, maxFiles);
      if (files.length === 0) throw createError(ErrorCode.FILE_NOT_FOUND, 'No media files matched the given inputs.');

      const transcoder = createTranscoder('FFMPEG');
      const entries: ProbedEntry[] = [];
      for (const file of files) {
        try {
          const info: MediaInfo = await transcoder.getInfo(file);
          entries.push({ file, facts: extractMediaFacts(info), info });
        } catch {
          // One unreadable file must not fail the whole plan; it is omitted.
        }
      }
      if (entries.length === 0) throw createError(ErrorCode.PROBE_FAILED, 'None of the matched media files could be read.');

      const capabilities = getEncoderCapabilities() ?? EMPTY_CAPABILITIES;
      const inputExt = extname(entries[0].file).slice(1).toLowerCase() || 'mp4';
      const routed = await routeOperation(goal, forced, entries, capabilities, inputExt);
      if (typeof request?.query === 'string' && request.query.trim()) routed.fields.query = request.query.trim();
      if (typeof request?.targetLanguage === 'string' && request.targetLanguage.trim()) {
        routed.fields.targetLanguage = request.targetLanguage.trim();
      }

      if (routed.operation === 'convert') {
        const convert = await buildConvertPlan(entries, goal, maxFiles, request?.minSavings, capabilities);
        log.info(LOG_COPILOT_PLAN_COMPLETED, goal, convert.actions.length, 'convert actions,', convert.skips.length, 'skips');
        return {
          goal,
          operation: 'convert',
          actions: convert.actions,
          results: [],
          skips: convert.skips,
          rationale: [...routed.rationale, ...convert.rationale],
          notes: [...convert.notes, `Operation chosen by "${routed.providerId}".`],
          plan: convert.plan,
          providerId: routed.providerId,
          isEstimated: true,
        };
      }

      const built = isIntelligenceOperation(routed.operation)
        ? await buildIntelligenceResults(routed.operation, routed.fields, entries)
        : buildOperationActions(routed.operation, routed.fields, entries, routed.confidence, routed.rationale);
      const notes: string[] = [`Ran the "${routed.operation}" operation for ${entries.length} file(s).`];
      if (routed.operation === 'analyze') notes.push('Analysis results are read-only and were not added to the queue.');
      if (isIntelligenceOperation(routed.operation)) {
        notes.push('Media-intelligence results are read-only and were not added to the queue.');
      }
      notes.push(`Operation chosen by "${routed.providerId}".`);
      log.info(
        LOG_COPILOT_PLAN_COMPLETED,
        goal,
        built.actions.length,
        'actions,',
        built.results.length,
        'results,',
        built.skips.length,
        'skips',
      );
      return {
        goal,
        operation: routed.operation,
        actions: built.actions,
        results: built.results,
        skips: built.skips,
        rationale: routed.rationale,
        notes,
        plan: planWorkflow({ steps: [] }),
        providerId: routed.providerId,
        isEstimated: true,
      };
    } catch (err) {
      log.error(LOG_COPILOT_PLAN_FAILED, err);
      throw formatError(err);
    }
  });
}
