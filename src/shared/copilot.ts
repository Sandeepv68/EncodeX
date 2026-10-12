/**
 * @fileoverview Shared contract for the desktop Copilot panel (roadmap 7.4, R6).
 *
 * The renderer asks the main process to plan a goal against media files and/or
 * folders; main answers with the deterministic agent plan (F20) — or a plan
 * routed by an optional AI provider — plus the ready-to-run `ConversionOptions`
 * for each action. The renderer only *proposes*; committing the work reuses the
 * existing Batch Queue, so there is no second approval system.
 *
 * This module is pure types (imported by the renderer, preload and main), so it
 * must stay free of Electron and Node built-ins.
 */

import type { ConversionOptions } from './types';
import type { AgentAction, AgentSkip } from './ai/agent';
import type { WorkflowPlan } from './ai/workflow';
import type { AIProviderId } from './ai/types';

/**
 * The operation a Copilot plan performs. `convert` and the queue-backed
 * operations produce Batch Queue jobs; `analyze` and the media-intelligence
 * operations (`transcribe`, `summarize`, `chapters`, `search_transcript`,
 * `translate`, `find_similar`) are read-only and produce results instead.
 *
 * The queue-backed set mirrors `BATCH_OPERATIONS` plus the audio-extract and
 * cut operations the individual pages expose.
 * @typedef {('convert'|'remux'|'demux'|'extract_audio'|'compress_image'|'cut'|'analyze'|'transcribe'|'summarize'|'chapters'|'search_transcript'|'translate'|'find_similar')} CopilotOperation
 */
export type CopilotOperation =
  | 'convert'
  | 'remux'
  | 'demux'
  | 'extract_audio'
  | 'compress_image'
  | 'cut'
  | 'analyze'
  | 'transcribe'
  | 'summarize'
  | 'chapters'
  | 'search_transcript'
  | 'translate'
  | 'find_similar';

/**
 * The operations that can be committed to the Batch Queue as conversion jobs.
 * @const {readonly CopilotOperation[]} COPILOT_QUEUE_OPERATIONS
 */
export const COPILOT_QUEUE_OPERATIONS: readonly CopilotOperation[] = [
  'convert',
  'remux',
  'demux',
  'extract_audio',
  'compress_image',
  'cut',
] as const;

/**
 * The read-only media-intelligence operations. They transcribe and/or analyze
 * media and return findings; nothing is enqueued.
 * @const {readonly CopilotOperation[]} COPILOT_INTELLIGENCE_OPERATIONS
 */
export const COPILOT_INTELLIGENCE_OPERATIONS: readonly CopilotOperation[] = [
  'analyze',
  'transcribe',
  'summarize',
  'chapters',
  'search_transcript',
  'translate',
  'find_similar',
] as const;

/**
 * The operation selector value: a concrete operation, or `auto` to let the goal
 * text (and any configured AI provider) choose.
 * @typedef {('auto'|CopilotOperation)} CopilotOperationChoice
 */
export type CopilotOperationChoice = 'auto' | CopilotOperation;

/**
 * A Copilot planning request issued by the renderer.
 * @interface CopilotPlanRequest
 * @property {string} goal - The natural-language goal shared by every file.
 * @property {string[]} inputs - Files and/or folders to plan against.
 * @property {CopilotOperationChoice} [operation] - Force an operation, or `auto`.
 * @property {boolean} [recursive] - Descend into subfolders (default false).
 * @property {number} [maxFiles] - Upper bound on planned actions (default 50).
 * @property {number} [minSavings] - Minimum estimated size reduction to keep.
 * @property {string} [query] - Passage to find for `search_transcript`.
 * @property {string} [targetLanguage] - Target language for `translate`.
 */
export interface CopilotPlanRequest {
  goal: string;
  inputs: string[];
  operation?: CopilotOperationChoice;
  recursive?: boolean;
  maxFiles?: number;
  minSavings?: number;
  query?: string;
  targetLanguage?: string;
}

/**
 * A planned conversion action, carrying the ready-to-enqueue options.
 * @interface CopilotAction
 * @augments AgentAction
 * @property {CopilotOperation} operation - The operation this action performs.
 * @property {ConversionOptions} options - Options for the Batch Queue.
 */
export interface CopilotAction extends AgentAction {
  operation: CopilotOperation;
  options: ConversionOptions;
}

/**
 * A read-only finding produced by an `analyze`-style operation. It is rendered
 * for review and is never enqueued.
 * @interface CopilotResult
 * @property {CopilotOperation} operation - The operation that produced it.
 * @property {string} input - Source file the result describes.
 * @property {string} [title] - Short heading for the result.
 * @property {string} [summary] - One-line human summary.
 * @property {unknown} [content] - Structured payload (analysis, facts, ...).
 */
export interface CopilotResult {
  operation: CopilotOperation;
  input: string;
  title?: string;
  summary?: string;
  content?: unknown;
}

/**
 * The plan the Copilot panel renders: the agent's actions, skips and rationale,
 * plus the dry-run of the workflow the actions form.
 * @interface CopilotPlan
 * @property {string} goal - The goal the plan was built for.
 * @property {CopilotOperation | null} operation - The routed operation, if any.
 * @property {CopilotAction[]} actions - Planned conversions, in file order.
 * @property {CopilotResult[]} results - Read-only findings (analyze operations).
 * @property {AgentSkip[]} skips - Files left out, with reasons.
 * @property {string[]} rationale - Plan-level reasons, one per line.
 * @property {string[]} notes - Caveats for the caller.
 * @property {WorkflowPlan} plan - The dry-run validation of the workflow.
 * @property {AIProviderId} providerId - The provider that chose the operation.
 * @property {true} isEstimated - The plan is a proposal, not a measurement.
 */
export interface CopilotPlan {
  goal: string;
  operation: CopilotOperation | null;
  actions: CopilotAction[];
  results: CopilotResult[];
  skips: AgentSkip[];
  rationale: string[];
  notes: string[];
  plan: WorkflowPlan;
  providerId: AIProviderId;
  isEstimated: true;
}
