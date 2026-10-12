/**
 * @fileoverview Typed workflow DAG for the EncodeX AI layer (roadmap §R5, F19).
 *
 * A workflow is an ordered set of media operations ("steps") where a later step
 * can consume the output of an earlier one. The model proposes a workflow as
 * data; this module validates it, detects cycles, topologically sorts it, and
 * produces a dry-run plan. Nothing here touches the filesystem or spawns a
 * process — execution lives in the MCP layer — so the planning logic is pure and
 * directly unit-testable, matching the determinism rule (§7.3).
 *
 * A step references an earlier step's result with `{{<stepId>.<field>}}`, e.g.
 * `{{extract.output}}` for the output path of the `extract` step. References
 * create an implicit dependency, so the graph is validated even when a caller
 * forgets to list `dependsOn` explicitly.
 */

/**
 * The media operations a workflow step may run. Every one of these is a
 * single-output mutating tool, so later steps can chain off `output`.
 * @const {readonly string[]}
 */
export const WORKFLOW_TOOLS = ['convert_media', 'compress_image', 'extract_audio', 'cut_video', 'remux_media'] as const;

/**
 * The name of a workflow-eligible tool.
 * @typedef {typeof WORKFLOW_TOOLS[number]} WorkflowTool
 */
export type WorkflowTool = (typeof WORKFLOW_TOOLS)[number];

/**
 * One node of a workflow DAG.
 * @interface WorkflowStep
 * @property {string} id - Unique step identifier within the workflow.
 * @property {WorkflowTool} tool - The operation this step runs.
 * @property {Record<string, unknown>} [args] - Raw tool arguments; values may
 *   contain `{{<stepId>.<field>}}` references to earlier steps.
 * @property {string[]} [dependsOn] - Explicit dependency step ids (references
 *   create implicit dependencies too).
 */
export interface WorkflowStep {
  id: string;
  tool: WorkflowTool;
  args?: Record<string, unknown>;
  dependsOn?: string[];
}

/**
 * A workflow DAG as proposed by a model.
 * @interface Workflow
 * @property {WorkflowStep[]} steps - The steps to run.
 */
export interface Workflow {
  steps: WorkflowStep[];
}

/**
 * Stable issue codes so callers (and tests) can branch without parsing prose.
 * @typedef {'empty_workflow' | 'duplicate_step_id' | 'invalid_step_id' |
 *   'unknown_tool' | 'unknown_dependency' | 'self_dependency' | 'cycle'} WorkflowIssueCode
 */
export type WorkflowIssueCode =
  'empty_workflow' | 'duplicate_step_id' | 'invalid_step_id' | 'unknown_tool' | 'unknown_dependency' | 'self_dependency' | 'cycle';

/**
 * A validation problem found while planning a workflow.
 * @interface WorkflowIssue
 * @property {WorkflowIssueCode} code - The stable issue code.
 * @property {string} message - Human-readable explanation.
 * @property {string} [stepId] - The step the issue concerns, when applicable.
 */
export interface WorkflowIssue {
  code: WorkflowIssueCode;
  message: string;
  stepId?: string;
}

/**
 * A single reference placeholder parsed out of a step's arguments.
 * @interface WorkflowReference
 * @property {string} arg - The argument key holding the reference.
 * @property {string} stepId - The referenced step id.
 * @property {string} field - The referenced field (e.g. `output`, `jobId`).
 */
export interface WorkflowReference {
  arg: string;
  stepId: string;
  field: string;
}

/**
 * A planned (validated + ordered) step, with its resolved dependency set and
 * the references it carries.
 * @interface WorkflowPlanStep
 * @property {string} id - The step id.
 * @property {WorkflowTool} tool - The operation.
 * @property {Record<string, unknown>} args - The raw arguments.
 * @property {string[]} dependsOn - Explicit + inferred dependency step ids.
 * @property {WorkflowReference[]} references - Placeholders found in the args.
 * @property {number} order - Zero-based position in execution order.
 */
export interface WorkflowPlanStep {
  id: string;
  tool: WorkflowTool;
  args: Record<string, unknown>;
  dependsOn: string[];
  references: WorkflowReference[];
  order: number;
}

