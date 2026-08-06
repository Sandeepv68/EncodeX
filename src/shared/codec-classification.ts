/**
 * @fileoverview Classification of video encoders as hardware- or software-based.
 * Used by the main process when probing FFmpeg capabilities and by the renderer
 * when deciding which encoder options to offer. Detection is based purely on the
 * vendor suffix found at the end of the FFmpeg encoder name.
 */

/**
 * Suffixes identifying hardware-accelerated FFmpeg encoders per vendor/API:
 * NVENC (NVIDIA), QSV (Intel), AMF (AMD), VAAPI (Linux), VideoToolbox (macOS),
 * and Media Foundation (Windows).
 * @const {readonly string[]} HARDWARE_ENCODER_SUFFIXES
 */
export const HARDWARE_ENCODER_SUFFIXES = ['_nvenc', '_qsv', '_amf', '_vaapi', '_videotoolbox', '_mf'] as const;

/**
 * Determines whether a video codec name refers to a hardware-accelerated encoder.
 * @param {string} [videoCodec] - The codec or encoder name to test (e.g. 'h264_nvenc').
 * @returns {boolean} True if the name ends with one of the known hardware encoder
 * suffixes; false for undefined/empty input and for software encoders.
 */
export function isHardwareVideoCodec(videoCodec?: string): boolean {
  if (!videoCodec) return false;
  return HARDWARE_ENCODER_SUFFIXES.some((suffix) => videoCodec.endsWith(suffix));
}
