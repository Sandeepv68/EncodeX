/**
 * @fileoverview Shared contract for the EncodeX AI layer (roadmap 2.0, §7).
 *
 * The AI layer turns a natural-language intent plus *structured media facts*
 * into a typed, reviewable plan that the existing engine can execute. Nothing
 * here calls a model: these are the provider-agnostic shapes the deterministic
 * pre/post-processing code (`facts`, `analyze`, `estimate`, `validate`,
 * `recommend`) and the optional provider adapters both speak.
 *
 * The module is dependency-free (type-only imports) so it can be imported from
 * the Electron main process, the Electron-free MCP server, tests and tooling
 * alike.
 */

import type { ConversionProfile, EncoderCapabilities, ErrorCodeType, MediaInfo, ProfileCategory } from '../types';
import type { CopilotOperation } from '../copilot';
import type { WORKFLOW_TOOLS } from './workflow';

/**
 * Identifier of an AI provider implementation.
 * @typedef {('rules' | 'openai' | 'anthropic' | 'gemini' | 'local')} AIProviderId
 */
export type AIProviderId = 'rules' | 'openai' | 'anthropic' | 'gemini' | 'local';

/**
 * How much data a provider sends off the device, surfaced in Settings (7.5).
 *
 * - `none`     — nothing leaves the machine (deterministic rules, local model);
 * - `metadata` — probe output / intent text only, never file bytes;
 * - `media`    — file bytes may be uploaded (not used by any shipped adapter).
 * @typedef {('none' | 'metadata' | 'media')} DataEgress
 */
export type DataEgress = 'none' | 'metadata' | 'media';

/**
 * Public description of a provider, used for Settings display and selection.
 * @interface AIProviderDescriptor
 * @property {AIProviderId} id - Stable provider id.
 * @property {string} label - Human-readable name.
 * @property {DataEgress} dataEgress - What the provider transmits off-device.
 * @property {boolean} requiresApiKey - Whether the provider needs a key.
 * @property {string} [note] - Short caveat shown next to the provider.
 */
export interface AIProviderDescriptor {
  id: AIProviderId;
  label: string;
  dataEgress: DataEgress;
  requiresApiKey: boolean;
  note?: string;
}

/**
 * The one-line facts every media file yields, derived deterministically from a
 * probe. This — not raw ffprobe JSON — is what a provider is allowed to read.
 * @interface MediaFacts
 * @property {string} file - Absolute path of the probed file.
 * @property {string} format - Container/format name.
 * @property {number} sizeBytes - File size in bytes.
 * @property {number} durationSeconds - Container duration in seconds.
 * @property {string} [overallBitrate] - Overall bitrate as reported (e.g. '2000k').
 * @property {boolean} hasVideo - Whether the file has a video stream.
 * @property {boolean} hasAudio - Whether the file has an audio stream.
 * @property {number} subtitleCount - Number of subtitle streams.
 * @property {MediaFactsVideo} [video] - Primary video stream facts.
 * @property {MediaFactsAudio} [audio] - Primary audio stream facts.
 */
export interface MediaFacts {
  file: string;
  format: string;
  sizeBytes: number;
  durationSeconds: number;
  overallBitrate?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  subtitleCount: number;
  video?: MediaFactsVideo;
  audio?: MediaFactsAudio;
}

/**
 * Primary video stream facts.
 * @interface MediaFactsVideo
 * @property {string} [codec] - Codec name (e.g. 'h264').
 * @property {number} [width] - Width in pixels.
 * @property {number} [height] - Height in pixels.
 * @property {string} [frameRate] - Frame rate string (e.g. '30/1').
 * @property {string} [pixelFormat] - Pixel format (e.g. 'yuv420p').
 * @property {number} [bitDepth] - Bits per component.
 * @property {boolean} hdr - Whether the stream carries HDR metadata.
 * @property {string} [colorTransfer] - Transfer characteristic.
 * @property {string} [colorPrimaries] - Colour primaries.
 * @property {string} [colorSpace] - Colour space.
 * @property {boolean} interlaced - Whether the stream is interlaced.
 */
export interface MediaFactsVideo {
  codec?: string;
  width?: number;
  height?: number;
  frameRate?: string;
  pixelFormat?: string;
  bitDepth?: number;
  hdr: boolean;
  colorTransfer?: string;
  colorPrimaries?: string;
  colorSpace?: string;
  interlaced: boolean;
}

/**
 * Primary audio stream facts.
 * @interface MediaFactsAudio
 * @property {string} [codec] - Codec name (e.g. 'aac').
 * @property {number} [channels] - Channel count.
 * @property {string} [channelLayout] - Channel layout (e.g. 'stereo').
 * @property {number} [sampleRate] - Sample rate in Hz.
 * @property {string} [bitrate] - Stream bitrate as reported.
 */
export interface MediaFactsAudio {
  codec?: string;
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  bitrate?: string;
}

/**
 * Optional user constraints steering a recommendation.
 * @interface ConversionConstraints
 * @property {number} [maxBytes] - Hard output size ceiling in bytes.
 * @property {string} [targetDevice] - Target device/ecosystem (e.g. 'iphone').
 * @property {string} [platform] - Target platform (e.g. 'youtube').
 * @property {number} [maxWidth] - Maximum output width in pixels.
 * @property {number} [maxHeight] - Maximum output height in pixels.
 */
