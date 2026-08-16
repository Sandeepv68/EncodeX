import type { MediaStreamInfo } from '../../shared/types';

/**
 * @fileoverview Pure formatting helpers for displaying media metadata.
 *
 * Provides locale-independent formatters used across the renderer to turn raw
 * media numbers (byte sizes, seconds, bitrate strings, stream descriptors)
 * into human-readable text for tables, summaries, and progress readouts.
 * All functions are pure and side-effect free.
 */

/**
 * Formats a byte count as a human-readable size string.
 * Values below 1024 bytes are shown as plain bytes; larger values are scaled
 * up through KB/MB/GB/TB with one decimal place.
 * @param {number} bytes - The size in bytes (non-negative).
 * @returns {string} The formatted size, e.g. '2048 B' or '1.5 GB'.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Formats a duration in seconds as a short string with two decimal places.
 * @param {number} seconds - The duration in seconds.
 * @returns {string} The formatted duration, e.g. '12.34s'.
 */
export function formatDuration(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

/**
 * Formats a duration in seconds as a clock time (HH:MM:SS).
 * Milliseconds are included (HH:MM:SS.mmm) when the value has a sub-second
 * remainder; negative inputs are clamped to zero.
 * @param {number} seconds - The duration in seconds.
 * @returns {string} The formatted clock time, e.g. '01:05:09' or '00:00:03.250'.
 */
export function formatClockTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const base = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return ms > 0 ? `${base}.${pad(ms)}` : base;
}

/**
 * Formats a raw bitrate value into a human-readable bitrate string.
 * Numeric bitrate strings (e.g. '1500000') are converted to bps/kbps/Mbps;
 * anything else (e.g. 'N/A' or lossless markers) is returned unchanged.
 * @param {string} bitrate - The raw bitrate value from media metadata.
 * @returns {string} The formatted bitrate, e.g. '1.5 Mbps' or '192k'.
 */
export function formatBitrate(bitrate: string): string {
  if (/^\d+$/.test(bitrate)) {
    const bps = Number(bitrate);
    if (bps >= 1000) {
      const kbps = bps / 1000;
      return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`;
    }
    return `${bps} bps`;
  }
  return bitrate;
}

/**
 * Builds a one-line human-readable summary for a media stream.
 * Includes the stream title (if present), codec, and type-specific details:
 * resolution and frame rate for video streams, channel layout and sample rate
 * for audio streams. The bitrate is appended when available. Parts are joined
 * with ' · '.
 * @param {MediaStreamInfo} stream - The stream descriptor to summarize.
 * @returns {string} The joined summary string.
 */
export function formatStreamSummary(stream: MediaStreamInfo): string {
  const parts: string[] = [];
  const name = stream.title?.trim();
  if (name) parts.push(name);
  parts.push(stream.codec);
  if (stream.type === 'video') {
    if (stream.width != null && stream.height != null) parts.push(`${stream.width}×${stream.height}`);
    if (stream.frameRate) parts.push(`${stream.frameRate} fps`);
    if (stream.bitrate) parts.push(formatBitrate(stream.bitrate));
  } else if (stream.type === 'audio') {
    const layout = typeof stream.channelLayout === 'string' ? stream.channelLayout.trim() : undefined;
    if (layout) parts.push(layout);
    else if (stream.channels != null && stream.channels > 0) parts.push(`${stream.channels} ch`);
    if (stream.sampleRate != null && stream.sampleRate > 0) parts.push(`${Math.round(stream.sampleRate / 1000)} kHz`);
    if (stream.bitrate) parts.push(formatBitrate(stream.bitrate));
  }
  return parts.join(' · ');
}
