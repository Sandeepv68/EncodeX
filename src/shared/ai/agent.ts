/**
 * @fileoverview Library-wide agent planner (roadmap 2.0, R6 — F20).
 *
 * The "agent loop" is deliberately split so it stays reviewable and safe: the
 * model chooses a goal (an intent string) and supplies constraints, this module
 * deterministically plans one `convert_media` action per file (reusing the same
 * rules that power `recommend_settings`), and the resulting {@link Workflow} is
 * committed through the R5 execution gate. Nothing here calls a model or the
 * filesystem (§7.3); it composes the deterministic planner and estimator so the
 * whole pipeline is unit-testable.
 */

import type { ConversionProfile, EncoderCapabilities } from '../types';
import type { ConversionConstraints, MediaFacts } from './types';
import type { Workflow, WorkflowStep } from './workflow';
import { recommendSettings } from './recommend';
import { estimateConversion } from './estimate';
import type { EstimateConversionInput } from './estimate';

/**
 * One planned conversion the agent would run.
 * @interface AgentAction
 * @property {string} id - Workflow step id for this action.
 * @property {string} input - Source file path.
 * @property {string} [output] - Explicit output path, when one was derived.
 * @property {string} [profileId] - Built-in profile the settings came from.
 * @property {number} confidence - Planner confidence in `[0, 1]`.
 * @property {string[]} rationale - Why this action was planned.
 * @property {number} [estimatedSizeBytes] - Estimated output size.
 * @property {number} estimatedSavings - Estimated size change as a fraction.
 */
export interface AgentAction {
  id: string;
  input: string;
  output?: string;
  profileId?: string;
  confidence: number;
  rationale: string[];
  estimatedSizeBytes?: number;
  estimatedSavings: number;
}

/**
 * A file the agent deliberately did not plan, with the reason.
 * @interface AgentSkip
 * @property {string} input - Source file path.
 * @property {string} reason - Why it was skipped.
 */
export interface AgentSkip {
  input: string;
  reason: string;
}

/**
 * Tuning for {@link planAgent}.
 * @interface AgentOptions
 * @property {number} [maxFiles] - Upper bound on planned actions (default 50).
 * @property {number} [minSavings] - Minimum estimated size reduction (fraction
 *   in `[0, 1]`) required to keep an action; only applied when the plan carries
 *   an explicit target bitrate (a CRF-only plan cannot be sized honestly).
 */
export interface AgentOptions {
  maxFiles?: number;
  minSavings?: number;
}

/**
 * The agent planning request: a goal plus grounded facts for every file.
 * @interface AgentRequest
 * @property {string} intent - The natural-language goal shared by every file.
 * @property {MediaFacts[]} files - Structured facts for the candidate files.
 * @property {ConversionProfile[]} profiles - Built-in profiles to choose from.
 * @property {EncoderCapabilities} capabilities - Detected encoder capabilities.
 * @property {ConversionConstraints} [constraints] - Optional hard constraints.
 * @property {AgentOptions} [options] - Tuning.
 * @property {(facts: MediaFacts, index: number) => string} [resolveOutput] -
 *   Supplies each action's output path (the MCP layer derives these).
 */
export interface AgentRequest {
  intent: string;
  files: MediaFacts[];
  profiles: ConversionProfile[];
  capabilities: EncoderCapabilities;
  constraints?: ConversionConstraints;
  options?: AgentOptions;
  resolveOutput?: (facts: MediaFacts, index: number) => string;
}

/**
 * The planned agent run: the actions, the skips, and a runnable workflow.
 * @interface AgentPlan
 * @property {string} goal - The intent the plan was built for.
 * @property {AgentAction[]} actions - Planned conversions, in file order.
 * @property {AgentSkip[]} skips - Files left out, with reasons.
 * @property {Workflow} workflow - A validated, runnable workflow of the actions.
 * @property {string[]} rationale - Plan-level reasons, one per line.
 * @property {string[]} notes - Caveats for the caller.
 * @property {true} isEstimated - The plan is a proposal, not a measurement.
 */
export interface AgentPlan {
  goal: string;
  actions: AgentAction[];
  skips: AgentSkip[];
  workflow: Workflow;
  rationale: string[];
  notes: string[];
  isEstimated: true;
}

/** Default cap on planned actions. */
const DEFAULT_MAX_FILES = 50;

/** A stable, valid workflow step id for an action index. */
function actionId(index: number): string {
  return `convert_${index}`;
}

/**
 * Whether a plan's arguments carry an explicit target bitrate, which is required
 * for an honest size-reduction estimate (CRF plans fall back to the source rate).
 * @param {Record<string, unknown>} args - The planned conversion arguments.
 * @returns {boolean} True when a target video bitrate is present.
 */
