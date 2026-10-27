/**
 * @fileoverview Shared contract for MCP Apps (SEP-1865) support in EncodeX.
 *
 * MCP Apps let a tool declare an interactive UI resource (a `ui://` URI) that a
 * compliant host (Claude, VS Code, ChatGPT, Goose) fetches via `resources/read`
 * and renders in a sandboxed iframe. Hosts that do not support the extension
 * fall back to the tool's normal text result, so the surface stays
 * backwards-compatible.
 *
 * This module is the single source of truth for the extension identifier, the
 * resource MIME type, the view URIs EncodeX ships, and the structured-content
 * shapes delivered to each view. It is dependency-free so it can be imported
 * from the MCP server, tests, and tooling alike.
 *
 * Protocol reference: https://modelcontextprotocol.io/extensions/apps/overview
 */

/**
 * MCP extension identifier advertised in the server's `extensions`
 * capabilities and detected on clients via {@link McpUiClientCapabilities}.
 * @const {string}
 */
export const MCP_UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/**
 * MIME type that marks an HTML resource as an MCP App view.
 * @const {string}
 */
export const MCP_UI_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * URI scheme used by every MCP App view resource.
 * @const {string}
 */
export const MCP_UI_URI_SCHEME = 'ui://';

/**
 * Canonical view URIs shipped by EncodeX.
 *
 * These are the stable identifiers referenced by tool `_meta.ui.resourceUri`
 * and served by `registerUiResources`. Additional views (profiles,
 * capabilities) are reserved here so the identifiers never drift.
 * @const {Record<string, string>}
 */
export const MCP_UI_VIEW_URIS = {
  queue: 'ui://encodex/queue',
  job: 'ui://encodex/job',
  mediaInfo: 'ui://encodex/media-info',
  convert: 'ui://encodex/convert',
  confirm: 'ui://encodex/confirm',
  inspector: 'ui://encodex/inspector',
  plan: 'ui://encodex/plan',
  lab: 'ui://encodex/lab',
  error: 'ui://encodex/error',
  batch: 'ui://encodex/batch',
  workflow: 'ui://encodex/workflow',
  profiles: 'ui://encodex/profiles',
  capabilities: 'ui://encodex/capabilities',
} as const;

/**
 * Identifier of a shipped view, derived from {@link MCP_UI_VIEW_URIS}.
 * @typedef {keyof typeof MCP_UI_VIEW_URIS} McpUiViewId
 */
export type McpUiViewId = keyof typeof MCP_UI_VIEW_URIS;

/**
 * One entry of the job status returned to the queue/job views. Mirrors the
 * job manager's serialized shape without importing it, keeping this contract
 * usable from any process.
 * @interface McpUiJob
 * @property {string} id - Stable job id.
 * @property {string} input - Absolute input path.
 * @property {string} output - Absolute output path.
 * @property {string} status - Lifecycle status (queued, running, done, ...).
 * @property {number} progress - Completion percentage (0-100).
 * @property {string} [error] - Failure message, when the job failed.
 */
export interface McpUiJob {
  id: string;
  input: string;
  output: string;
  status: string;
  progress: number;
  error?: string;
}

/**
 * One label/value row of a confirmation rendered before an operation runs.
 * @interface McpUiConfirmationField
 * @property {string} label - Short field name (e.g. "Output").
 * @property {string} value - Human-readable value.
 */
export interface McpUiConfirmationField {
  label: string;
  value: string;
}

/**
 * A mutating operation awaiting explicit user approval.
 *
 * When the host supports MCP Apps, the server never runs a mutating tool from
 * a model call: it returns a confirmation instead, the app renders the details,
 * and only a user click replays {@link McpUiConfirmation.args} into the
 * app-only `commit_operation` tool. Hosts without the extension keep the old
 * headless behaviour and execute immediately (see `approval.ts`).
 * @interface McpUiConfirmation
 * @property {string} operation - Executor tool that the approval runs.
 * @property {string} title - Short imperative heading (e.g. "Cut video").
 * @property {string} summary - One-line summary of the effect.
 * @property {Record<string, unknown>} args - Raw arguments replayed verbatim.
 * @property {McpUiConfirmationField[]} [details] - Key/value rows to show.
 * @property {string[]} [warnings] - Warnings surfaced before running.
 */