export interface ConversionConstraints {
  maxBytes?: number;
  targetDevice?: string;
  platform?: string;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * A typed conversion plan: the exact `convert_media` arguments the engine can
 * run, plus the reasoning a human reviews before approving.
 * @interface RecommendedSettings
 * @property {Record<string, unknown>} args - `convert_media`-shaped arguments.
 * @property {string} [profileId] - Built-in profile the plan was derived from.
 * @property {string[]} rationale - Human-readable reasons, one per line.
 * @property {number} confidence - Model confidence in [0, 1].
 * @property {AIProviderId} providerId - Provider that produced the plan.
 * @property {true} isEstimated - Plans are proposals, never measured facts.
 */
export interface RecommendedSettings {
  args: Record<string, unknown>;
  profileId?: string;
  rationale: string[];
  confidence: number;
  providerId: AIProviderId;
  isEstimated: true;
}

/**
 * Input envelope for a provider planning request (grounding, not guessing).
 * @interface PlanRequest
 * @property {string} input - Absolute input path.
 * @property {string} intent - The user's natural-language goal.
 * @property {MediaFacts} facts - Structured facts the provider may read.
 * @property {ConversionProfile[]} profiles - Built-in profiles to select from.
 * @property {EncoderCapabilities} capabilities - Detected encoder capabilities.
 * @property {ConversionConstraints} [constraints] - Optional hard constraints.
 */
export interface PlanRequest {
  input: string;
  intent: string;
  facts: MediaFacts;
  profiles: ConversionProfile[];
  capabilities: EncoderCapabilities;
  constraints?: ConversionConstraints;
}

/**
 * A provider-agnostic planner. Implementations must not leak provider SDK
 * types past this boundary and must return a plan re-validated against Zod
 * before anything runs.
 * @interface AIProvider
 * @property {AIProviderDescriptor} descriptor - Public provider description.
 * @property {function(PlanRequest): Promise<RecommendedSettings>} plan - Plans.
 */
export interface AIProvider {
  readonly descriptor: AIProviderDescriptor;
  plan(request: PlanRequest): Promise<RecommendedSettings>;
}

/**
 * Machine-readable output-size/time estimate (roadmap §4.2, D4 no. 3).
 * @interface ConversionEstimate
 * @property {true} isEstimated - Always true: estimates are never asserted.
 * @property {'bitrate'} method - The only estimation method currently used.
 * @property {number} estimatedSizeBytes - Estimated output size in bytes.
 * @property {number} estimatedDurationSeconds - Duration the estimate covers.
 * @property {number} videoBitrateKbps - Video bitrate used, in kbps.
 * @property {number} audioBitrateKbps - Audio bitrate used, in kbps.
 * @property {boolean} copy - Whether the plan is a lossless stream copy.
 * @property {{ available: boolean; methods: string[] }} hardwareAcceleration -
 *   Detected hardware-encoder availability.
 * @property {string[]} notes - Assumptions and caveats for the estimate.
 */
export interface ConversionEstimate {
  isEstimated: true;
  method: 'bitrate';
  estimatedSizeBytes: number;
  estimatedDurationSeconds: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  copy: boolean;
  hardwareAcceleration: { available: boolean; methods: string[] };
  notes: string[];
}

/**
 * Output constraints checked by {@link ValidationResult}.
 * @interface ValidationExpectations
 * @property {number} [maxBytes] - Maximum allowed output size in bytes.
 * @property {string} [minResolution] - Minimum video resolution (`WxH`).
 * @property {string} [codec] - Required video codec (e.g. 'h264').
 * @property {string} [container] - Required container/format substring.
 * @property {boolean} [hasAudio] - Require an audio stream.
 * @property {boolean} [hasVideo] - Require a video stream.
 * @property {number} [minDurationSeconds] - Minimum duration in seconds.
 * @property {number} [maxDurationSeconds] - Maximum duration in seconds.
 */
export interface ValidationExpectations {
  maxBytes?: number;
  minResolution?: string;
  codec?: string;
  container?: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
}

/**
 * One pass/fail constraint check.
 * @interface ValidationCheck
 * @property {string} name - Stable check id.
 * @property {boolean} passed - Whether the constraint was satisfied.
 * @property {string} [expected] - Human-readable expectation.
 * @property {string} [actual] - Human-readable actual value.
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

/**
 * Result of re-probing an output and checking it against expectations. This is
 * what makes "validate before claiming success" real (roadmap §6).
 * @interface ValidationResult
 * @property {boolean} passed - True only when every check passed.
 * @property {ValidationCheck[]} checks - Per-constraint results.
 * @property {MediaFacts} observed - Facts from the re-probe.
 */
export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  observed: MediaFacts;
}

/**
 * Severity of one analysis finding.
 * @typedef {('info' | 'warning' | 'error')} AnalysisSeverity
 */
export type AnalysisSeverity = 'info' | 'warning' | 'error';

/**
 * One structured diagnosis finding.
 * @interface AnalysisFinding
 * @property {AnalysisSeverity} severity - How much it matters.
 * @property {string} code - Stable machine-readable code.
 * @property {string} message - Plain-language explanation.
 */
export interface AnalysisFinding {
  severity: AnalysisSeverity;
  code: string;
  message: string;
}

/**
 * Structured, plain-language diagnosis of a media file (roadmap §4.2).
 * @interface MediaAnalysis
 * @property {string} file - Absolute input path.
 * @property {string} format - Container/format name.
 * @property {string} summary - One-sentence human summary.
 * @property {MediaFacts} facts - The structured facts powering the diagnosis.
 * @property {AnalysisFinding[]} findings - Ordered findings.
 * @property {string[]} recommendations - Suggested next steps.
 */
export interface MediaAnalysis {
  file: string;
  format: string;
  summary: string;
  facts: MediaFacts;
  findings: AnalysisFinding[];
  recommendations: string[];
}

/**
 * The type a {@link MediaInfo} probe is reduced to; re-exported for convenience.
 * @typedef {MediaInfo} ProbedMediaInfo
 */
export type ProbedMediaInfo = MediaInfo;

/* ---------------------------------------------------------------- advisor */
/**
 * The advisor's recommendation plus the reasoning behind it.
 * @interface EncodingAdvice
 * @property {string} sourceCodecFamily - Normalized source codec family.
 * @property {string} recommendedVideoCodec - Encoder to use (software or GPU).
 * @property {boolean} useHardware - Whether a GPU encoder is recommended.
 * @property {string} [hardwareMethod] - The chosen hardware method, when used.
 * @property {string[]} rationale - Human-readable reasons, one per line.
 * @property {AnalysisFinding[]} findings - Ordered, plain-language findings.
 * @property {string[]} notes - Assumptions and caveats.
 * @property {{ available: boolean; methods: string[] }} hardware - Availability.
 */
export interface EncodingAdvice {
  sourceCodecFamily: string;
  recommendedVideoCodec: string;
  useHardware: boolean;
  hardwareMethod?: string;
  rationale: string[];
  findings: AnalysisFinding[];
  notes: string[];
  hardware: { available: boolean; methods: string[] };
}

/* ---------------------------------------------------------------- agent */
/**
 * One planned conversion the agent would run.
 * @interface AgentAction
 * @property {string} id - Workflow step id for this action.
 * @property {string} input - Source file path.
 * @property {string} [output] - Explicit output path, when one was derived.
 * @property {string} [profileId] - Built-in profile the settings came from.
 * @property {number} confidence - Planner confidence in `[0, 1]`.
 * @property {string[]} rationale - Why this action was planned.
 * @property {number} [estimatedSizeBytes] - Estimated output size.
 * @property {number} estimatedSavings - Estimated size change as a fraction.
 */
export interface AgentAction {
  id: string;
  input: string;
  output?: string;
  profileId?: string;
  confidence: number;
  rationale: string[];
  estimatedSizeBytes?: number;
  estimatedSavings: number;
}

/**
 * A file the agent deliberately did not plan, with the reason.
 * @interface AgentSkip
 * @property {string} input - Source file path.
 * @property {string} reason - Why it was skipped.
 */
export interface AgentSkip {
  input: string;
  reason: string;
}

/**
 * Tuning for {@link planAgent}.
 * @interface AgentOptions
 * @property {number} [maxFiles] - Upper bound on planned actions (default 50).
 * @property {number} [minSavings] - Minimum estimated size reduction (fraction
 *   in `[0, 1]`) required to keep an action; only applied when the plan carries
 *   an explicit target bitrate (a CRF-only plan cannot be sized honestly).
 */
export interface AgentOptions {
  maxFiles?: number;
  minSavings?: number;
}

/**
 * The agent planning request: a goal plus grounded facts for every file.
 * @interface AgentRequest
 * @property {string} intent - The natural-language goal shared by every file.
 * @property {MediaFacts[]} files - Structured facts for the candidate files.
 * @property {ConversionProfile[]} profiles - Built-in profiles to choose from.
 * @property {EncoderCapabilities} capabilities - Detected encoder capabilities.
 * @property {ConversionConstraints} [constraints] - Optional hard constraints.
 * @property {AgentOptions} [options] - Tuning.
 * @property {(facts: MediaFacts, index: number) => string} [resolveOutput] -
 *   Supplies each action's output path (the MCP layer derives these).
 * @property {(request: PlanRequest) => Promise<RecommendedSettings>} [planner] -
 *   Optional async planner (an LLM provider). Defaults to the deterministic,
 *   offline {@link recommendSettings}, so behavior is unchanged when omitted.
 */