/**
 * The result of planning a workflow: whether it is runnable, the execution
 * order, the per-step plan, and any issues.
 * @interface WorkflowPlan
 * @property {boolean} valid - True when there are no issues and execution can run.
 * @property {string[]} order - Step ids in execution order (empty when invalid).
 * @property {WorkflowPlanStep[]} steps - The planned steps (execution order).
 * @property {WorkflowIssue[]} issues - Validation issues (empty when valid).
 * @property {string} summary - One-line description of the plan.
 */
export interface WorkflowPlan {
  valid: boolean;
  order: string[];
  steps: WorkflowPlanStep[];
  issues: WorkflowIssue[];
  summary: string;
}

/**
 * Matches `{{stepId.field}}` placeholders (tolerating internal whitespace).
 * @const {RegExp}
 */
const REFERENCE_RE = /\{\{\s*([A-Za-z_][\w-]*)\s*\.\s*([\w.]+)\s*\}\}/g;

/**
 * Valid identifiers for step ids (letters, digits, underscore, dash).
 * @const {RegExp}
 */
const STEP_ID_RE = /^[A-Za-z_][\w-]*$/;

/**
 * Recursively walks a value, collecting every `{{stepId.field}}` reference and
 * the top-level argument key that contains it.
 * @param {unknown} value - The value to scan (string, array, or object).
 * @param {string} argKey - The argument key for context.
 * @param {WorkflowReference[]} out - Accumulator.
 * @returns {void}
 */
