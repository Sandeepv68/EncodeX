import type { MediaStreamInfo } from '../../shared/types';

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

export function formatDuration(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

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
    const layout = stream.channelLayout?.trim();
    if (layout) parts.push(layout);
    else if (stream.channels != null && stream.channels > 0) parts.push(`${stream.channels} ch`);
    if (stream.sampleRate != null && stream.sampleRate > 0) parts.push(`${Math.round(stream.sampleRate / 1000)} kHz`);
    if (stream.bitrate) parts.push(formatBitrate(stream.bitrate));
  }
  return parts.join(' · ');
}