export interface McpUiConfirmation {
  operation: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  details?: McpUiConfirmationField[];
  warnings?: string[];
}

/**
 * A media stream as the media-info view renders it.
 *
 * The view only needs a handful of fields per stream, and the server sends
 * the full probe result, so every field is optional here.
 * @interface McpUiStream
 * @property {number} [index] - Stream index in the container.
 * @property {string} [type] - Stream kind (`video`, `audio`, `subtitle`).
 * @property {string} [codec] - Short codec name.
 * @property {number} [width] - Video width in pixels.
 * @property {number} [height] - Video height in pixels.
 * @property {string} [frameRate] - Frame rate string.
 * @property {string} [pixelFormat] - Pixel format.
 * @property {number} [channels] - Audio channel count.
 * @property {string} [channelLayout] - Audio channel layout.
 * @property {number} [sampleRate] - Audio sample rate in Hz.
 * @property {string} [title] - Stream title.
 * @property {string} [language] - Stream language tag.
 */
export interface McpUiStream {
  index?: number;
  type?: string;
  codec?: string;
  width?: number;
  height?: number;
  frameRate?: string;
  pixelFormat?: string;
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  title?: string;
  language?: string;
}

/**
 * Container and per-stream metadata shown by the media-info view.
 * @interface McpUiMediaInfo
 * @property {string} [file] - Absolute path of the probed file.
 * @property {string} [format] - Container format name.
 * @property {string} [formatLong] - Long container description.
 * @property {number} [duration] - Duration in seconds.
 * @property {number} [size] - File size in bytes.
 * @property {string | number} [bitrate] - Overall bitrate.
 * @property {McpUiStream[]} [streams] - Streams of the container.
 */
export interface McpUiMediaInfo {
  file?: string;
  format?: string;
  formatLong?: string;
  duration?: number;
  size?: number;
  bitrate?: string | number;
  streams?: McpUiStream[];
}

/**
 * One finding of a media diagnosis.
 * @interface McpUiFinding
 * @property {string} [severity] - `info`, `warning` or `error`.
 * @property {string} [message] - Human-readable description.
 */
export interface McpUiFinding {
  severity?: 'info' | 'warning' | 'error' | string;
  message?: string;
}

/**
 * A plain-language media diagnosis shown by the inspector view.
 * @interface McpUiAnalysis
 * @property {string} [file] - Absolute path of the analysed file.
 * @property {string} [summary] - One-sentence summary.
 * @property {Record<string, unknown>} [facts] - Structured facts.
 * @property {McpUiFinding[]} [findings] - Findings ordered by severity.
 * @property {string[]} [recommendations] - Suggested next steps.
 */
export interface McpUiAnalysis {
  file?: string;
  summary?: string;
  facts?: Record<string, unknown>;
  findings?: McpUiFinding[];
  recommendations?: string[];
}

/**
 * A recommended conversion plan shown by the plan view.
 * @interface McpUiPlan
 * @property {string} [providerId] - Provider that produced the plan.
 * @property {string} [profileId] - Profile the plan maps to.
 * @property {number} [confidence] - Confidence between 0 and 1.
 * @property {string[]} [rationale] - Why the plan recommends these settings.
 * @property {Record<string, unknown>} [args] - The recommended settings.
 */
export interface McpUiPlan {
  providerId?: string;
  profileId?: string;
  confidence?: number;
  rationale?: string[];
  args?: Record<string, unknown>;
}

/**
 * An output-size estimate shown by the plan view.
 * @interface McpUiEstimate
 * @property {string} [method] - Estimation method.
 * @property {number} [estimatedSizeBytes] - Estimated output size.
 * @property {number} [estimatedDurationSeconds] - Estimated output duration.
 * @property {number} [videoBitrateKbps] - Estimated video bitrate.
 * @property {number} [audioBitrateKbps] - Estimated audio bitrate.
 * @property {boolean} [copy] - True when the streams are copied as-is.
 * @property {{available?: boolean; methods?: string[]}} [hardwareAcceleration] - Hardware acceleration support.
 * @property {string[]} [notes] - Assumptions behind the estimate.
 */