export interface AgentRequest {
  intent: string;
  files: MediaFacts[];
  profiles: ConversionProfile[];
  capabilities: EncoderCapabilities;
  constraints?: ConversionConstraints;
  options?: AgentOptions;
  resolveOutput?: (facts: MediaFacts, index: number) => string;
  planner?: (request: PlanRequest) => Promise<RecommendedSettings>;
}

/**
 * The planned agent run: the actions, the skips, and a runnable workflow.
 * @interface AgentPlan
 * @property {string} goal - The intent the plan was built for.
 * @property {AgentAction[]} actions - Planned conversions, in file order.
 * @property {AgentSkip[]} skips - Files left out, with reasons.
 * @property {Workflow} workflow - A validated, runnable workflow of the actions.
 * @property {string[]} rationale - Plan-level reasons, one per line.
 * @property {string[]} notes - Caveats for the caller.
 * @property {true} isEstimated - The plan is a proposal, not a measurement.
 */
export interface AgentPlan {
  goal: string;
  actions: AgentAction[];
  skips: AgentSkip[];
  workflow: Workflow;
  rationale: string[];
  notes: string[];
  isEstimated: true;
}

/* ---------------------------------------------------------------- analyze */
/**
 * Which lens the analysis is framed through.
 * @typedef {('compat' | 'quality' | 'size')} AnalysisFocus
 */
export type AnalysisFocus = 'compat' | 'quality' | 'size';

/* ---------------------------------------------------------------- chapters */
/**
 * A generated chapter.
 * @interface Chapter
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {string} title - Generated title.
 */
export interface Chapter {
  start: number;
  end: number;
  title: string;
}

/**
 * Tuning for {@link generateChapters}.
 * @interface ChapterOptions
 * @property {number} [minChapterSeconds] - Shortest allowed chapter before a pause can split (default 45).
 * @property {number} [maxChapterSeconds] - Hard cap that forces a split even without a pause (default 300).
 * @property {number} [gapSeconds] - Silence gap that marks a topic boundary (default 2.5).
 * @property {number} [maxChapters] - Upper bound; extra chapters are merged (default 20).
 * @property {number} [maxKeywords] - Keywords per title (default 4).
 */
export interface ChapterOptions {
  minChapterSeconds?: number;
  maxChapterSeconds?: number;
  gapSeconds?: number;
  maxChapters?: number;
  maxKeywords?: number;
}

/* ---------------------------------------------------------------- connect-error */
/**
 * The canonical reasons a connectivity test can fail. `offline` and `noKey`
 * are decided by the caller (they never reach a provider); `noModel` is decided
 * when no model could be resolved (neither configured nor reported by the
 * provider); the rest come from a provider response or a transport failure.
 * @typedef {('invalidKey' | 'forbidden' | 'modelNotFound' | 'notFound' |
 *   'rateLimit' | 'quota' | 'badRequest' | 'serverError' | 'timeout' |
 *   'network' | 'emptyResponse' | 'noKey' | 'noModel' | 'offline' | 'unknown')} AiConnectErrorReason
 */
export type AiConnectErrorReason =
  | 'invalidKey'
  | 'forbidden'
  | 'modelNotFound'
  | 'notFound'
  | 'rateLimit'
  | 'quota'
  | 'badRequest'
  | 'serverError'
  | 'timeout'
  | 'network'
  | 'emptyResponse'
  | 'noKey'
  | 'noModel'
  | 'offline'
  | 'unknown';

/**
 * The classified outcome of a failed connection test.
 * @interface AiConnectErrorInfo
 * @property {AiConnectErrorReason} reason - The canonical failure reason.
 * @property {number} [status] - The HTTP status, when the provider answered.
 */
export interface AiConnectErrorInfo {
  reason: AiConnectErrorReason;
  status?: number;
}

/**
 * The normalized fields pulled out of a provider error body, regardless of the
 * provider's envelope shape.
 * @interface ProviderErrorFields
 * @property {string} [type] - OpenAI/Anthropic error type.
 * @property {string | number} [code] - OpenAI string code or Gemini numeric code.
 * @property {string} [status] - Gemini canonical status string.
 * @property {string} [message] - The provider's human message.
 */
export interface ProviderErrorFields {
  type?: string;
  code?: string | number;
  status?: string;
  message?: string;
}

/* ---------------------------------------------------------------- connector */
/**
 * One message in a connector conversation. Only `system` and `user` roles are
 * used: the model is asked once, with no follow-up turns.
 * @interface ConnectorMessage
 * @property {('system'|'user')} role - The message role.
 * @property {string} content - The message text.
 */
export interface ConnectorMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * A provider-neutral completion request.
 * @interface ConnectorRequest
 * @property {ConnectorMessage[]} messages - The conversation.
 * @property {boolean} [jsonMode] - Ask the provider for strict JSON output when
 *   its API supports it (OpenAI `response_format`, Gemini `responseMimeType`,
 *   Anthropic prefill). Providers that cannot honor it fall back to parsing.
 * @property {number} [temperature] - Sampling temperature; defaults to 0.
 * @property {AbortSignal} [signal] - Cancellation/timeout signal.
 */
