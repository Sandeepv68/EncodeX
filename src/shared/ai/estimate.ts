/**
 * @fileoverview Deterministic output-size/time estimator (roadmap §4.2, F3).
 *
 * Size is computed as `(videoKbps + audioKbps) * 1000 / 8 * seconds` — plain
 * arithmetic over the target bitrates and duration, never a model call
 * (roadmap §7.3). The result is always labelled `isEstimated: true` (D4):
 * only a re-probe of the real output may be asserted as fact.
 */

import type { EncoderCapabilities } from '../types';
import type { ConversionEstimate, EstimateConversionInput, MediaFacts } from './types';
import { parseBitrateKbps, parseResolution, toSeconds } from './units';

export type { EstimateConversionInput };

/** Fallback video bitrate (kbps) when neither args nor probe supply one. */
const DEFAULT_VIDEO_KBPS = 2500;

/** Fallback audio bitrate (kbps) when neither args nor probe supply one. */
const DEFAULT_AUDIO_KBPS = 128;

/**
 * The quality value (CRF/qscale) a typical source is encoded at. The
 * reference makes the CRF factor relative: a target equal to the reference
 * keeps the source bitrate, a lower target number means a bigger file.
 * @const {number}
 */
const REFERENCE_CRF = 20;

/**
 * How many CRF steps it takes to halve the bitrate. x264-style CRF encoders
 * roughly halve the bitrate for every 6 steps, which is what turns a quality
 * target into a bitrate factor.
 * @const {number}
 */
const CRF_STEPS_PER_HALVING = 6;

/**
 * How much smaller the same picture gets with a more efficient codec. The
 * numbers are the usual rule-of-thumb ratios between the encoders; a value
 * above 1 means the codec produces a *bigger* file (ProRes is intra-only).
 * @const {Array<{ match: RegExp; factor: number }>}
 */
const CODEC_EFFICIENCY: Array<{ match: RegExp; factor: number }> = [
  { match: /av1|svt|rav1e|aom/, factor: 0.55 },
  { match: /hevc|h\.?265|x265/, factor: 0.65 },
  { match: /vp9/, factor: 0.7 },
  { match: /vp8/, factor: 0.85 },
  { match: /prores/, factor: 3 },
  { match: /mpeg4|mp4v/, factor: 1.2 },
];

/**
 * Smallest resolution ratio the estimate honours; below it the model is too
 * coarse to say anything useful.
 * @const {number}
 */
const MIN_RESOLUTION_RATIO = 0.05;

/**
 * The number of bits per pixel per frame an H.264 encode needs at the
 * reference quality (CRF 20).
 *
 * This is the anchor of the estimate: a CRF target is an *absolute* quality,
 * so the target bitrate follows from the resolution, the frame rate and the
 * quality - not from the bitrate of the source. Anchoring on the source
 * instead (the first version of this estimate) reported "0% saving" for every
 * plan that kept the source resolution, even when the source was encoded far
 * above the target's quality - which is exactly the case a "compress this"
 * request is about.
 * @const {number}
 */
const REFERENCE_BPP = 0.08;

/**
 * The frame rate assumed when the probe does not report one.
 * @const {number}
 */
const DEFAULT_FPS = 30;

/**
 * Bounds of the content-complexity factor.
 *
 * The source's own bits per pixel mix content complexity and quality, so the
 * factor is the square root of the ratio against the reference (a damped
 * influence) and is clamped to keep one outlier from dominating the estimate.
 * @const {{ min: number; max: number }}
 */
const COMPLEXITY_BOUNDS = { min: 0.6, max: 1.8 };

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
 * Derives the source's overall bitrate in kbps from the probed facts.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} Source kbps, or undefined when unknown.
 */
function sourceOverallBitrateKbps(facts: MediaFacts): number | undefined {
  const reported = parseBitrateKbps(facts.overallBitrate);
  if (reported) return reported;
  if (facts.durationSeconds > 0 && facts.sizeBytes > 0) {
    return Math.round((facts.sizeBytes * 8) / facts.durationSeconds / 1000);
  }
  return undefined;
}

