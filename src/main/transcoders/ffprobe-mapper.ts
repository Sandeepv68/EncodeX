import { MediaInfo, MediaStreamInfo } from '../../shared/types';

export interface ProbeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  codec_tag_string?: string;
  profile?: string | number;
  level?: string | number;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string | number;
  sample_rate?: string | number;
  channels?: number;
  channel_layout?: string;
  sample_fmt?: string;
  bits_per_sample?: number;
  bits_per_raw_sample?: string | number;
  duration?: string | number;
  start_time?: string | number;
  nb_frames?: string | number;
  display_aspect_ratio?: string;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  field_order?: string;
  tags?: Record<string, unknown>;
  disposition?: Record<string, number>;
}

export interface ProbeFormat {
  filename?: string;
  format_name?: string;
  format_long_name?: string;
  size?: string | number;
  duration?: string | number;
  bit_rate?: string | number;
  start_time?: string | number;
  probe_score?: number;
  tags?: Record<string, unknown>;
}

export interface ProbeData {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}

export function parseRatio(ratio: string): string | undefined {
  const parts = ratio.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      const value = num / den;
      if (value > 0) return value.toFixed(2);
    }
  }
  return undefined;
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toStringValue(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

function toTags(tags: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!tags) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value != null) result[key] = String(value);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

const DISPOSITION_FLAGS = [
  'default',
  'dub',
  'original',
  'comment',
  'lyrics',
  'karaoke',
  'forced',
  'hearing_impaired',
  'visual_impaired',
  'clean_effects',
  'attached_pic',
  'timed_thumbnails',
  'captions',
  'descriptions',
  'metadata',
  'dependent',
  'still_image',
] as const;

function toDisposition(disposition: Record<string, number> | undefined): string[] | undefined {
  if (!disposition) return undefined;
  const flags = DISPOSITION_FLAGS.filter((flag) => disposition[flag] === 1);
  return flags.length > 0 ? flags : undefined;
}

export function mapFfprobeData(data: ProbeData, fallbackFile: string): MediaInfo {
  const streams: MediaStreamInfo[] = (data.streams || []).map((s) => ({
    index: s.index ?? 0,
    type: (s.codec_type as MediaStreamInfo['type']) ?? 'video',
    codec: s.codec_name ?? 'unknown',
    codecLong: s.codec_long_name,
    codecTag: s.codec_tag_string,
    profile: s.profile != null ? String(s.profile) : undefined,
    level: toNumber(s.level),
    width: s.width,
    height: s.height,
    displayAspectRatio: s.display_aspect_ratio,
    pixelFormat: s.pix_fmt,
    colorRange: s.color_range,
    colorSpace: s.color_space,
    colorTransfer: s.color_transfer,
    colorPrimaries: s.color_primaries,
    fieldOrder: s.field_order,
    frameRate: s.r_frame_rate ? parseRatio(s.r_frame_rate) : undefined,
    avgFrameRate: s.avg_frame_rate ? parseRatio(s.avg_frame_rate) : undefined,
    bitDepth: toNumber(s.bits_per_raw_sample) ?? toNumber(s.bits_per_sample),
    bitrate: toStringValue(s.bit_rate),
    sampleRate: toNumber(s.sample_rate),
    sampleFormat: s.sample_fmt,
    channels: s.channels,
    channelLayout: s.channel_layout,
    bitsPerSample: toNumber(s.bits_per_sample),
    duration: toNumber(s.duration),
    startTime: toNumber(s.start_time),
    frameCount: toNumber(s.nb_frames),
    language: s.tags?.language != null ? String(s.tags.language) : undefined,
    title: s.tags?.title != null ? String(s.tags.title) : undefined,
    disposition: toDisposition(s.disposition),
    tags: toTags(s.tags),
  }));
  const fmt = data.format || {};
  return {
    file: fmt.filename ?? fallbackFile,
    format: fmt.format_name ?? 'unknown',
    formatLong: fmt.format_long_name,
    size: fmt.size != null ? Number(fmt.size) : 0,
    duration: fmt.duration != null ? Number(fmt.duration) : 0,
    bitrate: fmt.bit_rate != null ? String(fmt.bit_rate) : 'N/A',
    startTime: toNumber(fmt.start_time),
    probeScore: fmt.probe_score,
    streams,
    tags: toTags(fmt.tags),
  };
}
