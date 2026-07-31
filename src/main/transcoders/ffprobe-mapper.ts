import { MediaInfo, MediaStreamInfo } from '../../shared/types';

export interface ProbeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  bit_rate?: string | number;
  sample_rate?: string | number;
  channels?: number;
  duration?: string | number;
  tags?: { language?: string };
}

export interface ProbeFormat {
  filename?: string;
  format_name?: string;
  size?: string | number;
  duration?: string | number;
  bit_rate?: string | number;
}

export interface ProbeData {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}

export function parseRatio(ratio: string): string {
  const parts = ratio.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den !== 0) return (num / den).toFixed(2);
  }
  return ratio;
}

export function mapFfprobeData(data: ProbeData, fallbackFile: string): MediaInfo {
  const streams: MediaStreamInfo[] = (data.streams || []).map((s) => ({
    index: s.index ?? 0,
    type: (s.codec_type as MediaStreamInfo['type']) ?? 'video',
    codec: s.codec_name ?? 'unknown',
    codecLong: s.codec_long_name,
    width: s.width,
    height: s.height,
    pixelFormat: s.pix_fmt,
    frameRate: s.r_frame_rate ? parseRatio(s.r_frame_rate) : undefined,
    bitrate: s.bit_rate != null ? String(s.bit_rate) : undefined,
    sampleRate: s.sample_rate != null ? Number(s.sample_rate) : undefined,
    channels: s.channels,
    duration: s.duration != null ? Number(s.duration) : undefined,
    language: s.tags?.language,
  }));
  const fmt = data.format || {};
  return {
    file: fmt.filename ?? fallbackFile,
    format: fmt.format_name ?? 'unknown',
    size: fmt.size != null ? Number(fmt.size) : 0,
    duration: fmt.duration != null ? Number(fmt.duration) : 0,
    bitrate: fmt.bit_rate != null ? String(fmt.bit_rate) : 'N/A',
    streams,
  };
}