function hasTargetBitrate(args: Record<string, unknown>): boolean {
  return typeof args.videoBitrate === 'string' && args.videoBitrate.trim().length > 0;
}

/**
 * Plans one file, or reports why it was skipped. Returns the workflow-step
 * arguments alongside the action so the caller does not re-run the planner.
 * @param {MediaFacts} facts - The file's facts.
 * @param {AgentRequest} request - The overall request.
 * @param {number} index - The action index (for ids and output naming).
 * @param {number} minSavings - Minimum required size reduction.
 * @returns {{ action: AgentAction; args: Record<string, unknown> } | { skip: AgentSkip }} The outcome.
 */
function planFile(
  facts: MediaFacts,
  request: AgentRequest,
  index: number,
  minSavings: number,
): { action: AgentAction; args: Record<string, unknown> } | { skip: AgentSkip } {
  const settings = recommendSettings({
    input: facts.file,
    intent: request.intent,
    facts,
    profiles: request.profiles,
    capabilities: request.capabilities,
    ...(request.constraints ? { constraints: request.constraints } : {}),
  });
  if (!settings.profileId) {
    return { skip: { input: facts.file, reason: 'No built-in profile matched the goal for this file.' } };
  }

  const args: Record<string, unknown> = { ...settings.args };
  const estimate = estimateConversion(args as EstimateConversionInput, facts, request.capabilities);
  const estimatedSavings = facts.sizeBytes > 0 ? Number((1 - estimate.estimatedSizeBytes / facts.sizeBytes).toFixed(4)) : 0;
  if (minSavings > 0 && hasTargetBitrate(args) && estimatedSavings < minSavings) {
    return {
      skip: {
        input: facts.file,
        reason: `Estimated saving of ${(estimatedSavings * 100).toFixed(0)}% is below the ${(minSavings * 100).toFixed(0)}% threshold.`,
      },
    };
  }

  const action: AgentAction = {
    id: actionId(index),
    input: facts.file,
    ...(settings.profileId ? { profileId: settings.profileId } : {}),
    confidence: settings.confidence,
    rationale: settings.rationale,
    estimatedSizeBytes: estimate.estimatedSizeBytes,
    estimatedSavings,
  };
  if (request.resolveOutput) {
    action.output = request.resolveOutput(facts, index);
    args.output = action.output;
  }
  return { action, args };
}

/**
 * Plans a library-wide run: one `convert_media` action per file that has a
 * matching profile (and passes the optional savings gate), collected into a
 * workflow. Files are planned in the order given; the workflow has no
 * inter-step dependencies, so the R5 executor can run them independently.
 * @param {AgentRequest} request - Goal, facts, profiles and capabilities.
 * @returns {AgentPlan} The actions, skips, and runnable workflow.
 */
export function planAgent(request: AgentRequest): AgentPlan {
  const maxFiles = Math.max(1, request.options?.maxFiles ?? DEFAULT_MAX_FILES);
  const minSavings = Math.max(0, Math.min(1, request.options?.minSavings ?? 0));
  const files = Array.isArray(request.files) ? request.files : [];
  const notes: string[] = [];
  const actions: AgentAction[] = [];
  const skips: AgentSkip[] = [];
  const steps: WorkflowStep[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const facts = files[index];
    if (!facts?.file) {
      skips.push({ input: String(facts?.file ?? ''), reason: 'The file has no path.' });
      continue;
    }
    if (actions.length >= maxFiles) {
      notes.push(`Stopped after ${maxFiles} actions (the maxFiles cap).`);
      break;
    }
    const outcome = planFile(facts, request, actions.length, minSavings);
    if ('skip' in outcome) {
      skips.push(outcome.skip);
      continue;
    }
    actions.push(outcome.action);
    steps.push({ id: outcome.action.id, tool: 'convert_media', args: outcome.args });
  }

  if (files.length === 0) notes.push('No files were provided to the agent.');
  notes.push('Estimated savings are approximations from target bitrates, not measured output sizes.');

  const rationale = actions.length
    ? [`Planned ${actions.length} conversion(s) toward "${request.intent}".`, ...summarizeSavings(actions)]
    : ['No files could be planned for this goal.'];
  return {
    goal: request.intent,
    actions,
    skips,
    workflow: { steps },
    rationale,
    notes,
    isEstimated: true,
  };
}

/** One-line size-savings summary across the planned actions. */
function summarizeSavings(actions: AgentAction[]): string[] {
  const savers = actions.filter((action) => action.estimatedSavings > 0);
  if (savers.length === 0) return [];
  const average = savers.reduce((total, action) => total + action.estimatedSavings, 0) / savers.length;
  return [
    `${savers.length} of ${actions.length} action(s) are estimated to shrink the file by ~${(average * 100).toFixed(0)}% on average.`,
  ];
}