export interface McpUiEstimate {
  method?: string;
  estimatedSizeBytes?: number;
  estimatedDurationSeconds?: number;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  copy?: boolean;
  hardwareAcceleration?: { available?: boolean; methods?: string[] };
  notes?: string[];
}

/**
 * One measured attempt of the size-target compression loop.
 * @interface McpUiLabAttempt
 * @property {string} [candidate] - Candidate id.
 * @property {number} [videoBitrateKbps] - Requested video bitrate.
 * @property {number} [audioBitrateKbps] - Requested audio bitrate.
 * @property {number} [sizeBytes] - Measured output size.
 * @property {string} [output] - Output path.
 * @property {string} [status] - Attempt outcome.
 * @property {boolean} [fits] - True when the attempt met the size ceiling.
 */
export interface McpUiLabAttempt {
  candidate?: string;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  sizeBytes?: number;
  output?: string;
  status?: string;
  fits?: boolean;
}

/**
 * The measured size-target compression result shown by the lab view.
 * @interface McpUiLab
 * @property {string} [input] - Source path.
 * @property {number} [maxBytes] - Requested size ceiling.
 * @property {string} [videoCodec] - Video codec used.
 * @property {string} [audioCodec] - Audio codec used.
 * @property {boolean} [converged] - True when a candidate met the ceiling.
 * @property {McpUiLabAttempt} [chosen] - The winning attempt.
 * @property {McpUiLabAttempt[]} [attempts] - Every attempt, in order.
 * @property {{baselineVideoKbps?: number; audioBitrateKbps?: number; candidates?: Array<{videoBitrateKbps?: number; percentOfBaseline?: number; rationale?: string}>; notes?: string[]}} [plan] - The candidate ladder.
 */
export interface McpUiLab {
  input?: string;
  maxBytes?: number;
  videoCodec?: string;
  audioCodec?: string;
  converged?: boolean;
  chosen?: McpUiLabAttempt;
  attempts?: McpUiLabAttempt[];
  plan?: {
    baselineVideoKbps?: number;
    audioBitrateKbps?: number;
    candidates?: Array<{ videoBitrateKbps?: number; percentOfBaseline?: number; rationale?: string }>;
    notes?: string[];
  };
}

/**
 * A fix the error view can apply on the user's behalf.
 * @interface McpUiErrorFix
 * @property {string} label - Short fix name.
 * @property {string} [description] - What the fix does.
 * @property {string} [kind] - `retry` for a retry, anything else for a fix.
 * @property {string} [tool] - Tool to call when the fix is applied.
 * @property {Record<string, unknown>} [args] - Arguments for that tool.
 */