/**
 * Derives the source's audio bitrate in kbps from the probed facts.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} Source audio kbps, or undefined when unknown.
 */
function sourceAudioBitrateKbps(facts: MediaFacts): number | undefined {
  if (!facts.hasAudio) return undefined;
  return parseBitrateKbps(facts.audio?.bitrate);
}

/**
 * Derives the source's *video* bitrate in kbps.
 *
 * The overall bitrate covers every stream, so the audio part is taken out:
 * the estimate adds the target audio bitrate separately, and counting the
 * source audio twice inflates the projected output size and understates the
 * saving.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} Source video kbps, or undefined when unknown.
 */
function sourceVideoBitrateKbps(facts: MediaFacts): number | undefined {
  const overall = sourceOverallBitrateKbps(facts);
  if (overall === undefined) return undefined;
  const audio = sourceAudioBitrateKbps(facts);
  if (audio === undefined) return overall;
  return Math.max(0, overall - audio);
}

/**
 * The ratio between the output pixels and the source pixels.
 *
 * Bitrate scales roughly with the pixel count, so a 1080p source encoded to
 * 720p keeps about 44% of the pixels and therefore about 44% of the video
 * bitrate. Upscaling never shrinks the file, so the ratio is capped at 1.
 * @param {EstimateConversionInput} args - Conversion arguments.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} The ratio, or undefined when it cannot be derived.
 */
function resolutionRatio(args: EstimateConversionInput, facts: MediaFacts): number | undefined {
  const percent = typeof args.scale === 'string' ? /^(\d+(?:\.\d+)?)\s*%$/.exec(args.scale.trim()) : null;
  if (percent) {
    return Math.min(1, Math.max(MIN_RESOLUTION_RATIO, Number(percent[1]) / 100));
  }
  const target = parseResolution(args.scale);
  const source = facts.video;
  if (!target || !source?.width || !source?.height) return undefined;
  const sourcePixels = source.width * source.height;
  if (sourcePixels <= 0) return undefined;
  const ratio = (target.width * target.height) / sourcePixels;
  return Math.min(1, Math.max(MIN_RESOLUTION_RATIO, ratio));
}

/**
 * The bitrate factor of the target codec relative to H.264.
 * @param {string | undefined} codec - The target video codec.
 * @returns {number} The factor (1 for H.264 and unknown codecs).
 */
function codecEfficiency(codec: string | undefined): number {
  if (!codec) return 1;
  const name = codec.toLowerCase();
  const entry = CODEC_EFFICIENCY.find((candidate) => candidate.match.test(name));
  return entry ? entry.factor : 1;
}

/**
 * The source's frame rate, falling back to a sane default.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number} Frames per second.
 */
function frameRateOf(facts: MediaFacts): number {
  const raw = facts.video?.frameRate;
  if (!raw) return DEFAULT_FPS;
  const parts = raw.split('/');
  const numerator = Number(parts[0]);
  const denominator = parts.length > 1 ? Number(parts[1]) : 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0 || numerator <= 0) return DEFAULT_FPS;
  const fps = numerator / denominator;
  return fps > 0 && fps <= 240 ? fps : DEFAULT_FPS;
}

/**
 * The source's pixel count.
 * @param {MediaFacts} facts - The media facts.
 * @returns {number | undefined} Pixels, or undefined when unknown.
 */
function sourcePixelsOf(facts: MediaFacts): number | undefined {
  const width = facts.video?.width;
  const height = facts.video?.height;
  if (!width || !height) return undefined;
  return width * height;
}

/**
 * The pixel count of the planned output.
 *
 * An upscale never shrinks a file, so the target is capped at the source
 * pixel count: the estimate must not claim that enlarging the picture makes
 * the file smaller.
 * @param {string | undefined} scale - The planned scale (`WxH` or a percentage).
 * @param {number | undefined} sourcePixels - The source pixel count.
 * @returns {number | undefined} Target pixels, or undefined when unknown.
 */
