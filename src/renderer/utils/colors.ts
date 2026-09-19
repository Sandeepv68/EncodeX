/**
 * @fileoverview Color manipulation helpers for the renderer.
 */

/**
 * True when a hex brand color is too dark to render as a fill in dark mode.
 * Applies the perceptual (Rec. 709) luminance weighting to the RGB channels and
 * flags colors whose weighted sum falls below 40.
 * @param {string} hex - The hex color without alpha, with or without a leading '#'.
 * @returns {boolean} True for near-black colors.
 */
export function isNearBlack(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 40;
}
