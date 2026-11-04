/**
 * @fileoverview Fixed group types for PostHog group analytics (PD4).
 *
 * Group keys are enums, never user-defined names, so cardinality stays bounded.
 */

/** Allowed profile kinds (built-in profile categories). */
export const PROFILE_KINDS = new Set<string>([
  'general',
  'web',
  'mobile',
  'audio',
  'image',
  'custom',
]);

/** Allowed hardware classes. */
export const HARDWARE_CLASSES = new Set<string>(['cpu', 'gpu_hw', 'gpu_sw']);

/**
 * Coerces a raw profile category into an allowed group key.
 * @param {string | undefined} raw - Candidate category.
 * @returns {string} An allowed profile kind.
 */
export function coerceProfileKind(raw: string | undefined): string {
  if (raw && PROFILE_KINDS.has(raw)) return raw;
  return 'custom';
}

/**
 * Coerces a hardware-acceleration flag into an allowed group key.
 * @param {boolean | undefined} hwAccel - Whether hardware acceleration is on.
 * @returns {string} An allowed hardware class.
 */
export function coerceHardwareClass(hwAccel: boolean | undefined): string {
  if (hwAccel === true) return 'gpu_hw';
  if (hwAccel === false) return 'cpu';
  return 'gpu_sw';
}