function targetPixelsOf(scale: string | undefined, sourcePixels: number | undefined): number | undefined {
  let pixels: number | undefined;
  if (scale) {
    const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(scale.trim());
    if (percent && sourcePixels) {
      pixels = Math.round(sourcePixels * (Number(percent[1]) / 100));
    } else {
      const resolution = parseResolution(scale);
      if (resolution) pixels = resolution.width * resolution.height;
    }
  }
  if (pixels === undefined) return sourcePixels;
  if (sourcePixels === undefined) return pixels;
  return Math.min(pixels, sourcePixels);
}

/**
 * Parses a quality value (CRF/qscale) into a number.
 * @param {number | string | undefined} value - The quality value.
 * @returns {number | undefined} The parsed number, or undefined.
 */
function parseQuality(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * The bitrate factor implied by a quality target.
 *
 * A CRF-style encoder roughly halves the bitrate for every six quality
 * steps, so a target of 23 needs about 71% of the bits of the reference
 * quality while a target of 18 needs about 26% more.
 * @param {number | string | undefined} quality - The quality target.
 * @returns {number} The factor (1 when no quality target is set).
 */
function qualityFactor(quality: number | string | undefined): number {
  const parsed = parseQuality(quality);
  if (parsed === undefined) return 1;
  return Math.pow(2, (REFERENCE_CRF - parsed) / CRF_STEPS_PER_HALVING);
}

/**
 * Estimates the output size and duration for a prospective conversion.
 *
 * A `copy` plan is reported as preserving the source size; every other plan is
 * computed from the resolved video/audio bitrates over the (optionally trimmed)
 * duration. A plan with an explicit target bitrate is sized with that
 * bitrate; a quality-based plan is modelled from the output resolution, the
 * codec and the quality target, adjusted for the content complexity of the
 * source.
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
    const requested = parseBitrateKbps(args.videoBitrate);
    if (requested !== undefined) {
      videoBitrateKbps = requested;
    } else {
      // No explicit target bitrate: model the target bitrate from the output
      // resolution, the frame rate, the codec and the quality target, and let
      // the source's own bits per pixel adjust for the content complexity.
      const sourceVideoKbps = sourceVideoBitrateKbps(facts);
      const sourcePixels = sourcePixelsOf(facts);
      const targetPixels = targetPixelsOf(args.scale, sourcePixels);
      const fps = frameRateOf(facts);
      const modelBpp = REFERENCE_BPP * qualityFactor(args.qscale) * codecEfficiency(args.videoCodec);
      if (sourceVideoKbps !== undefined && sourcePixels !== undefined && targetPixels !== undefined && sourcePixels > 0) {
        const sourceBpp = (sourceVideoKbps * 1000) / (sourcePixels * fps);
        const complexity = Math.min(
          COMPLEXITY_BOUNDS.max,
          Math.max(COMPLEXITY_BOUNDS.min, Math.sqrt(sourceBpp / REFERENCE_BPP)),
        );
        const targetBpp = modelBpp * complexity;
        videoBitrateKbps = Math.max(1, Math.round((targetBpp * targetPixels * fps) / 1000));
      } else {
        // Without a resolution or a source bitrate the model cannot run, so the
        // source bitrate is carried over (scaled by the resolution when known).
        const base = sourceVideoKbps ?? DEFAULT_VIDEO_KBPS;
        const ratio = resolutionRatio(args, facts) ?? 1;
        videoBitrateKbps = Math.max(1, Math.round(base * ratio * qualityFactor(args.qscale)));
      }
      notes.push(
        'No target video bitrate was given; the estimate models the output bitrate from the resolution, the codec and the quality target.',
      );
    }
  }

  let audioBitrateKbps = 0;
  if (includeAudio) {
    audioBitrateKbps = parseBitrateKbps(args.audioBitrate) ?? sourceAudioBitrateKbps(facts) ?? DEFAULT_AUDIO_KBPS;
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
