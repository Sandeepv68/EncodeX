/**
 * @fileoverview Generic numeric helpers shared across the main and renderer
 * processes. All functions are pure and DOM-free so either side may import them.
 */

/**
 * Clamps a value to the inclusive `[min, max]` range.
 * @param {number} value - The value to clamp.
 * @param {number} min - The lower bound (inclusive).
 * @param {number} max - The upper bound (inclusive).
 * @returns {number} The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converts a value to a percentage of a total, clamped to 0..100.
 * Returns 0 when the total is not a positive number (guarding division by zero).
 * @param {number} value - The partial value.
 * @param {number} total - The total the value is a part of.
 * @returns {number} The clamped percentage (0-100).
 */
export function toPercent(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return clamp((value / total) * 100, 0, 100);
}
