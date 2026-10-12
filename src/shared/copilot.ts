/**
 * @fileoverview Shared contract for the desktop Copilot panel (roadmap 7.4, R6).
 *
 * The renderer asks the main process to plan a goal against a folder of media;
 * main answers with the deterministic agent plan (F20) plus the ready-to-run
 * `ConversionOptions` for each action. The renderer only *proposes*; committing
 * the work reuses the existing Batch Queue, so there is no second approval
 * system. This module is pure types (imported by the renderer, preload and
 * main), so it must stay free of Electron and Node built-ins.
 */

import type { ConversionOptions } from './types';
import type { AgentAction, AgentSkip } from './ai/agent';
import type { WorkflowPlan } from './ai/workflow';

/**
 * A Copilot planning request issued by the renderer.
 * @interface CopilotPlanRequest
 * @property {string} goal - The natural-language goal shared by every file.
 * @property {string[]} inputs - Files and/or folders to plan against.
 * @property {boolean} [recursive] - Descend into subfolders (default false).
 * @property {number} [maxFiles] - Upper bound on planned actions (default 50).
 * @property {number} [minSavings] - Minimum estimated size reduction to keep.
 */
export interface CopilotPlanRequest {
  goal: string;
  inputs: string[];
  recursive?: boolean;
  maxFiles?: number;
  minSavings?: number;
}

/**
 * A planned conversion action, carrying the ready-to-enqueue options.
 * @interface CopilotAction
 * @augments AgentAction
 * @property {ConversionOptions} options - Options for the Batch Queue.
 */
export interface CopilotAction extends AgentAction {
  options: ConversionOptions;
}

/**
 * The plan the Copilot panel renders: the agent's actions, skips and rationale,
 * plus the dry-run of the workflow the actions form.
 * @interface CopilotPlan
 * @property {string} goal - The goal the plan was built for.
 * @property {CopilotAction[]} actions - Planned conversions, in file order.
 * @property {AgentSkip[]} skips - Files left out, with reasons.
 * @property {string[]} rationale - Plan-level reasons, one per line.
 * @property {string[]} notes - Caveats for the caller.
 * @property {WorkflowPlan} plan - The dry-run validation of the workflow.
 * @property {true} isEstimated - The plan is a proposal, not a measurement.
 */
export interface CopilotPlan {
  goal: string;
  actions: CopilotAction[];
  skips: AgentSkip[];
  rationale: string[];
  notes: string[];
  plan: WorkflowPlan;
  isEstimated: true;
}
