/**
 * @fileoverview Pure validation for automation definitions.
 *
 * Produces stable, code-tagged issues for editor display and for the main
 * process to re-check before execution. No filesystem or process access.
 */

import type { AutomationDefinition, AutomationIssue, AutomationNode, AutomationRuntime } from './types';
import { AUTOMATION_NODE_KINDS, automationOperationSupportsMedia, isExecutableAutomationNodeKind } from './node-kinds';
import { isValidAutomationId, automationReferences } from './references';
import { AUTOMATION_BACKENDS } from './defaults';

/** Characters that are unsafe in a path template (after a Windows drive prefix). */
const UNSAFE_TEMPLATE_CHARS = /[<>"|?*\u0000-\u001f]/;

/** True when a template/path contains unsafe characters. A leading drive colon is allowed. */
function hasUnsafeTemplateChars(value: string): boolean {
  if (UNSAFE_TEMPLATE_CHARS.test(value)) return true;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === ':' && !(index === 1 && /^[A-Za-z]$/.test(value[0]))) return true;
  }
  return false;
}

/** Collects the ids of every node targeted by a graph edge. */
function dependencyIds(nodes: AutomationNode[], definition: AutomationDefinition): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const node of nodes) deps.set(node.id, new Set());
  for (const edge of definition.graph.edges ?? []) {
    deps.get(edge.target)?.add(edge.source);
  }
  for (const node of nodes) {
    if (!isExecutableAutomationNodeKind(node.kind)) continue;
    const options = (node.data as { options?: Record<string, unknown> }).options ?? {};
    for (const ref of automationReferences(options)) {
      if (!isValidAutomationId(ref.nodeId)) continue;
      deps.get(node.id)?.add(ref.nodeId);
    }
  }
  return deps;
}

/** Deterministically orders node ids using edge/reference dependencies. */
export function topologicalNodeOrder(definition: AutomationDefinition): string[] {
  const nodes = definition.graph.nodes ?? [];
  const deps = dependencyIds(nodes, definition);
  const remaining = new Set(nodes.filter((node) => isValidAutomationId(node.id)).map((node) => node.id));
  const order: string[] = [];
  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const id of [...remaining]) {
      const pending = [...(deps.get(id) ?? [])].some((dep) => remaining.has(dep));
      if (!pending) {
        order.push(id);
        remaining.delete(id);
        progressed = true;
      }
    }
  }
  return order;
}