export interface ConnectorRequest {
  messages: ConnectorMessage[];
  jsonMode?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * A provider-neutral completion response.
 * @interface ConnectorResponse
 * @property {string} text - The model's raw text reply.
 * @property {string} model - The model id the provider actually used.
 */
export interface ConnectorResponse {
  text: string;
  model: string;
}

/**
 * The identifier a connector reports. It matches an {@link AIProviderId} except
 * for the OpenAI-compatible adapter, which uses the dedicated id below.
 * @typedef {AIProviderId | 'openai-compatible'} ConnectorId
 */
export type ConnectorId = AIProviderId | 'openai-compatible';

/**
 * A stateless text-completion transport for one AI service.
 *
 * A connector carries no built-in model: the model id always comes from the
 * user's configuration (or, when they left it blank, from the provider's own
 * model list), so no model name is ever hardcoded in the app.
 * @interface AIConnector
 * @property {ConnectorId} id - The provider id this connector speaks.
 * @property {function(ConnectorRequest): Promise<ConnectorResponse>} complete -
 *   Sends the conversation and resolves the reply.
 */
export interface AIConnector {
  readonly id: ConnectorId;
  complete(request: ConnectorRequest): Promise<ConnectorResponse>;
}

/* ---------------------------------------------------------------- edit */
/**
 * A structured editing intent. The model maps free text ("cut the sponsor
 * intro") onto one of these kinds; every kind resolves to a single keep-range.
 * @typedef {object} EditIntent
 */
export type EditIntent =
  | { kind: 'remove-intro'; maxSeconds?: number }
  | { kind: 'remove-outro'; maxSeconds?: number }
  | { kind: 'remove-silence'; minGapSeconds?: number }
  | { kind: 'keep-range'; start: number; end: number }
  | { kind: 'keep-first'; seconds: number }
  | { kind: 'keep-last'; seconds: number };

/**
 * The evidence an intent is resolved against. A transcript and/or scene
 * boundaries sharpen the result; a bare `durationSeconds` is always required.
 * @interface EditContext
 * @property {number} durationSeconds - Source duration in seconds.
 * @property {Transcript} [transcript] - Optional speech timing.
 * @property {SceneBoundary[]} [scenes] - Optional scene boundaries.
 */
export interface EditContext {
  durationSeconds: number;
  transcript?: Transcript;
  scenes?: SceneBoundary[];
}

/**
 * A resolved edit: the keep span and the `cut_video` arguments that produce it.
 * @interface EditPlan
 * @property {EditIntent} intent - The intent that was resolved.
 * @property {boolean} valid - False when the span could not be determined.
 * @property {number} start - Keep-span start in seconds.
 * @property {number} end - Keep-span end in seconds.
 * @property {number} duration - Keep-span duration in seconds.
 * @property {Record<string, unknown>} args - `cut_video` arguments.
 * @property {string[]} rationale - Human-readable explanations.
 * @property {string[]} issues - Problems that made the plan invalid.
 * @property {string[]} notes - Caveats that do not block the plan.
 */
export interface EditPlan {
  intent: EditIntent;
  valid: boolean;
  start: number;
  end: number;
  duration: number;
  args: Record<string, unknown>;
  rationale: string[];
  issues: string[];
  notes: string[];
}

/* ---------------------------------------------------------------- error-explain */
/**
 * How a suggested fix behaves when clicked.
 * - `retry`  — re-runs the same operation unchanged;
 * - `switch` — re-runs the operation with patched arguments;
 * - `info`   — guidance only, no tool call.
 * @typedef {('retry' | 'switch' | 'info')} ErrorFixKind
 */
export type ErrorFixKind = 'retry' | 'switch' | 'info';

/**
 * One suggested remedy for a failure.
 * @interface ErrorFix
 * @property {ErrorFixKind} kind - How the fix behaves.
 * @property {string} label - Short button/label text.
 * @property {string} description - One-sentence explanation.
 * @property {string} [tool] - Tool to call for `retry`/`switch` fixes.
 * @property {Record<string, unknown>} [args] - Arguments for the tool call.
 */
export interface ErrorFix {
  kind: ErrorFixKind;
  label: string;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/**
 * The plain-language explanation of a failure.
 * @interface ErrorExplanation
 * @property {ErrorCodeType} code - The resolved application error code.
 * @property {string} title - Short human title.
 * @property {string} explanation - Canonical human message.
 * @property {string} [detail] - Technical detail preserved from the failure.
 * @property {string[]} causes - Common causes, most likely first.
 * @property {ErrorFix[]} fixes - Suggested remedies.
 * @property {{ tool: string; args: Record<string, unknown> }} [retry] - The
 *   default retry action when a plain retry is possible.
 */
export interface ErrorExplanation {
  code: ErrorCodeType;
  title: string;
  explanation: string;
  detail?: string;
  causes: string[];
  fixes: ErrorFix[];
  retry?: { tool: string; args: Record<string, unknown> };
}

/**
 * Input accepted by {@link explainError}. At least one of `code`, `message` or
 * `detail` should be provided; `tool`/`args` enable argument-patching fixes.
 * @interface ExplainErrorInput
 * @property {string} [code] - A known error code.
 * @property {string} [message] - Raw failure message (code inferred when needed).
 * @property {string} [detail] - Extra technical detail.
 * @property {string} [input] - The input file the operation ran on, when known.
 * @property {string} [tool] - The tool that failed (for `switch` fixes).
 * @property {Record<string, unknown>} [args] - The arguments that failed.
 */
export interface ExplainErrorInput {
  code?: string;
  message?: string;
  detail?: string;
  input?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/* ---------------------------------------------------------------- estimate */
/**
 * The subset of conversion arguments that affect the estimate.
 * @interface EstimateConversionInput
 * @property {string} [videoBitrate] - Target video bitrate (e.g. '2000k').
 * @property {string} [audioBitrate] - Target audio bitrate (e.g. '192k').
 * @property {string} [duration] - Trim duration (limits the output length).
 * @property {boolean} [copy] - Lossless stream copy (no re-encode).
 * @property {boolean} [audio] - Include audio (false drops it).
 * @property {boolean} [video] - Include video (false drops it).
 */
export interface EstimateConversionInput {
  videoBitrate?: string;
  audioBitrate?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
}

/* ---------------------------------------------------------------- folder */
/**
 * One projected file in a library report.
 * @interface LibraryRow
 * @property {string} input - Absolute path of the source file.
 * @property {number} sourceBytes - Current file size in bytes.
 * @property {number} estimatedBytes - Projected size after the recommended encode.
 * @property {number} savingsBytes - `sourceBytes - estimatedBytes` (may be negative).
 * @property {number} savingsPercent - Signed savings as a whole-number percentage.
 * @property {number} [targetBytes] - The per-file ceiling the projection aimed at.
 * @property {string} [profileId] - Built-in profile used, when applicable.
 * @property {string} [error] - Why the file could not be projected.
 */
export interface LibraryRow {
  input: string;
  sourceBytes: number;
  estimatedBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  targetBytes?: number;
  profileId?: string;
  error?: string;
}

/**
 * The folder-level savings roll-up.
 * @interface LibrarySummary
 * @property {true} isEstimated - Always true: projections, not measurements.
 * @property {number} fileCount - Number of rows considered.
 * @property {number} analyzedCount - Rows with a usable projection.
 * @property {number} errorCount - Rows that could not be projected.
 * @property {number} totalSourceBytes - Sum of analyzable source sizes.
 * @property {number} totalEstimatedBytes - Sum of projected sizes.
 * @property {number} totalSavingsBytes - `totalSourceBytes - totalEstimatedBytes`.
 * @property {number} savingsPercent - Signed savings as a whole-number percentage.
 * @property {LibraryRow[]} largest - Up to five rows with the biggest byte savings.
 * @property {string[]} notes - Assumptions and caveats.
 */
export interface LibrarySummary {
  isEstimated: true;
  fileCount: number;
  analyzedCount: number;
  errorCount: number;
  totalSourceBytes: number;
  totalEstimatedBytes: number;
  totalSavingsBytes: number;
  savingsPercent: number;
  largest: LibraryRow[];
  notes: string[];
}

/* ---------------------------------------------------------------- highlight */
/**
 * One sampled frame: a seek offset and, when decodable, its perceptual hash.
 * @interface SampledFrame
 * @property {number} atSeconds - Offset of the frame in the media.
 * @property {string} [hash] - Hex perceptual hash, when the frame was sampled.
 */
export interface SampledFrame {
  atSeconds: number;
  hash?: string;
}

/**
 * A detected scene change: the offset where a new scene begins.
 * @interface SceneBoundary
 * @property {number} atSeconds - Boundary offset in seconds.
 * @property {number} change - Normalized change magnitude in `[0, 1]`.
 */
export interface SceneBoundary {
  atSeconds: number;
  change: number;
}

/**
 * A suggested highlight span.
 * @interface HighlightSpan
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {number} score - Relative interestingness in `[0, 1]`.
 * @property {string} reason - Why the span was picked.
 */
export interface HighlightSpan {
  start: number;
  end: number;
  score: number;
  reason: string;
}

/**
 * A suggested thumbnail frame.
 * @interface ThumbnailCandidate
 * @property {number} atSeconds - Frame offset in seconds.
 * @property {number} score - Distinctiveness in `[0, 1]`.
 * @property {string} reason - Why the frame was picked.
 */
export interface ThumbnailCandidate {
  atSeconds: number;
  score: number;
  reason: string;
}

/**
 * The full frame analysis.
 * @interface HighlightReport
 * @property {'hash' | 'time'} method - Whether frame hashes drove the result.
 * @property {number} framesSampled - Number of frames with a usable hash.
 * @property {SceneBoundary[]} scenes - Detected scene boundaries (by time).
 * @property {HighlightSpan[]} highlights - Ranked highlight spans (by time).
 * @property {ThumbnailCandidate[]} thumbnails - Suggested thumbnail frames.
 * @property {string[]} notes - Caveats for the caller.
 */
export interface HighlightReport {
  method: 'hash' | 'time';
  framesSampled: number;
  scenes: SceneBoundary[];
  highlights: HighlightSpan[];
  thumbnails: ThumbnailCandidate[];
  notes: string[];
}

/**
 * Tuning for {@link analyzeFrames}.
 * @interface FrameAnalysisOptions
 * @property {number} [durationSeconds] - Media duration; defaults to the last frame.
 * @property {number} [sceneThreshold] - Change fraction that opens a scene (default 0.15).
 * @property {number} [maxHighlights] - Maximum highlight spans (default 5).
 * @property {number} [maxThumbnails] - Maximum thumbnail frames (default 6).
 */
export interface FrameAnalysisOptions {
  durationSeconds?: number;
  sceneThreshold?: number;
  maxHighlights?: number;
  maxThumbnails?: number;
}

/* ---------------------------------------------------------------- llm */
/**
 * A routed operation: the operation to run plus the fields the deterministic
 * builder should use.
 * @interface RoutedOperation
 * @property {CopilotOperation} operation - The chosen operation.
 * @property {Record<string, unknown>} fields - Operation-specific fields.
 * @property {string[]} rationale - Why the operation was chosen.
 * @property {number} confidence - Confidence in `[0, 1]`.
 * @property {AIProviderId} providerId - The provider that routed it.
 */
export interface RoutedOperation {
  operation: CopilotOperation;
  fields: Record<string, unknown>;
  rationale: string[];
  confidence: number;
  providerId: AIProviderId;
}

/**
 * The inputs an operation router needs to choose an operation.
 * @interface OperationRoutingRequest
 * @property {string} goal - The user's natural-language goal.
 * @property {CopilotOperation | null} operation - A forced operation, or null.
 * @property {MediaFacts[]} files - Structured facts for the candidate files.
 * @property {ConversionProfile[]} profiles - Built-in profiles to choose from.
 * @property {EncoderCapabilities} capabilities - Detected encoders.
 */
export interface OperationRoutingRequest {
  goal: string;
  operation: CopilotOperation | null;
  files: MediaFacts[];
  profiles: ConversionProfile[];
  capabilities: EncoderCapabilities;
}

/* ---------------------------------------------------------------- provider */
/**
 * Minimal text-generation transport a local model runtime must provide. Keeping
 * it to a single `generate(prompt)` call lets the provider stay transport-free
 * (the HTTP/Ollama adapter lives in `src/mcp`), so it is trivially fakeable in
 * tests.
 * @interface LocalModelClient
 * @property {(prompt: string) => Promise<string>} generate - Returns the model's raw text.
 */
export interface LocalModelClient {
  generate(prompt: string): Promise<string>;
}

/* ---------------------------------------------------------------- quality */
/**
 * The outcome of comparing a source and its output.
 * @interface QualityReport
 * @property {boolean} passed - True only when every check passed.
 * @property {string} summary - One-sentence human summary.
 * @property {ValidationCheck[]} checks - Per-constraint results.
 * @property {AnalysisFinding[]} findings - Ordered, plain-language findings.
 * @property {MediaFacts} source - Source facts from the probe.
 * @property {MediaFacts} output - Output facts from the re-probe.
 */
export interface QualityReport {
  passed: boolean;
  summary: string;
  checks: ValidationCheck[];
  findings: AnalysisFinding[];
  source: MediaFacts;
  output: MediaFacts;
}

/* ---------------------------------------------------------------- recommend */
/**
 * Signals mined from a natural-language intent and optional constraints.
 * @interface IntentSignals
 * @property {ProfileCategory[]} categories - Profile categories the intent points at.
 * @property {string[]} profileHints - Profile-id prefixes the intent names (e.g. 'iphone').
 * @property {string[]} codecs - Codec families requested (h264, hevc, av1, vp9, vp8).
 * @property {string[]} containers - Container names requested.
 * @property {number} [targetClass] - Requested resolution class (long edge in px).
 * @property {boolean} audioOnly - The intent is to extract audio.
 * @property {boolean} copyOnly - The intent asks for a lossless/remux-style copy.
 * @property {boolean} wantsSmall - The intent prioritises small file size.
 * @property {boolean} wantsQuality - The intent prioritises quality.
 */
export interface IntentSignals {
  categories: ProfileCategory[];
  profileHints: string[];
  codecs: string[];
  containers: string[];
  targetClass?: number;
  audioOnly: boolean;
  copyOnly: boolean;
  wantsSmall: boolean;
  wantsQuality: boolean;
}

/* ---------------------------------------------------------------- settings */
/**
 * One provider's own configuration (API key, model, endpoint). Kept separate
 * from {@link AiServerSettings}'s flat fields so every provider remembers its
 * own key instead of sharing a single global one.
 * @interface AiProviderConfig
 * @property {string} model - The model id (empty means "not chosen yet": the
 *   app resolves one from the provider's own model list).
 * @property {string} [baseUrl] - OpenAI-compatible base URL override.
 * @property {string | null} key - Encrypted (base64) key, or null when unset.
 * @property {number} [keySetAt] - Epoch ms the key was last set.
 * @property {boolean} [storedInsecurely] - True when the key is plaintext
 *   because `safeStorage` was unavailable and the user accepted the risk.
 */
export interface AiProviderConfig {
  model: string;
  baseUrl?: string;
  key: string | null;
  keySetAt?: number;
  storedInsecurely?: boolean;
}

/**
 * The single active connection: which provider answered the last successful
 * connectivity test and with which model. Independent of the *selected*
 * provider, so switching the editor's selection never clears it.
 * @interface AiActiveConnection
 * @property {AIProviderId} providerId - The provider that answered.
 * @property {string} [model] - The model that answered.
 * @property {number} at - Epoch ms of the successful test.
 */
export interface AiActiveConnection {
  providerId: AIProviderId;
  model?: string;
  at: number;
}

/**
 * The persisted AI settings document (written to `userData/ai-settings.json`).
 *
 * The flat fields always describe the **selected** provider so existing
 * consumers (`decryptApiKey`, `effectiveModel`, `createConnectorFromSettings`)
 * keep working unchanged. Every *other* provider's config lives in
 * {@link AiServerSettings.providers}; the selected provider is never duplicated
 * there, and the connection pointer below is global (one active connection).
 *
 * `providerId` is the **active** provider (the one the Copilot plans with),
 * while {@link AiServerSettings.selectedProviderId} is the provider the user
 * last picked in the Settings editor. The two are kept apart so browsing to
 * another provider never silently changes the active one, while the editor can
 * still restore the tile the user left selected on the next start.
 * @interface AiServerSettings
 * @property {AIProviderId} providerId - The active provider.
 * @property {string} model - The model id (empty means "not chosen yet": the
 *   app resolves one from the provider's own model list).
 * @property {string} [baseUrl] - OpenAI-compatible base URL override.
 * @property {string | null} key - Encrypted (base64) key, or null when unset.
 * @property {number} [keySetAt] - Epoch ms the key was last set.
 * @property {boolean} [storedInsecurely] - True when the key is plaintext
 *   because `safeStorage` was unavailable and the user accepted the risk.
 * @property {Partial<Record<AIProviderId, AiProviderConfig>>} [providers] -
 *   Configs of the providers that are *not* active.
 * @property {AIProviderId} [selectedProviderId] - The provider the user last
 *   selected in the Settings editor. Restored on the next start so the
 *   previously selected (and connected) provider is auto-selected.
 * @property {number} [connectedAt] - Epoch ms of the last successful connection
 *   test. Cleared only when the connected provider's own config changes.
 * @property {AIProviderId} [connectedProvider] - The provider verified by the
 *   last successful test.
 * @property {string} [connectedModel] - The model that answered the last
 *   successful test.
 */
export interface AiServerSettings {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  key: string | null;
  keySetAt?: number;
  storedInsecurely?: boolean;
  providers?: Partial<Record<AIProviderId, AiProviderConfig>>;
  selectedProviderId?: AIProviderId;
  connectedAt?: number;
  connectedProvider?: AIProviderId;
  connectedModel?: string;
}

/**
 * A non-secret summary of one provider's stored config, so the renderer can
 * show the correct saved-key/model/endpoint for a provider the user selects in
 * the editor without a round-trip (the selected provider's own config is the
 * flat {@link AiSettingsView} fields; every other provider is summarized here).
 * @interface AiProviderSummary
 * @property {string} model - The model id (empty means "not chosen yet").
 * @property {string} [baseUrl] - Base URL override, if any.
 * @property {boolean} hasKey - Whether a key is stored for this provider.
 * @property {string} keyHint - A non-secret hint (e.g. `••••••••`).
 * @property {boolean} storedInsecurely - Whether the key is stored in plaintext.
 */
export interface AiProviderSummary {
  model: string;
  baseUrl?: string;
  hasKey: boolean;
  keyHint: string;
  storedInsecurely: boolean;
}

/**
 * The sanitized settings view sent to the renderer (never includes the key).
 * @interface AiSettingsView
 * @property {AIProviderId} providerId - The selected provider.
 * @property {string} model - The model id.
 * @property {string} [baseUrl] - Base URL override, if any.
 * @property {boolean} hasKey - Whether a key is stored.
 * @property {string} keyHint - A non-secret hint (e.g. `•••• 1234`).
 * @property {boolean} storedInsecurely - Whether the key is stored in plaintext.
 * @property {boolean} encryptionAvailable - Whether `safeStorage` is usable.
 * @property {boolean} connected - Whether the stored config passed a connection
 *   test (has a key, and the verified provider matches the selected provider).
 * @property {number} [connectedAt] - Epoch ms of the successful test, when connected.
 * @property {string} [connectedModel] - The verified model, when connected.
 * @property {AiActiveConnection} [activeConnection] - The single active
 *   connection, when one is recorded. Present regardless of which provider is
 *   currently selected, so the UI can show a connection that lives elsewhere.
 * @property {AIProviderId} [selectedProviderId] - The provider the user last
 *   selected in the Settings editor. Always present in a view; it falls back
 *   to `providerId` for documents written before the selection was persisted.
 * @property {Partial<Record<AIProviderId, AiProviderSummary>>} [providerSummaries] -
 *   Non-secret summaries of the providers that are *not* active, so the editor
 *   can show each provider's own saved key/model/endpoint the instant it is
 *   selected, without persisting the selection or a round-trip.
 */
export interface AiSettingsView {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  hasKey: boolean;
  keyHint: string;
  storedInsecurely: boolean;
  encryptionAvailable: boolean;
  connected: boolean;
  connectedAt?: number;
  connectedModel?: string;
  activeConnection?: AiActiveConnection;
  selectedProviderId?: AIProviderId;
  providerSummaries?: Partial<Record<AIProviderId, AiProviderSummary>>;
}

/**
 * The renderer's request to update AI settings.
 * @interface AiSettingsUpdate
 * @property {AIProviderId} providerId - The provider the update targets.
 * @property {string} [model] - The model id.
 * @property {string} [baseUrl] - Base URL override.
 * @property {string} [apiKey] - A new plaintext key to store (encrypted at rest).
 * @property {boolean} [clearKey] - Remove any stored key.
 * @property {boolean} [activate] - Whether the targeted provider becomes the
 *   *active* one (the provider the Copilot plans with). Defaults to true;
 *   `false` applies the change to the targeted provider's own stored config
 *   without touching the active provider (used when the user only browses to
 *   another provider in the editor).
 */
export interface AiSettingsUpdate {
  providerId: AIProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearKey?: boolean;
  activate?: boolean;
}

/**
 * The result of a connectivity test.
 * @interface AiConnectTestResult
 * @property {boolean} ok - Whether the connector answered.
 * @property {string} message - A human message (success detail or a fallback).
 * @property {AiConnectErrorReason} [reason] - The classified failure reason, so
 *   the renderer can show a localized message instead of the raw payload.
 * @property {number} [status] - The provider HTTP status, when it answered.
 * @property {string} [model] - The model that answered, on success.
 * @property {number} [latencyMs] - Round-trip time of the test, on success.
 * @property {AiSettingsView} [view] - The refreshed settings view after a
 *   successful test (the connection is recorded), so the renderer can show the
 *   persisted status without a second round-trip.
 */
export interface AiConnectTestResult {
  ok: boolean;
  message: string;
  reason?: AiConnectErrorReason;
  status?: number;
  model?: string;
  latencyMs?: number;
  view?: AiSettingsView;
}

/**
 * The result of listing the available models from a provider's own API, so the
 * settings editor can offer a live pick-list instead of a hardcoded catalog.
 * @interface AiModelsListResult
 * @property {boolean} ok - Whether the provider answered with a model list.
 * @property {string[]} models - The model ids the provider reported (empty on failure).
 * @property {AiConnectErrorReason} [reason] - The classified failure reason, so the
 *   renderer can show a localized message instead of the raw payload.
 * @property {number} [status] - The provider HTTP status, when it answered.
 */
export interface AiModelsListResult {
  ok: boolean;
  models: string[];
  reason?: AiConnectErrorReason;
  status?: number;
}

/* ---------------------------------------------------------------- similarity */
/**
 * A comparable fingerprint of one media file. Hashes are optional; metadata-only
 * comparison is used when a frame could not be sampled.
 * @interface MediaSignature
 * @property {string} file - The file path.
 * @property {number} [sizeBytes] - File size on disk.
 * @property {number} [durationSeconds] - Media duration.
 * @property {number} [width] - Sampled video width.
 * @property {number} [height] - Sampled video height.
 * @property {string} [hash] - Hex perceptual hash of a sampled frame.
 */
export interface MediaSignature {
  file: string;
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  hash?: string;
}

/**
 * One candidate scored against the subject.
 * @interface SimilarityMatch
 * @property {string} file - The candidate path.
 * @property {number} similarity - Overall score in `[0, 1]`.
 * @property {'duplicate' | 'near-duplicate'} label - Classification at the threshold.
 * @property {number} [hashDistance] - Bit distance when both frames were hashed.
 * @property {number} [durationDeltaSeconds] - Absolute duration difference.
 * @property {boolean} sameResolution - Whether width×height match.
 * @property {string[]} findings - Human-readable observations.
 */
export interface SimilarityMatch {
  file: string;
  similarity: number;
  label: 'duplicate' | 'near-duplicate';
  hashDistance?: number;
  durationDeltaSeconds?: number;
  sameResolution: boolean;
  findings: string[];
}

/**
 * The full similarity report.
 * @interface SimilarityReport
 * @property {string} subject - The reference file.
 * @property {'hash' | 'metadata'} method - Comparison method actually used.
 * @property {number} threshold - Minimum similarity to report.
 * @property {number} compared - Number of candidates compared.
 * @property {SimilarityMatch[]} matches - Ranked candidates above the threshold.
 */
export interface SimilarityReport {
  subject: string;
  method: 'hash' | 'metadata';
  threshold: number;
  compared: number;
  matches: SimilarityMatch[];
}

/**
 * A frame-sampling function: returns a perceptual hash of the frame at
 * `atSeconds` in `file`, or `undefined` when no frame could be sampled (audio
 * only, unsupported container, missing decoder). The MCP server supplies the
 * FFmpeg-backed implementation; tests inject a fake.
 * @typedef {(file: string, atSeconds: number) => Promise<string | undefined>} FrameSampler
 */
export type FrameSampler = (file: string, atSeconds: number) => Promise<string | undefined>;

/**
 * A group of files that are all mutually similar (a dedupe cluster).
 * @interface SimilarityCluster
 * @property {string[]} files - The clustered file paths (sorted).
 * @property {number} similarity - Highest pairwise score in the cluster.
 * @property {'duplicate' | 'near-duplicate'} label - Cluster classification.
 */
export interface SimilarityCluster {
  files: string[];
  similarity: number;
  label: 'duplicate' | 'near-duplicate';
}

/**
 * The result of clustering a set of signatures.
 * @interface ClusterReport
 * @property {'hash' | 'metadata'} method - Comparison method used.
 * @property {number} threshold - Minimum similarity to cluster.
 * @property {number} compared - Number of signatures considered.
 * @property {SimilarityCluster[]} clusters - Clusters of two or more files.
 * @property {SimilarityMatch[]} pairs - All above-threshold pairs, ranked.
 */
export interface ClusterReport {
  method: 'hash' | 'metadata';
  threshold: number;
  compared: number;
  clusters: SimilarityCluster[];
  pairs: SimilarityMatch[];
}

/* ---------------------------------------------------------------- social */
/**
 * One target platform's encoding preset. Resolutions are the platform's
 * recommended upload resolution; the crop is framed from the centre.
 * @interface SocialPreset
 * @property {string} id - Stable preset id (also the workflow step suffix).
 * @property {string} label - Human-readable platform name.
 * @property {number} width - Target width in pixels.
 * @property {number} height - Target height in pixels.
 * @property {string} aspect - Human-readable aspect ratio (e.g. '9:16').
 * @property {number} [maxDurationSeconds] - Platform length cap, when it has one.
 * @property {string} videoCodec - Video encoder for the crop/scale re-encode.
 * @property {number} qscale - Quality scale (1 best - 31 worst) for the encode.
 * @property {string} audioCodec - Audio encoder.
 * @property {string} audioBitrate - Audio bitrate.
 * @property {string} container - Output container extension.
 * @property {string[]} tags - Keywords describing the target.
 */
export interface SocialPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  aspect: string;
  maxDurationSeconds?: number;
  videoCodec: string;
  qscale: number;
  audioCodec: string;
  audioBitrate: string;
  container: string;
  tags: string[];
}

/**
 * One platform clip in a social pack: the target dimensions and the
 * `convert_media`-shaped arguments that produce it.
 * @interface SocialClip
 * @property {string} platform - The preset id.
 * @property {string} label - Human-readable platform name.
 * @property {string} aspect - Aspect ratio label.
 * @property {number} width - Target width.
 * @property {number} height - Target height.
 * @property {number} [maxDurationSeconds] - Applied duration cap, when any.
 * @property {string} container - Output container extension (e.g. 'mp4').
 * @property {string[]} filters - The scale+crop filter chain.
 * @property {Record<string, unknown>} args - `convert_media` arguments.
 * @property {string} rationale - Why the clip is shaped this way.
 */
export interface SocialClip {
  platform: string;
  label: string;
  aspect: string;
  width: number;
  height: number;
  maxDurationSeconds?: number;
  container: string;
  filters: string[];
  args: Record<string, unknown>;
  rationale: string;
}

/**
 * A social pack: the per-platform clips and a ready-to-run workflow.
 * @interface SocialPack
 * @property {string} source - The input file path.
 * @property {SocialClip[]} clips - One clip per requested platform.
 * @property {Workflow} workflow - A validated, runnable workflow of the clips.
 * @property {string} rationale - One-line pack summary.
 * @property {string[]} notes - Caveats for the caller.
 */
export interface SocialPack {
  source: string;
  clips: SocialClip[];
  workflow: Workflow;
  rationale: string;
  notes: string[];
}

/**
 * Options for {@link buildSocialPack}.
 * @interface SocialPackOptions
 * @property {string[]} [platforms] - Preset ids to build; defaults to all.
 * @property {number} [maxDurationSeconds] - Overrides every preset's cap.
 * @property {(clip: SocialClip, index: number) => string} [resolveOutput] -
 *   Supplies each clip's explicit output path (the MCP layer derives these with
 *   the shared naming helper; the pure module never joins paths).
 */
export interface SocialPackOptions {
  platforms?: string[];
  maxDurationSeconds?: number;
  resolveOutput?: (clip: SocialClip, index: number) => string;
}

/* ---------------------------------------------------------------- stt */
/**
 * Options passed through to an STT engine.
 * @interface SttOptions
 * @property {string} [language] - Force the source language (BCP-47 or ISO-639-1).
 * @property {string} [modelPath] - Path to a model file, when the engine needs one.
 * @property {number} [timeoutMs] - Wall-clock budget for the transcription.
 */
export interface SttOptions {
  language?: string;
  modelPath?: string;
  timeoutMs?: number;
}

/**
 * A speech-to-text engine.
 * @interface SttEngine
 * @property {string} id - Stable identifier (e.g. `whisper.cpp`).
 * @property {string} label - Human-readable name.
 * @property {() => Promise<boolean>} available - Whether the engine can run here.
 * @property {(audioPath: string, options?: SttOptions) => Promise<Transcript>} transcribe - Transcribe an audio file.
 */
export interface SttEngine {
  id: string;
  label: string;
  available(): Promise<boolean>;
  transcribe(audioPath: string, options?: SttOptions): Promise<Transcript>;
}

/* ---------------------------------------------------------------- subtitles */
/**
 * Supported subtitle container formats.
 * @typedef {('srt' | 'vtt' | 'ass')} SubtitleFormat
 */
export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

/* ---------------------------------------------------------------- summarize */
/**
 * An extractive summary of a transcript.
 * @interface TranscriptSummary
 * @property {string[]} summary - Selected sentences, in original order.
 * @property {string[]} topics - Most salient keywords.
 * @property {number} wordCount - Total words in the source transcript.
 * @property {number} durationSeconds - Source duration.
 * @property {number} sentenceCount - Number of candidate sentences considered.
 */
export interface TranscriptSummary {
  summary: string[];
  topics: string[];
  wordCount: number;
  durationSeconds: number;
  sentenceCount: number;
}

/**
 * Tuning for {@link summarizeTranscript}.
 * @interface SummaryOptions
 * @property {number} [maxSentences] - Summary length in sentences (default 5).
 * @property {number} [maxTopics] - Number of topics to report (default 8).
 */
export interface SummaryOptions {
  maxSentences?: number;
  maxTopics?: number;
}

/* ---------------------------------------------------------------- target-size */
/**
 * One candidate encode for a size ceiling.
 * @interface TargetSizeCandidate
 * @property {string} id - Stable candidate id ('c1', 'c2', ...).
 * @property {number} videoBitrateKbps - Target video bitrate in kbps.
 * @property {number} audioBitrateKbps - Target audio bitrate in kbps (0 = no audio).
 * @property {number} percentOfBaseline - The candidate as a percent of the size-derived baseline.
 * @property {string} rationale - Why this rung exists in the ladder.
 */
export interface TargetSizeCandidate {
  id: string;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  percentOfBaseline: number;
  rationale: string;
}

/**
 * The deterministic candidate plan for a size ceiling.
 * @interface TargetSizePlan
 * @property {true} isEstimated - Always true: candidates are proposals.
 * @property {'bitrate'} method - The only planning method currently used.
 * @property {number} targetBytes - The requested output-size ceiling.
 * @property {number} durationSeconds - Duration the bitrates are computed over.
 * @property {number} audioBitrateKbps - Audio budget applied to every candidate.
 * @property {number} baselineVideoKbps - The size-derived (100%) video bitrate.
 * @property {TargetSizeCandidate[]} candidates - Ordered high quality -> low.
 * @property {string[]} notes - Assumptions and caveats.
 */
export interface TargetSizePlan {
  isEstimated: true;
  method: 'bitrate';
  targetBytes: number;
  durationSeconds: number;
  audioBitrateKbps: number;
  baselineVideoKbps: number;
  candidates: TargetSizeCandidate[];
  notes: string[];
}

/**
 * Optional tuning for {@link planTargetSizeCandidates}.
 * @interface TargetSizeOptions
 * @property {number} [audioBitrateKbps] - Audio budget override (defaults to 128 when the source has audio).
 * @property {number} [videoFloorKbps] - Lowest usable video bitrate (default 150).
 * @property {number} [videoCeilingKbps] - Highest candidate bitrate (default 25000).
 * @property {number} [maxCandidates] - How many rungs to keep (1-5, default 3).
 * @property {'quality'|'balanced'|'size'} [bias='balanced'] - Which ladder to walk.
 */
export interface TargetSizeOptions {
  audioBitrateKbps?: number;
  videoFloorKbps?: number;
  videoCeilingKbps?: number;
  maxCandidates?: number;
  bias?: 'quality' | 'balanced' | 'size';
}

/* ---------------------------------------------------------------- transcript */
/**
 * One timed span of speech.
 * @interface TranscriptSegment
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds (>= start).
 * @property {string} text - The spoken text.
 * @property {string} [speaker] - Optional speaker label when diarization is available.
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

/**
 * A full transcription of one media file.
 * @interface Transcript
 * @property {string} [language] - Detected/declared language (BCP-47 or ISO-639-1).
 * @property {number} durationSeconds - Length of the covered media.
 * @property {TranscriptSegment[]} segments - Ordered, non-overlapping segments.
 * @property {string} engine - Identifier of the engine that produced it (e.g. `whisper.cpp`).
 */
export interface Transcript {
  language?: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
  engine: string;
}

/* ---------------------------------------------------------------- transcript-search */
/**
 * One matched segment.
 * @interface TranscriptMatch
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {string} text - The segment text.
 * @property {number} score - Relevance score in `(0, 1]`.
 */
export interface TranscriptMatch {
  start: number;
  end: number;
  text: string;
  score: number;
}

/**
 * The result of a transcript search.
 * @interface TranscriptSearchResult
 * @property {string} query - The original query.
 * @property {TranscriptMatch[]} matches - Ranked matches (best first).
 * @property {{ start: number; end: number }} [bestRange] - Span covering the best passage.
 */
export interface TranscriptSearchResult {
  query: string;
  matches: TranscriptMatch[];
  bestRange?: { start: number; end: number };
}

/**
 * Options for {@link searchTranscript}.
 * @interface TranscriptSearchOptions
 * @property {number} [maxMatches] - Maximum matches to return (default 10).
 * @property {number} [minScore] - Discard matches below this score (default 0.34).
 * @property {number} [context] - Extend `bestRange` by this many seconds on each side (default 0).
 */
export interface TranscriptSearchOptions {
  maxMatches?: number;
  minScore?: number;
  context?: number;
}

/* ---------------------------------------------------------------- translate */
/**
 * A translation request over already-timed subtitle segments.
 * @interface TranslationRequest
 * @property {TranscriptSegment[]} segments - Source segments (timing preserved).
 * @property {string} targetLanguage - Target language code.
 * @property {string} [sourceLanguage] - Optional source language hint.
 */
export interface TranslationRequest {
  segments: TranscriptSegment[];
  targetLanguage: string;
  sourceLanguage?: string;
}

/**
 * A subtitle translation backend.
 * @interface TranslationProvider
 * @property {string} id - Stable id.
 * @property {string} label - Human-readable name.
 * @property {DataEgress} dataEgress - What leaves the device.
 * @property {() => Promise<boolean>} available - Whether it can run here.
 * @property {(request: TranslationRequest) => Promise<TranscriptSegment[]>} translate - Translate.
 */
export interface TranslationProvider {
  id: string;
  label: string;
  dataEgress: DataEgress;
  available(): Promise<boolean>;
  translate(request: TranslationRequest): Promise<TranscriptSegment[]>;
}

/**
 * Public description of a translation backend, surfaced in the UI so egress is
 * never a surprise.
 * @interface TranslationProviderDescriptor
 * @property {string} id - Stable id.
 * @property {string} label - Human-readable name.
 * @property {DataEgress} dataEgress - What leaves the device.
 * @property {boolean} local - Whether translation runs on-device.
 * @property {string} note - Privacy/status note.
 */
export interface TranslationProviderDescriptor {
  id: string;
  label: string;
  dataEgress: DataEgress;
  local: boolean;
  note: string;
}

/* ---------------------------------------------------------------- workflow */
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
