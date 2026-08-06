/**
 * @fileoverview Type definitions for the transcoder layer.
 * Defines the ITranscoder interface contract that every backend implements
 * (FfmpegCore, FFToolCore, BmfCore), plus the raw ffprobe JSON shapes
 * (ProbeStream/ProbeFormat/ProbeData) consumed by the ffprobe-mapper.
 */

import type { EventEmitter } from 'events';
import type { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';

/**
 * Contract implemented by all transcoder backends.
 *
 * A transcoder owns at most one conversion at a time. `convert` returns an
 * EventEmitter whose lifecycle mirrors the underlying process: it MUST emit
 * 'end' on success, 'error' (with a cancelledError when cancelled) on failure,
 * and may emit 'progress' (ConversionProgress) and other events. `pause`/
 * `resume` suspend and resume the underlying OS process, and `cancel` aborts
 * it. `getInfo` and `getType` are non-destructive and can be called anytime.
 * @interface ITranscoder
 * @property {function(string): Promise<MediaInfo>} getInfo - Probes a media
 *   file and resolves its mapped metadata
 * @property {function(string, string, ConversionOptions): EventEmitter} convert
 *   - Starts a conversion; the returned emitter drives progress/error/end
 * @property {function(): void} cancel - Aborts the current conversion; the
 *   convert emitter subsequently fires 'error' with a cancelledError
 * @property {function(): void} pause - Suspends the running conversion process
 * @property {function(): void} resume - Resumes a suspended conversion process
 * @property {function(): string} getType - Returns the backend identifier
 *   ('FFMPEG', 'FFTOOL', or 'BMF')
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
 *
 * Mirrors one entry of the `streams` array in ffprobe's JSON output. Most
 * numeric values arrive as strings or numbers depending on the ffprobe build,
 * which is why they are typed as `string | number`; the ffprobe-mapper
 * normalizes them into typed MediaStreamInfo fields.
 * @interface ProbeStream
 * @property {number} [index] - Zero-based stream index
 * @property {string} [codec_type] - Stream kind: 'video', 'audio', 'subtitle', etc.
 * @property {string} [codec_name] - Short codec name (e.g. 'h264')
 * @property {string} [codec_long_name] - Long codec description
 * @property {string} [codec_tag_string] - FourCC/codec tag string
 * @property {string|number} [profile] - Codec profile (e.g. 'High')
 * @property {string|number} [level] - Codec level
 * @property {number} [width] - Video width in pixels
 * @property {number} [height] - Video height in pixels
 * @property {string} [pix_fmt] - Pixel format (e.g. 'yuv420p')
 * @property {string} [r_frame_rate] - Real frame rate as 'num/den' string
 * @property {string} [avg_frame_rate] - Average frame rate as 'num/den' string
 * @property {string|number} [bit_rate] - Bit rate in bits per second
 * @property {string|number} [sample_rate] - Audio sample rate in Hz
 * @property {number} [channels] - Audio channel count
 * @property {string} [channel_layout] - Audio channel layout (e.g. 'stereo')
 * @property {string} [sample_fmt] - Audio sample format (e.g. 's16')
 * @property {number} [bits_per_sample] - Audio bits per sample
 * @property {string|number} [bits_per_raw_sample] - Video bits per raw sample
 * @property {string|number} [duration] - Stream duration in seconds
 * @property {string|number} [start_time] - Stream start time in seconds
 * @property {string|number} [nb_frames] - Number of frames in the stream
 * @property {string} [display_aspect_ratio] - DAR as 'num/den' string
 * @property {string} [color_range] - Color range (e.g. 'tv'/'pc')
 * @property {string} [color_space] - Color space (e.g. 'bt709')
 * @property {string} [color_transfer] - Transfer characteristics
 * @property {string} [color_primaries] - Color primaries
 * @property {string} [field_order] - Interlacing field order
 * @property {Record<string, unknown>} [tags] - Free-form stream metadata tags
 * @property {Record<string, number>} [disposition] - Disposition bitmask
 *   mapping flag names to 0/1
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
 *
 * Mirrors the `format` section of ffprobe's JSON output, describing the
 * container-level properties of the probed file.
 * @interface ProbeFormat
 * @property {string} [filename] - Input path as reported by ffprobe
 * @property {string} [format_name] - Container format (e.g. 'matroska,webm')
 * @property {string} [format_long_name] - Long format description
 * @property {string|number} [size] - File size in bytes
 * @property {string|number} [duration] - Container duration in seconds
 * @property {string|number} [bit_rate] - Overall bit rate in bits per second
 * @property {string|number} [start_time] - Container start time in seconds
 * @property {number} [probe_score] - ffprobe's confidence score (0-100)
 * @property {Record<string, unknown>} [tags] - Container-level metadata tags
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
 *
 * The top-level object of `ffprobe -print_format json -show_streams
 * -show_format`; passed to {@link mapFfprobeData} for normalization.
 * @interface ProbeData
 * @property {ProbeStream[]} [streams] - List of probed streams, if any
 * @property {ProbeFormat} [format] - Container-level format info, if any
 */
export interface ProbeData {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}
