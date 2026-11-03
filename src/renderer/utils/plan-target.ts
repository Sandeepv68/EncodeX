/**
 * @fileoverview Pure presentation helpers for the Copilot planned-action target
 * summary: codec display names, resolutions, bitrates and containers.
 *
 * The summary shows what an action will encode with, so these helpers turn the
 * raw {@link ConversionOptions} values (`libx264`, `1280x720`, `128k`) into the
 * labels people recognise (`H.264`, `1280×720`, `128 kbps`). Unknown values are
 * returned unchanged rather than guessed, so the card never claims a setting
 * the plan does not actually use.
 */

/** Friendly names for the codecs the planner emits; other values pass through. */
const CODEC_DISPLAY_NAMES: Record<string, string> = {
  libx264: 'H.264',
  h264: 'H.264',
  libx265: 'H.265 / HEVC',
  h265: 'H.265 / HEVC',
  hevc: 'H.265 / HEVC',
  libvpx: 'VP8',
  vp8: 'VP8',
  'libvpx-vp9': 'VP9',
  vp9: 'VP9',
  libaom: 'AV1',
  'libaom-av1': 'AV1',
  libsvtav1: 'AV1',
  av1: 'AV1',
  prores: 'ProRes',
  prores_ks: 'ProRes',
  dnxhd: 'DNxHD',
  dnxhr: 'DNxHR',
  mpeg4: 'MPEG-4',
  'mpeg2video': 'MPEG-2',
  aac: 'AAC',
  ac3: 'AC3',
  eac3: 'E-AC3',
  flac: 'FLAC',
  alac: 'ALAC',
  mp3: 'MP3',
  libmp3lame: 'MP3',
  opus: 'Opus',
  libopus: 'Opus',
  vorbis: 'Vorbis',
  libvorbis: 'Vorbis',
  pcm_s16le: 'PCM',
  pcm_s24le: 'PCM',
};

/**
 * Maps a codec identifier to a friendly name.
 * @param {string | undefined} codec - Raw codec name (e.g. 'libx264').
 * @returns {string | undefined} The display name, or the raw value when unknown.
 */
export function codecDisplayName(codec: string | undefined): string | undefined {
  if (!codec) return undefined;
  const trimmed = codec.trim();
  if (!trimmed) return undefined;
  return CODEC_DISPLAY_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Formats a target resolution from a scale option.
 * Accepts `WxH` (also `W×H` and `W*H`) and percentage scales; anything else is
 * returned as-is so an unusual scale string is still visible in the plan.
 * @param {string | undefined} scale - The action's `scale` option.
 * @returns {string | undefined} e.g. '1280×720', '50%', or undefined when unset.
 */
export function formatTargetResolution(scale: string | undefined): string | undefined {
  const trimmed = scale?.trim();
  if (!trimmed) return undefined;
  const dimensions = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(trimmed);
  if (dimensions) return `${dimensions[1]}×${dimensions[2]}`;
  return trimmed;
}

/**
 * Parses a bitrate option to kbps.
 * Bare numbers follow the planner's convention of being kbps; `k`/`m` suffixes
 * and `bps` spellings are accepted. Invalid or non-positive values yield
 * undefined.
 * @param {string | number | undefined} value - A bitrate option or modelled kbps.
 * @returns {number | undefined} The bitrate in kbps.
 */
function parseKbps(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  const match = /^([\d.]+)\s*([km]?)(?:bps|b\/s)?$/i.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2].toLowerCase();
  return unit === 'm' ? amount * 1000 : amount;
}

/**
 * Formats a bitrate option (or a modelled kbps value) for display.
 * @param {string | number | undefined} value - A bitrate option or modelled kbps.
 * @returns {string | undefined} e.g. '3.1 Mbps', '128 kbps', or undefined.
 */
export function formatTargetBitrate(value: string | number | undefined): string | undefined {
  const kbps = parseKbps(value);
  if (kbps === undefined) return undefined;
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${mbps >= 10 ? Math.round(mbps) : mbps.toFixed(1)} Mbps`;
  }
  return `${Math.round(kbps)} kbps`;
}

/**
 * Derives the target container label from the output path, falling back to the
 * profile's container when the path has no extension.
 * @param {string | undefined} output - The action's output path.
 * @param {string | undefined} fallback - The profile's container (e.g. 'mp4').
 * @returns {string | undefined} The uppercase container label, e.g. 'MP4'.
 */
export function containerDisplayName(output: string | undefined, fallback?: string): string | undefined {
  const match = output ? /\.([a-z0-9]{1,5})$/i.exec(output.trim()) : null;
  const name = match?.[1] ?? fallback?.trim();
  return name ? name.toUpperCase() : undefined;
}
