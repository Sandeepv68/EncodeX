/**
 * @fileoverview Type definitions for the transcoder layer.
 * Defines the transcoder interface contract and ffprobe data structures.
 */

import type { EventEmitter } from 'events';
import type { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';

/**
 * Contract implemented by all transcoder backends.
 * @interface ITranscoder
 */
export interface ITranscoder {
  getInfo(input: string): Promise<MediaInfo>;
  convert(input: string, output: string, options: ConversionOptions): EventEmitter;
  cancel(): void;
  pause(): void;
  resume(): void;
  getType(): string;
}

/**
 * Raw stream metadata as reported by ffprobe.
 * @interface ProbeStream
 */
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

/**
 * Raw format metadata as reported by ffprobe.
 * @interface ProbeFormat
 */
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

/**
 * Root structure returned by ffprobe (streams and format sections).
 * @interface ProbeData
 */
export interface ProbeData {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}