export interface McpUiErrorFix {
  label?: string;
  description?: string;
  kind?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/**
 * A plain-language error explanation shown by the error view.
 * @interface McpUiErrorExplanation
 * @property {string} [code] - Stable error code.
 * @property {string} [title] - Short heading.
 * @property {string} [explanation] - What went wrong.
 * @property {string} [detail] - Raw detail.
 * @property {string[]} [causes] - Likely causes.
 * @property {McpUiErrorFix[]} [fixes] - Suggested fixes.
 */
export interface McpUiErrorExplanation {
  code?: string;
  title?: string;
  explanation?: string;
  detail?: string;
  causes?: string[];
  fixes?: McpUiErrorFix[];
}

/**
 * One step of a workflow plan.
 * @interface McpUiWorkflowStep
 * @property {string} id - Step id.
 * @property {string} tool - Tool the step calls.
 * @property {number} [order] - Execution order.
 * @property {string[]} [dependsOn] - Ids of the steps this one depends on.
 */
export interface McpUiWorkflowStep {
  id?: string;
  tool?: string;
  order?: number;
  dependsOn?: string[];
}

/**
 * A workflow dry-run shown by the workflow view.
 * @interface McpUiWorkflowPlan
 * @property {string} [summary] - One-line description of the plan.
 * @property {boolean} [valid] - True when the plan can run.
 * @property {McpUiWorkflowStep[]} [steps] - Ordered steps.
 * @property {Array<{message?: string}>} [issues] - Why the plan is invalid.
 */
export interface McpUiWorkflowPlan {
  summary?: string;
  valid?: boolean;
  steps?: McpUiWorkflowStep[];
  issues?: Array<{ message?: string }>;
}

/**
 * The result of a workflow run shown by the workflow view.
 * @interface McpUiWorkflowResult
 * @property {number} [completed] - Number of completed steps.
 * @property {number} [failed] - Number of failed steps.
 * @property {Array<{id?: string; tool?: string; jobId?: string; output?: string; status?: string}>} [steps] - Per-step outcome.
 */
export interface McpUiWorkflowResult {
  completed?: number;
  failed?: number;
  steps?: Array<{ id?: string; tool?: string; jobId?: string; output?: string; status?: string }>;
}

/**
 * One entry of the batch dashboard.
 * @interface McpUiBatchEntry
 * @property {string} [id] - Job id.
 * @property {string} [jobId] - Job id (alias used by the batch tool).
 * @property {string} [input] - Source path.
 * @property {string} [output] - Destination path.
 * @property {string} [file] - Source path (alias used by the batch tool).
 * @property {string} [status] - Lifecycle status.
 * @property {number} [progress] - Completion percentage.
 */
export interface McpUiBatchEntry {
  id?: string;
  jobId?: string;
  input?: string;
  output?: string;
  file?: string;
  status?: string;
  progress?: number;
}

/**
 * A built-in conversion profile shown by the profiles view.
 * @interface McpUiProfile
 * @property {string} id - Profile id.
 * @property {string} name - Display name.
 * @property {string} [category] - Profile category.
 * @property {string} [container] - Output container.
 * @property {string} [videoCodec] - Video codec.
 * @property {string} [audioCodec] - Audio codec.
 * @property {string} [preset] - Encoder preset.
 */
export interface McpUiProfile {
  id?: string;
  name?: string;
  category?: string;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  preset?: string;
}

/**
 * The encoder capabilities shown by the capabilities view.
 * @interface McpUiCapabilities
 * @property {string[]} [videoEncoders] - Available video encoders.
 * @property {string[]} [audioEncoders] - Available audio encoders.
 * @property {string[]} [hwaccels] - Available hardware accelerations.
 */
export interface McpUiCapabilities {
  videoEncoders?: string[];
  audioEncoders?: string[];
  hwaccels?: string[];
}

/**
 * Structured content delivered to the confirm view for a pending operation.
 * @interface McpUiConfirmationPayload
 * @property {McpUiConfirmation} confirmation - The pending confirmation.
 */
export interface McpUiConfirmationPayload {
  confirmation: McpUiConfirmation;
}

/**
 * Client capability payload advertised by MCP Apps hosts under
 * {@link MCP_UI_EXTENSION_ID}; presence of the MIME type signals support.
 * @interface McpUiClientCapabilities
 * @property {string[]} [mimeTypes] - Supported UI resource MIME types.
 */
export interface McpUiClientCapabilities {
  mimeTypes?: string[];
}

/**
 * True when the given client capabilities advertise MCP Apps support.
 *
 * Presence of the {@link MCP_UI_EXTENSION_ID} extension is the signal (matching
 * the reference `getUiCapability` helper): unless the payload lists explicit
 * `mimeTypes` that omit the HTML view MIME type, the host can render EncodeX
 * views. Kept host-agnostic (no SDK dependency) so tool registration and tests
 * can branch on capability support.
 * @param {unknown} capabilities - The `extensions` value from client caps.
 * @returns {boolean} True when the host can render EncodeX views.
 */
export function supportsMcpUi(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== 'object') return false;
  const mimeTypes = (capabilities as McpUiClientCapabilities).mimeTypes;
  if (!Array.isArray(mimeTypes)) return true;
  return mimeTypes.includes(MCP_UI_RESOURCE_MIME_TYPE);
}
