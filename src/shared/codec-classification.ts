export const HARDWARE_ENCODER_SUFFIXES = ['_nvenc', '_qsv', '_amf', '_vaapi', '_videotoolbox', '_mf'] as const;

export function isHardwareVideoCodec(videoCodec?: string): boolean {
  if (!videoCodec) return false;
  return HARDWARE_ENCODER_SUFFIXES.some((suffix) => videoCodec.endsWith(suffix));
}
