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

import type { ConversionProfile, EncoderCapabilities, MediaInfo } from '../types';

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
