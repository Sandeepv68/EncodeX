/**
 * @fileoverview Four-tier safety model for the MCP surface (roadmap §6).
 *
 * EncodeX's invariant is "the model can propose, only the app can commit". This
 * module classifies every tool into a tier, centralizes the argument-safety
 * checks (no shell metacharacters / second commands), and caps batch fan-out so
 * a single call cannot queue an unbounded amount of work.
 */

import { createError, ErrorCode, ERROR_MESSAGES } from '../shared/errors';

/**
 * Safety tiers. Higher tiers require more scrutiny before they run.
 * @const {Object}
 */
export const SAFETY_TIERS = {
  READ: 0,
  PLAN: 1,
  WRITE: 2,
  DESTRUCTIVE: 3,
} as const;

/**
 * A safety tier value.
 * @typedef {(0 | 1 | 2 | 3)} SafetyTier
 */
export type SafetyTier = (typeof SAFETY_TIERS)[keyof typeof SAFETY_TIERS];

/**
 * Safety tier per MCP tool. Unknown tools default to {@link SAFETY_TIERS.READ}
 * (they cannot mutate anything without being listed here).
 * @const {Record<string, SafetyTier>}
 */
export const TOOL_SAFETY_TIERS: Record<string, SafetyTier> = {
  ping: SAFETY_TIERS.READ,
  get_job: SAFETY_TIERS.READ,
  list_jobs: SAFETY_TIERS.READ,
  get_media_info: SAFETY_TIERS.READ,
  analyze_media: SAFETY_TIERS.READ,
  analyze_folder: SAFETY_TIERS.READ,
  estimate_conversion: SAFETY_TIERS.READ,
  validate_output: SAFETY_TIERS.READ,
  quality_report: SAFETY_TIERS.READ,
  advise_encoding: SAFETY_TIERS.READ,
  explain_error: SAFETY_TIERS.READ,
  list_capabilities: SAFETY_TIERS.READ,
  list_profiles: SAFETY_TIERS.READ,
  get_profile: SAFETY_TIERS.READ,
  find_similar_media: SAFETY_TIERS.READ,
  transcribe_media: SAFETY_TIERS.READ,
  translate_subtitles: SAFETY_TIERS.READ,
  generate_chapters: SAFETY_TIERS.READ,
  search_transcript: SAFETY_TIERS.READ,
  summarize_media: SAFETY_TIERS.READ,
  recommend_settings: SAFETY_TIERS.PLAN,
  convert_media: SAFETY_TIERS.WRITE,
  compress_image: SAFETY_TIERS.WRITE,
  extract_audio: SAFETY_TIERS.WRITE,
  cut_video: SAFETY_TIERS.WRITE,
  batch_convert: SAFETY_TIERS.WRITE,
  remux_media: SAFETY_TIERS.WRITE,
  demux_media: SAFETY_TIERS.WRITE,
  compress_to_target: SAFETY_TIERS.WRITE,
  commit_operation: SAFETY_TIERS.WRITE,
};

/**
 * The safety tier for a tool.
 * @param {string} tool - Tool name.
 * @returns {SafetyTier} The tier (READ when unknown).
 */
export function tierForTool(tool: string): SafetyTier {
  return TOOL_SAFETY_TIERS[tool] ?? SAFETY_TIERS.READ;
}

/**
 * Whether a tool mutates files or queue state (tier >= WRITE).
 * @param {string} tool - Tool name.
 * @returns {boolean} True for mutating tools.
 */
export function isMutating(tool: string): boolean {
  return tierForTool(tool) >= SAFETY_TIERS.WRITE;
}

/**
 * Maximum number of files a single `batch_convert` call may expand to.
 * @const {number}
 */
export const MAX_BATCH_FILES = 500;

/**
 * Characters that must never appear in raw FFmpeg output arguments: they only
 * have meaning to a shell, and EncodeX always spawns with argv arrays. Rejecting
 * them is defence-in-depth against a second command or redirection sneaking in.
 * @const {RegExp}
 */
const SHELL_METACHARACTER_RE = /[;&|`$<>\n\r]/;

/**
 * Returns the raw extraArgs that contain shell metacharacters.
 * @param {string[]} [extraArgs] - Raw output arguments.
 * @returns {string[]} The rejected entries (empty when all are safe).
 */
export function findUnsafeExtraArgs(extraArgs?: string[]): string[] {
  if (!extraArgs || extraArgs.length === 0) return [];
  return extraArgs.filter((arg) => SHELL_METACHARACTER_RE.test(String(arg)));
}

/**
 * Throws when any raw extraArg contains a shell metacharacter.
 * @param {string[]} [extraArgs] - Raw output arguments.
 * @returns {void}
 * @throws {AppError} `UNSAFE_ARGUMENTS` When a rejected entry is present.
 */
export function assertSafeExtraArgs(extraArgs?: string[]): void {
  const unsafe = findUnsafeExtraArgs(extraArgs);
  if (unsafe.length > 0) {
    throw createError(ErrorCode.UNSAFE_ARGUMENTS, ERROR_MESSAGES[ErrorCode.UNSAFE_ARGUMENTS], `Rejected extraArgs: ${unsafe.join(', ')}`);
  }
}

/**
 * The size envelope of a batch plan: how many files and how many total bytes.
 * @interface BatchEnvelope
 * @property {number} fileCount - Number of matched files.
 * @property {number} totalBytes - Total input size in bytes.
 */
export interface BatchEnvelope {
  fileCount: number;
  totalBytes: number;
}

/**
 * Whether a freshly-planned batch grew beyond an approved envelope, which
 * requires the user to re-approve before it runs (time-of-check/time-of-use).
 * @param {BatchEnvelope} approved - The envelope the user approved.
 * @param {BatchEnvelope} next - The freshly planned envelope.
 * @returns {boolean} True when the plan grew.
 */
export function batchEnvelopeExceeds(approved: BatchEnvelope, next: BatchEnvelope): boolean {
  return next.fileCount > approved.fileCount || next.totalBytes > approved.totalBytes;
}
