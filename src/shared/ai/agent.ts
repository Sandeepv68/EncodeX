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
import type {
  AgentAction,
  AgentPlan,
  AgentRequest,
  AgentSkip,
  ConversionConstraints,
  EstimateConversionInput,
  MediaFacts,
  PlanRequest,
  RecommendedSettings,
  Workflow,
  WorkflowStep,
} from './types';
import { recommendSettings } from './recommend';
import { estimateConversion } from './estimate';

export type { AgentAction, AgentPlan, AgentRequest, AgentSkip };
export type { AgentOptions } from './types';

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
 * @returns {Promise<{ action: AgentAction; args: Record<string, unknown> } | { skip: AgentSkip }>} The outcome.
 */
async function planFile(
  facts: MediaFacts,
  request: AgentRequest,
  index: number,
  minSavings: number,
): Promise<{ action: AgentAction; args: Record<string, unknown> } | { skip: AgentSkip }> {
  const planRequest: PlanRequest = {
    input: facts.file,
    intent: request.intent,
    facts,
    profiles: request.profiles,
    capabilities: request.capabilities,
    ...(request.constraints ? { constraints: request.constraints } : {}),
  };
  const settings = request.planner ? await request.planner(planRequest) : recommendSettings(planRequest);
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
 * @returns {Promise<AgentPlan>} The actions, skips, and runnable workflow.
 */
export async function planAgent(request: AgentRequest): Promise<AgentPlan> {
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
    const outcome = await planFile(facts, request, actions.length, minSavings);
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