function collectReferences(value: unknown, argKey: string, out: WorkflowReference[]): void {
  if (typeof value === 'string') {
    const matches = value.matchAll(REFERENCE_RE);
    for (const match of matches) {
      out.push({ arg: argKey, stepId: match[1], field: match[2] });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectReferences(entry, argKey, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectReferences(entry, argKey, out);
    }
  }
}

/**
 * Extracts the references carried by a step's arguments, de-duplicated in first
 * appearance order.
 * @param {Record<string, unknown>} args - The step arguments.
 * @returns {WorkflowReference[]} The references.
 */
export function stepReferences(args: Record<string, unknown>): WorkflowReference[] {
  const collected: WorkflowReference[] = [];
  for (const [key, value] of Object.entries(args)) {
    collectReferences(value, key, collected);
  }
  const seen = new Set<string>();
  return collected.filter((ref) => {
    const token = `${ref.arg}\u0000${ref.stepId}\u0000${ref.field}`;
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

/**
 * Validates a workflow's structure: non-empty, unique/valid ids, known tools,
 * resolvable dependencies, no self-dependencies, and no cycles.
 * @param {Workflow} workflow - The workflow to validate.
 * @returns {WorkflowIssue[]} The issues found (empty when valid).
 */
export function validateWorkflow(workflow: Workflow): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  if (steps.length === 0) {
    return [{ code: 'empty_workflow', message: 'The workflow has no steps.' }];
  }

  const ids = new Set<string>();
  for (const step of steps) {
    if (!step.id || !STEP_ID_RE.test(step.id)) {
      issues.push({ code: 'invalid_step_id', message: `Invalid step id: ${JSON.stringify(step.id)}`, stepId: step.id });
      continue;
    }
    if (ids.has(step.id)) {
      issues.push({ code: 'duplicate_step_id', message: `Duplicate step id: ${step.id}`, stepId: step.id });
      continue;
    }
    ids.add(step.id);
    if (!(WORKFLOW_TOOLS as readonly string[]).includes(step.tool)) {
      issues.push({
        code: 'unknown_tool',
        message: `Step "${step.id}" uses unsupported tool "${String(step.tool)}".`,
        stepId: step.id,
      });
    }
  }

  for (const step of steps) {
    if (!step.id) continue;
    const refs = stepReferences(step.args ?? {});
    const deps = new Set<string>([...(step.dependsOn ?? []), ...refs.map((ref) => ref.stepId)]);
    for (const dep of deps) {
      if (dep === step.id) {
        issues.push({ code: 'self_dependency', message: `Step "${step.id}" depends on itself.`, stepId: step.id });
      } else if (!ids.has(dep)) {
        issues.push({
          code: 'unknown_dependency',
          message: `Step "${step.id}" depends on unknown step "${dep}".`,
          stepId: step.id,
        });
      }
    }
  }

  if (issues.length === 0) {
    const order = topologicalOrder(steps);
    if (order.length !== steps.length) {
      issues.push({ code: 'cycle', message: 'The workflow contains a dependency cycle and cannot run.' });
    }
  }

  return issues;
}

/**
 * Computes a deterministic topological order of the steps (stable on the
 * original order of ready nodes). Returns fewer ids than steps when a cycle
 * prevents completion.
 * @param {WorkflowStep[]} steps - The steps to order.
 * @returns {string[]} Step ids in dependency order (best-effort on cycles).
 */
export function topologicalOrder(steps: WorkflowStep[]): string[] {
  const byId = new Map<string, WorkflowStep>();
  for (const step of steps) {
    if (step.id && !byId.has(step.id)) byId.set(step.id, step);
  }
  const remaining = new Set(byId.keys());
  const order: string[] = [];
  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const step of steps) {
      if (!remaining.has(step.id)) continue;
      const refs = stepReferences(step.args ?? {});
      const deps = new Set<string>([...(step.dependsOn ?? []), ...refs.map((ref) => ref.stepId)]);
      let ready = true;
      for (const dep of deps) {
        if (remaining.has(dep)) {
          ready = false;
          break;
        }
      }
      if (ready) {
        order.push(step.id);
        remaining.delete(step.id);
        progressed = true;
      }
    }
  }
  return order;
}

/**
 * Builds a one-line, human-readable summary of a workflow: the step count and
 * the arrow-joined tool chain in execution order.
 * @param {WorkflowStep[]} steps - The steps to summarize.
 * @param {string[]} order - The execution order of step ids.
 * @returns {string} The summary.
 */
function summarize(steps: WorkflowStep[], order: string[]): string {
  if (steps.length === 0) return 'Empty workflow.';
  const byId = new Map(steps.map((step) => [step.id, step]));
  const chain = order
    .map((id) => byId.get(id)?.tool ?? id)
    .filter((tool, index, all) => tool !== all[index - 1])
    .join(' -> ');
  return `${steps.length} step${steps.length === 1 ? '' : 's'}: ${chain}`;
}

/**
 * Validates and topologically sorts a workflow into an execution plan. On any
 * issue the plan is marked invalid and `order` is empty, so a caller can render
 * the problems without ever running a half-built graph.
 * @param {Workflow} workflow - The workflow to plan.
 * @returns {WorkflowPlan} The dry-run plan.
 */
export function planWorkflow(workflow: Workflow): WorkflowPlan {
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  const issues = validateWorkflow(workflow);
  if (issues.length > 0) {
    return { valid: false, order: [], steps: [], issues, summary: summarize(steps, []) };
  }

  const order = topologicalOrder(steps);
  const byId = new Map(steps.map((step) => [step.id, step]));
  const planned: WorkflowPlanStep[] = order.map((id, index) => {
    const step = byId.get(id) as WorkflowStep;
    const refs = stepReferences(step.args ?? {});
    const deps = new Set<string>([...(step.dependsOn ?? []), ...refs.map((ref) => ref.stepId)]);
    return {
      id: step.id,
      tool: step.tool,
      args: step.args ?? {},
      dependsOn: [...deps],
      references: refs,
      order: index,
    };
  });

  return { valid: true, order, steps: planned, issues: [], summary: summarize(steps, order) };
}

/**
 * Substitutes `{{stepId.field}}` placeholders in a value using a context of
 * step results. A missing reference is left untouched, so the server can decide
 * whether that is an error for the given field.
 * @param {unknown} value - The value to resolve (string/array/object).
 * @param {Record<string, Record<string, unknown>>} context - Step id to fields.
 * @returns {unknown} The resolved value (same shape).
 */
export function resolveReferences(value: unknown, context: Record<string, Record<string, unknown>>): unknown {
  if (typeof value === 'string') {
    return value.replace(REFERENCE_RE, (match, stepId: string, field: string) => {
      const fields = context[stepId];
      if (!fields) return match;
      const resolved = readField(fields, field);
      return resolved === undefined ? match : String(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveReferences(entry, context));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveReferences(entry, context);
    }
    return result;
  }
  return value;
}

/**
 * Reads a dot-path field out of a step result (e.g. `output` or `meta.size`).
 * @param {Record<string, unknown>} fields - The step result fields.
 * @param {string} field - The dot-separated field path.
 * @returns {unknown} The value, or `undefined` when any segment is missing.
 */
function readField(fields: Record<string, unknown>, field: string): unknown {
  let current: unknown = fields;
  for (const segment of field.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
