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

import type { CopilotOperation } from './types';

export type { CopilotOperation, CopilotOperationChoice, CopilotPlanRequest, CopilotAction, CopilotResult, CopilotPlan } from './types';

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
