/**
 * @fileoverview Compiles a validated automation definition into a normalized,
 * deterministic execution plan for the main-process runner.
 */

import type { AutomationDefinition, AutomationPlan, AutomationRuntime, AutomationStep } from './types';
import { isExecutableAutomationNodeKind } from './node-kinds';
import { resolveAutomationReferences } from './references';
import { topologicalNodeOrder, validateAutomation } from './validate';

/** Extension used for intermediate media files. */
const INTERMEDIATE_EXTENSION = 'bin';

/** Builds a deterministic intermediate output path for a compiled step. */
export function automationTempPath(runtime: AutomationRuntime, nodeId: string, index: number): string {
  const root = runtime.tempRoot ?? 'automations';
  const separator = root.endsWith('/') || root.endsWith('\\') ? '' : '/';
  return `${root}${separator}step-${String(index).padStart(3, '0')}-${nodeId}.${INTERMEDIATE_EXTENSION}`;
}

/** Resolves the source input path from runtime override or input nodes. */
function resolveInputPath(definition: AutomationDefinition, runtime: AutomationRuntime): string | undefined {
  if (runtime.inputPath) return runtime.inputPath;
  const input = definition.graph.nodes.find((node) => node.kind === 'input');
  if (!input) return undefined;
  return (input.data as { path?: string }).path || undefined;
}

/** Resolves the final output path from runtime override or output nodes. */
function resolveOutputPath(definition: AutomationDefinition, runtime: AutomationRuntime): string | undefined {
  if (runtime.outputPath) return runtime.outputPath;
  const output = definition.graph.nodes.find((node) => node.kind === 'output');
  if (!output) return undefined;
  return (output.data as { path?: string }).path || undefined;
}

/**
 * Validates, orders, and compiles an automation. When validation fails the
 * returned plan is marked invalid and contains no steps, so callers never run a
 * partially compiled graph.
 */
export function compileAutomation(definition: AutomationDefinition, runtime: AutomationRuntime = {}): AutomationPlan {
  const issues = validateAutomation(definition, runtime);
  if (issues.length > 0) {
    const total = definition.graph.nodes?.length ?? 0;
    return {
      valid: false,
      steps: [],
      issues,
      inputPath: resolveInputPath(definition, runtime),
      outputPath: resolveOutputPath(definition, runtime),
      summary: `Invalid automation: ${total} node(s), ${issues.length} issue(s).`,
    };
  }

  const order = topologicalNodeOrder(definition);
  const byId = new Map(definition.graph.nodes.map((node) => [node.id, node]));
  const finalOutputPath = resolveOutputPath(definition, runtime) as string;
  const steps: AutomationStep[] = [];
  const outputs = new Map<string, Record<string, unknown>>();
  let previousRef = '{{previous.output}}';

  for (const id of order) {
    const node = byId.get(id);
    if (!node || !isExecutableAutomationNodeKind(node.kind)) continue;
    const data = node.data as { backend?: string; options?: Record<string, unknown>; outputTemplate?: string };
    const options = resolveAutomationReferences(data.options ?? {}, Object.fromEntries(outputs)) as Record<string, unknown>;
    const outputPath = automationTempPath(runtime, id, steps.length);
    const step: AutomationStep = {
      nodeId: node.id,
      stageId: node.stageId,
      kind: node.kind,
      backend: (data.backend ?? definition.settings.defaultBackend) as AutomationStep['backend'],
      inputRef: previousRef,
      outputPath,
      options,
    };
    steps.push(step);
    outputs.set(node.id, { output: outputPath });
    previousRef = `{{${node.id}.output}}`;
  }

  const last = steps[steps.length - 1];
  if (last) last.outputPath = finalOutputPath;

  return {
    valid: true,
    steps,
    issues: [],
    inputPath: resolveInputPath(definition, runtime),
    outputPath: finalOutputPath,
    summary: `${steps.length} step(s): ${steps.map((step) => step.kind).join(' -> ') || 'none'}`,
  };
}
