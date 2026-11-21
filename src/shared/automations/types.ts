/**
 * @fileoverview Canonical, versioned data model for Automations pipelines.
 *
 * These types describe the persisted graph and its compiled execution plan.
 * They are deliberately independent of React Flow view-model types and of the
 * Electron IPC boundary so definitions can be validated and compiled in pure
 * shared code and reused by both renderer and main process.
 */

import type { ConversionOptions } from '../types';
import type { TRANSCODER_TYPES } from '../transcoder-constants';

/** Stable node-kind identifiers, exported so renderer code avoids literal copy. */
export const AUTOMATION_KIND = {
  INPUT: 'input',
  STAGE: 'stage',
  TRANSCODE: 'transcode',
  EXTRACT_AUDIO: 'extractAudio',
  CUT: 'cut',
  REMUX: 'remux',
  DEMUX: 'demux',
  COMPRESS_IMAGE: 'compressImage',
  OUTPUT: 'output',
} as const;

/** Stable run-status identifiers. */
export const AUTOMATION_RUN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

/** Backend identifiers available to automation operations. */
export type AutomationBackend = (typeof TRANSCODER_TYPES)[number];

/** Terminal/active states reported for an automation run or one of its nodes. */
export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** Stable codes for automation validation issues. */
export type AutomationIssueCode =
  | 'empty_graph'
  | 'missing_input'
  | 'missing_output'
  | 'duplicate_node_id'
  | 'invalid_node_kind'
  | 'invalid_stage_reference'
  | 'unknown_dependency'
  | 'self_dependency'
  | 'cycle'
  | 'disconnected_node'
  | 'unsupported_operation_for_media_kind'
  | 'backend_unavailable'
  | 'invalid_reference'
  | 'invalid_output_path_template'
  | 'missing_required_option';

/** Media categories used to filter compatible operations in the editor. */
export type AutomationMediaKind = 'video' | 'audio' | 'image' | 'unknown';

/** A node's position on the visual canvas. */
export interface AutomationPosition {
  x: number;
  y: number;
}

/** Payload for the source-media node. Paths are untrusted defaults until run time. */
export interface InputNodeData {
  kind: 'input';
  path?: string;
  mediaKind?: AutomationMediaKind;
}

/** Payload for a visual/logical stage grouping. */
export interface StageNodeData {
  kind: 'stage';
  name: string;
}

/** Payload for an executable operation node. */
export interface OperationNodeData {
  kind: 'transcode' | 'extractAudio' | 'cut' | 'remux' | 'demux' | 'compressImage';
  backend?: AutomationBackend;
  options: ConversionOptions;
  outputTemplate?: string;
}

/** Payload for the final destination node. */
export interface OutputNodeData {
  kind: 'output';
  path: string;
  extension?: string;
}

/** Discriminated payload carried by an automation node. */
export type AutomationNodeData = InputNodeData | StageNodeData | OperationNodeData | OutputNodeData;

/** Node kinds understood by the model, validator, and compiler. */
export type AutomationNodeKind = AutomationNodeData['kind'];

/** One node in an automation graph. */
export interface AutomationNode {
  id: string;
  kind: AutomationNodeKind;
  label: string;
  stageId?: string;
  position: AutomationPosition;
  data: AutomationNodeData;
}

/** A directed media/data-flow connection between two nodes. */
export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** A visual automation graph. */
export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

/** Execution and output settings stored with an automation definition. */
export interface AutomationSettings {
  defaultBackend: AutomationBackend;
  tempDirectoryMode: 'app-data' | 'system-temp';
  keepIntermediateFiles: boolean;
  conflictPolicy: 'overwrite' | 'unique-suffix' | 'prompt';
}

/** A saved, versioned automation definition. */
export interface AutomationDefinition {
  id: string;
  name: string;
  description?: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  graph: AutomationGraph;
  settings: AutomationSettings;
}

/** A `{{nodeId.field}}` placeholder found inside an options payload. */
export interface AutomationReference {
  field: string;
  nodeId: string;
  path: string;
}

/** Portable JSON export envelope for one automation definition. */
export interface AutomationExport {
  format: 'automation';
  version: 1;
  exportedAt: number;
  automation: AutomationDefinition;
}

/** A validation problem with a stable, testable code. */
export interface AutomationIssue {
  code: AutomationIssueCode;
  message: string;
  nodeId?: string;
  stageId?: string;
}

/** Runtime inputs that can override persisted defaults at execution time. */
export interface AutomationRuntime {
  inputPath?: string;
  outputPath?: string;
  availableBackends?: AutomationBackend[];
  mediaKind?: AutomationMediaKind;
  tempRoot?: string;
}

/** One normalized step in a compiled execution plan. */
export interface AutomationStep {
  nodeId: string;
  stageId?: string;
  kind: AutomationNodeKind;
  backend?: AutomationBackend;
  inputRef: string;
  outputPath: string;
  options: Record<string, unknown>;
}

/** Result of compiling a definition into a runnable step list. */
export interface AutomationPlan {
  valid: boolean;
  steps: AutomationStep[];
  issues: AutomationIssue[];
  inputPath?: string;
  outputPath?: string;
  summary: string;
}

/** Aggregate state of one automation run in the renderer. */
export interface AutomationRunState {
  runId: string;
  status: AutomationRunStatus;
  progress: number;
  message?: string;
  nodeStatuses: Record<string, AutomationRunStatus>;
}

/** Progress/status event pushed from the main process to the renderer. */
export interface AutomationProgressEvent {
  runId: string;
  automationId: string;
  nodeId: string;
  stageId?: string;
  status: AutomationRunStatus;
  progress?: number;
  message?: string;
  outputPath?: string;
  error?: string;
}
