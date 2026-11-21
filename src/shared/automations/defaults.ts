/**
 * @fileoverview Factory helpers for creating valid empty automation
 * definitions, nodes, and default settings.
 */

import type {
  AutomationBackend,
  AutomationDefinition,
  AutomationEdge,
  AutomationNode,
  AutomationNodeData,
  AutomationNodeKind,
  AutomationPosition,
  AutomationSettings,
} from './types';
import { TRANSCODER_TYPES } from '../transcoder-constants';

/** Default name for a newly created automation. */
export const DEFAULT_AUTOMATION_NAME = 'New Automation';

let idSequence = 0;

/** Creates a monotonic id with a caller-supplied prefix. */
function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSequence}`;
}

/** Creates a unique automation definition id. */
export function newAutomationId(): string {
  return nextId('automation');
}

/** Creates a unique graph node id. */
export function newAutomationNodeId(): string {
  return nextId('node');
}

/** Creates a unique run id. */
export function newAutomationRunId(): string {
  return nextId('run');
}

/** Default settings applied to new automations. */
export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  defaultBackend: 'FFMPEG',
  tempDirectoryMode: 'app-data',
  keepIntermediateFiles: false,
  conflictPolicy: 'unique-suffix',
};

/** All backends recognized by the automation model. */
export const AUTOMATION_BACKENDS: readonly AutomationBackend[] = TRANSCODER_TYPES;

const DEFAULT_LABELS: Record<AutomationNodeKind, string> = {
  input: 'Input',
  stage: 'Stage',
  transcode: 'Transcode',
  extractAudio: 'Extract Audio',
  cut: 'Cut',
  remux: 'Remux',
  demux: 'Demux',
  compressImage: 'Compress Image',
  output: 'Output',
};

/** Creates a fresh settings object so callers never share the default instance. */
export function createAutomationSettings(overrides: Partial<AutomationSettings> = {}): AutomationSettings {
  return { ...DEFAULT_AUTOMATION_SETTINGS, ...overrides };
}

/** Creates default payload data for a node kind. */
export function createAutomationNodeData(kind: AutomationNodeKind): AutomationNodeData {
  switch (kind) {
    case 'input':
      return { kind: 'input' };
    case 'stage':
      return { kind: 'stage', name: 'New Stage' };
    case 'output':
      return { kind: 'output', path: '' };
    default:
      return { kind, options: {} };
  }
}

/** Creates an automation node with a stable id and default payload. */
export function createAutomationNode(
  id: string,
  kind: AutomationNodeKind,
  position: AutomationPosition,
  overrides: Partial<AutomationNode> = {},
): AutomationNode {
  return {
    id,
    kind,
    label: DEFAULT_LABELS[kind],
    position,
    data: createAutomationNodeData(kind),
    ...overrides,
  };
}

/** Creates a new, empty automation definition. */
export function createAutomationDefinition(
  id: string,
  name: string,
  now: number = Date.now(),
  overrides: Partial<AutomationDefinition> = {},
): AutomationDefinition {
  return {
    id,
    name,
    version: 1,
    createdAt: now,
    updatedAt: now,
    graph: { nodes: [], edges: [] },
    settings: createAutomationSettings(),
    ...overrides,
  };
}

/** Creates an automation edge with an auto-generated id. */
export function createAutomationEdge(source: string, target: string, id: string = `${source}->${target}`): AutomationEdge {
  return { id, source, target };
}