/** Validates a definition plus optional runtime overrides. */
export function validateAutomation(definition: AutomationDefinition, runtime: AutomationRuntime = {}): AutomationIssue[] {
  const issues: AutomationIssue[] = [];
  const nodes = Array.isArray(definition.graph?.nodes) ? definition.graph.nodes : [];
  const edges = Array.isArray(definition.graph?.edges) ? definition.graph.edges : [];

  if (nodes.length === 0) {
    return [
      { code: 'empty_graph', message: 'The automation has no nodes.' },
      { code: 'missing_input', message: 'The automation has no input node.' },
      { code: 'missing_output', message: 'The automation has no output node.' },
    ];
  }

  const validIds = new Set<string>();
  for (const node of nodes) {
    if (!isValidAutomationId(node.id)) {
      issues.push({ code: 'invalid_node_kind', message: `Invalid node id: ${JSON.stringify(node.id)}`, nodeId: node.id });
      continue;
    }
    if (validIds.has(node.id)) {
      issues.push({ code: 'duplicate_node_id', message: `Duplicate node id: ${node.id}`, nodeId: node.id });
      continue;
    }
    validIds.add(node.id);
    if (!(AUTOMATION_NODE_KINDS as readonly string[]).includes(node.kind)) {
      issues.push({
        code: 'invalid_node_kind',
        message: `Node "${node.id}" has unsupported kind "${String(node.kind)}".`,
        nodeId: node.id,
      });
    }
  }

  const inputs = nodes.filter((node) => node.kind === 'input');
  const outputs = nodes.filter((node) => node.kind === 'output');
  const hasRuntimeInput = Boolean(runtime.inputPath);
  if (inputs.length === 0 && !hasRuntimeInput) {
    issues.push({ code: 'missing_input', message: 'The automation has no input node and no runtime input path.' });
  }
  if (outputs.length === 0 && !runtime.outputPath) {
    issues.push({ code: 'missing_output', message: 'The automation has no output node and no runtime output path.' });
  }

  const stageIds = new Set(nodes.filter((node) => node.kind === 'stage').map((node) => node.id));
  for (const node of nodes) {
    if (node.stageId && !stageIds.has(node.stageId)) {
      issues.push({
        code: 'invalid_stage_reference',
        message: `Node "${node.id}" references unknown stage "${node.stageId}".`,
        nodeId: node.id,
        stageId: node.stageId,
      });
    }
  }

  const deps = dependencyIds(nodes, definition);
  for (const node of nodes) {
    if (!validIds.has(node.id)) continue;
    for (const dep of deps.get(node.id) ?? []) {
      if (dep === node.id) {
        issues.push({ code: 'self_dependency', message: `Node "${node.id}" depends on itself.`, nodeId: node.id });
      } else if (!validIds.has(dep)) {
        issues.push({
          code: 'unknown_dependency',
          message: `Node "${node.id}" depends on unknown node "${dep}".`,
          nodeId: node.id,
        });
      }
    }
  }

  if (topologicalNodeOrder(definition).length !== validIds.size) {
    issues.push({ code: 'cycle', message: 'The automation graph contains a cycle and cannot run.' });
  }

  for (const edge of edges) {
    if (!validIds.has(edge.source) || !validIds.has(edge.target)) {
      issues.push({
        code: 'unknown_dependency',
        message: `Edge "${edge.id}" references a missing node.`,
      });
    }
  }

  if (edges.length > 0) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    const hasExplicitReference = new Set<string>();
    for (const node of nodes) {
      if (!isExecutableAutomationNodeKind(node.kind)) continue;
      const options = (node.data as { options?: Record<string, unknown> }).options ?? {};
      for (const ref of automationReferences(options)) hasExplicitReference.add(ref.nodeId);
    }
    for (const node of nodes) {
      if (node.kind === 'stage' || connected.has(node.id) || hasExplicitReference.has(node.id)) continue;
      issues.push({
        code: 'disconnected_node',
        message: `Node "${node.id}" is not connected to the automation flow.`,
        nodeId: node.id,
      });
    }
  }

  const availableBackends = runtime.availableBackends ?? AUTOMATION_BACKENDS;
  for (const node of nodes) {
    if (!isExecutableAutomationNodeKind(node.kind)) continue;
    const data = node.data as { backend?: string; options?: Record<string, unknown>; outputTemplate?: string };
    const backend = data.backend ?? definition.settings.defaultBackend;
    if (!availableBackends.includes(backend as (typeof AUTOMATION_BACKENDS)[number])) {
      issues.push({
        code: 'backend_unavailable',
        message: `Node "${node.id}" requires unavailable backend "${backend}".`,
        nodeId: node.id,
      });
    }
    if (runtime.mediaKind && runtime.mediaKind !== 'unknown' && !automationOperationSupportsMedia(node.kind, runtime.mediaKind)) {
      issues.push({
        code: 'unsupported_operation_for_media_kind',
        message: `Node "${node.id}" (${node.kind}) does not support ${runtime.mediaKind} input.`,
        nodeId: node.id,
      });
    }
    const options = data.options ?? {};
    for (const ref of automationReferences(options)) {
      if (!isValidAutomationId(ref.nodeId) || (ref.path !== 'output' && !ref.path.startsWith('mediaInfo'))) {
        issues.push({
          code: 'invalid_reference',
          message: `Node "${node.id}" has invalid reference "${ref.nodeId}.${ref.path}".`,
          nodeId: node.id,
        });
      }
    }
    if (data.outputTemplate && hasUnsafeTemplateChars(data.outputTemplate)) {
      issues.push({
        code: 'invalid_output_path_template',
        message: `Node "${node.id}" has an unsafe output path template.`,
        nodeId: node.id,
      });
    }
  }

  for (const node of outputs) {
    const data = node.data as { path?: string };
    if (!data.path && !runtime.outputPath) {
      issues.push({ code: 'missing_required_option', message: `Output node "${node.id}" has no destination path.`, nodeId: node.id });
    } else if (data.path && hasUnsafeTemplateChars(data.path)) {
      issues.push({ code: 'invalid_output_path_template', message: `Output node "${node.id}" has an unsafe path.`, nodeId: node.id });
    }
  }

  return issues;
}

/** True when a definition (and optional runtime context) has no validation issues. */
export function isValidAutomation(definition: AutomationDefinition, runtime: AutomationRuntime = {}): boolean {
  return validateAutomation(definition, runtime).length === 0;
}
