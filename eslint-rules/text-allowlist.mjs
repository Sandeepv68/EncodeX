/**
 * @fileoverview Shared exemption allowlists for the `encodex/no-hardcoded-strings`
 * rule. These are the default, centrally-reviewable lists of string values and
 * regex patterns that are permitted to appear as literal English text in the
 * renderer UI without a translation key.
 *
 * This covers two categories:
 *   1. Brand/product names and technical identifiers that should not be localized
 *      (e.g. `EncodeX`, `FFmpeg`, codecs, containers, file formats).
 *   2. Pre-existing UI copy that was intentionally carry-forward exempted on the
 *      rule's rollout (see the progress marker in
 *      `plans/NO_HARDCODED_STRINGS_PLAN.md`).
 *
 * Newly written UI text should always use a translation key; only add entries here
 * when localizing the text genuinely makes no sense. Prefer inline
 * `eslint-disable-next-line encodex/no-hardcoded-strings` for one-off cases.
 */

/** Exact strings always allowed as literal text. */
export const DEFAULT_ALLOW_TEXT = [
  // ExifSection histogram channel labels (carry-forward exemption).
  'Histogram',
  'Red',
  'Green',
  'Blue',
  'Luma',
  // TitleBar window-control aria-labels and the prerelease badge (carry-forward).
  'Beta',
  'Minimize',
  'Restore',
  'Maximize',
  'Close',
  // Units / prefixes.
  's',
  'v',
];

/** Regex patterns allowed as literal text (brands + technical labels). */
export const DEFAULT_ALLOW_PATTERNS = [
  // Brand / product names.
  'EncodeX',
  'FFmpeg',
  // Video codecs.
  'H\\.?\\d+',
  'avc|hevc|vp9|av1|prores|dnxhd|mpeg2',
  // Audio codecs.
  'aac|ac3|eac3|flac|wav|opus|vorbis|mp3|alac|pcm',
  // Containers / formats.
  'mp4|mkv|webm|mov|avi|flv|ts|m4v|m2ts|ogg|ogv|3gp',
  // Image formats.
  'png|jpe?g|gif|bmp|webp|heic|heif|tiff|svg',
  // Subtitle formats.
  'srt|ass|vtt|sub|idx',
  // Color-channel short ids / technical tokens.
  '^(?:r|g|b|luma)$',
];

/** Object property names whose literal values are always exempt. */
export const DEFAULT_ALLOW_PROPS = [
  'id',
  'name',
  'type',
  'format',
  'codec',
  'extension',
  'ext',
  'units',
  'unit',
  'aria-controls',
  'data-testid',
];
