/**
 * @fileoverview Deterministic output-size/time estimator (roadmap §4.2, F3).
 *
 * Size is computed as `(videoKbps + audioKbps) * 1000 / 8 * seconds` — plain
 * arithmetic over the target bitrates and duration, never a model call
 * (roadmap §7.3). The result is always labelled `isEstimated: true` (D4):
 * only a re-probe of the real output may be asserted as fact.
 */

import type { EncoderCapabilities } from '../types';
import type { ConversionEstimate, MediaFacts } from './types';
import { parseBitrateKbps, toSeconds } from './units';

/**
 * The subset of conversion arguments that affect the estimate.
 * @interface EstimateConversionInput
 * @property {string} [videoBitrate] - Target video bitrate (e.g. '2000k').
 * @property {string} [audioBitrate] - Target audio bitrate (e.g. '192k').
 * @property {string} [duration] - Trim duration (limits the output length).
 * @property {boolean} [copy] - Lossless stream copy (no re-encode).
 * @property {boolean} [audio] - Include audio (false drops it).
 * @property {boolean} [video] - Include video (false drops it).
 */
export interface EstimateConversionInput {
  videoBitrate?: string;
  audioBitrate?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
}

/** Fallback video bitrate (kbps) when neither args nor probe supply one. */
const DEFAULT_VIDEO_KBPS = 2500;

/** Fallback audio bitrate (kbps) when neither args nor probe supply one. */
const DEFAULT_AUDIO_KBPS = 128;

/**
 * Substrings that identify a hardware-accelerated encoder or method.
 * @const {string[]}
 */
const HARDWARE_MARKERS = ['nvenc', 'qsv', 'amf', 'videotoolbox', 'vaapi', 'v4l2m2m', 'mf', 'cuda', 'd3d11va', 'dxva2', 'opencl', 'vulkan'];

/**
 * Reports whether the system has a usable hardware encoder.
 * @param {EncoderCapabilities} capabilities - Detected capabilities.
 * @returns {{ available: boolean; methods: string[] }} Availability + methods.
 */
export function detectHardwareAcceleration(capabilities: EncoderCapabilities): { available: boolean; methods: string[] } {
  const methods = [...(capabilities.hwaccels ?? []), ...(capabilities.videoEncoders ?? [])]
    .filter((entry) => HARDWARE_MARKERS.some((marker) => entry.toLowerCase().includes(marker)))
    .filter((entry, index, all) => all.indexOf(entry) === index)
    .sort();
  return { available: methods.length > 0, methods };
}

/**
 * Derives a source bitrate in kbps from the probed facts, when available.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} Source kbps, or undefined when unknown.
 */
function sourceBitrateKbps(facts: MediaFacts): number | undefined {
  const reported = parseBitrateKbps(facts.overallBitrate);
  if (reported) return reported;
  if (facts.durationSeconds > 0 && facts.sizeBytes > 0) {
    return Math.round((facts.sizeBytes * 8) / facts.durationSeconds / 1000);
  }
  return undefined;
}

/**
 * Estimates the output size and duration for a prospective conversion.
 *
 * A `copy` plan is reported as preserving the source size; every other plan is
 * computed from the resolved video/audio bitrates over the (optionally trimmed)
 * duration. Missing bitrates fall back to the probe, then to a sane default.
 * @param {EstimateConversionInput} args - Conversion arguments to estimate.
 * @param {MediaFacts} facts - Source facts from the probe.
 * @param {EncoderCapabilities} capabilities - Detected encoder capabilities.
 * @returns {ConversionEstimate} The labelled estimate plus its assumptions.
 */
export function estimateConversion(
  args: EstimateConversionInput,
  facts: MediaFacts,
  capabilities: EncoderCapabilities,
): ConversionEstimate {
  const hardwareAcceleration = detectHardwareAcceleration(capabilities);
  const notes: string[] = [];
  const requestedDuration = toSeconds(args.duration);
  const seconds = requestedDuration ?? facts.durationSeconds;
  if (requestedDuration !== undefined && requestedDuration !== facts.durationSeconds) {
    notes.push(`Trimmed to ${requestedDuration}s; the source is ${facts.durationSeconds}s.`);
  }

  if (args.copy) {
    notes.push('Lossless stream copy: output size is approximately the source size.');
    return {
      isEstimated: true,
      method: 'bitrate',
      estimatedSizeBytes: facts.sizeBytes,
      estimatedDurationSeconds: seconds,
      videoBitrateKbps: 0,
      audioBitrateKbps: 0,
      copy: true,
      hardwareAcceleration,
      notes,
    };
  }

  const includeVideo = args.video !== false && facts.hasVideo;
  const includeAudio = args.audio !== false && facts.hasAudio;

  let videoBitrateKbps = 0;
  if (includeVideo) {
    videoBitrateKbps = parseBitrateKbps(args.videoBitrate) ?? sourceBitrateKbps(facts) ?? DEFAULT_VIDEO_KBPS;
    if (!args.videoBitrate && !parseBitrateKbps(facts.overallBitrate)) {
      notes.push('No target video bitrate was given; the estimate falls back to the source or a default.');
    }
  }

  let audioBitrateKbps = 0;
  if (includeAudio) {
    audioBitrateKbps = parseBitrateKbps(args.audioBitrate) ?? DEFAULT_AUDIO_KBPS;
  }

  const totalKbps = videoBitrateKbps + audioBitrateKbps;
  const estimatedSizeBytes = Math.round((totalKbps * 1000 * seconds) / 8);
  if (hardwareAcceleration.available) {
    notes.push(`Hardware encoding is available (${hardwareAcceleration.methods.join(', ')}).`);
  }

  return {
    isEstimated: true,
    method: 'bitrate',
    estimatedSizeBytes,
    estimatedDurationSeconds: seconds,
    videoBitrateKbps,
    audioBitrateKbps,
    copy: false,
    hardwareAcceleration,
    notes,
  };
}
