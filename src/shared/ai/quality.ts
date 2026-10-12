/**
 * @fileoverview Deterministic post-encode quality report (roadmap R2 / F8).
 *
 * Compares a produced output against its source and any stated expectations:
 * resolution, audio, codec/container, duration and stream readability. Like
 * {@link validateOutput} this always re-derives facts from the two probes —
 * never a model call (roadmap §7.3) — so the report is reproducible and honest
 * about what actually landed on disk.
 */

import type { MediaInfo } from '../types';
import type { AnalysisFinding, MediaFacts, ValidationCheck, ValidationExpectations } from './types';
import { extractMediaFacts } from './media-facts';
import { validateOutput } from './validate';

/**
 * The outcome of comparing a source and its output.
 * @interface QualityReport
 * @property {boolean} passed - True only when every check passed.
 * @property {string} summary - One-sentence human summary.
 * @property {ValidationCheck[]} checks - Per-constraint results.
 * @property {AnalysisFinding[]} findings - Ordered, plain-language findings.
 * @property {MediaFacts} source - Source facts from the probe.
 * @property {MediaFacts} output - Output facts from the re-probe.
 */
export interface QualityReport {
  passed: boolean;
  summary: string;
  checks: ValidationCheck[];
  findings: AnalysisFinding[];
  source: MediaFacts;
  output: MediaFacts;
}

/** Duration drift tolerated between source and output, as a ratio (1%). */
const DURATION_TOLERANCE = 0.01;

/**
 * Formats a byte count for a human summary.
 * @param {number} bytes - Byte count.
 * @returns {string} A short human string.
 */
function humanBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${index === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`;
}

/**
 * True when the output resolution is not smaller than the source in either axis
 * (a downscale loses detail and is reported as a reduction).
 * @param {MediaFacts} source - Source facts.
 * @param {MediaFacts} output - Output facts.
 * @returns {boolean} Whether the output preserves the source resolution.
 */
function resolutionPreserved(source: MediaFacts, output: MediaFacts): boolean {
  if (!source.video || !output.video) return true;
  const sw = source.video.width ?? 0;
  const sh = source.video.height ?? 0;
  const ow = output.video.width ?? 0;
  const oh = output.video.height ?? 0;
  if (sw === 0 || sh === 0 || ow === 0 || oh === 0) return true;
  return ow >= sw && oh >= sh;
}

/**
 * Builds the post-encode quality report by re-probing both files.
 * @param {MediaInfo} source - The probed source media.
 * @param {MediaInfo} output - The probed output media.
 * @param {ValidationExpectations} [expect] - Optional explicit expectations.
 * @returns {QualityReport} The comparison, checks, findings, and facts.
 */
export function compareQuality(source: MediaInfo, output: MediaInfo, expect: ValidationExpectations = {}): QualityReport {
  const sourceFacts = extractMediaFacts(source);
  const outputFacts = extractMediaFacts(output);
  const validation = validateOutput(output, {
    ...expect,
    hasVideo: expect.hasVideo ?? sourceFacts.hasVideo,
    hasAudio: expect.hasAudio ?? sourceFacts.hasAudio,
  });
  const checks: ValidationCheck[] = [...validation.checks];
  const findings: AnalysisFinding[] = [];

  if (!outputFacts.hasVideo && !outputFacts.hasAudio) {
    findings.push({ severity: 'error', code: 'unreadable', message: 'The output could not be read: it has no usable streams.' });
  }

  if (sourceFacts.hasVideo && outputFacts.hasVideo) {
    const preserved = resolutionPreserved(sourceFacts, outputFacts);
    checks.push({
      name: 'resolutionPreserved',
      passed: preserved,
      expected: `>= ${sourceFacts.video?.width ?? '?'}x${sourceFacts.video?.height ?? '?'}`,
      actual: `${outputFacts.video?.width ?? '?'}x${outputFacts.video?.height ?? '?'}`,
    });
    if (!preserved) {
      findings.push({
        severity: 'warning',
        code: 'resolution_reduced',
        message: `Resolution was reduced from ${sourceFacts.video?.width}x${sourceFacts.video?.height} to ${outputFacts.video?.width}x${outputFacts.video?.height}.`,
      });
    }
    if (sourceFacts.video?.codec && outputFacts.video?.codec && sourceFacts.video.codec !== outputFacts.video.codec) {
      findings.push({
        severity: 'info',
        code: 'video_codec_changed',
        message: `Video codec changed from ${sourceFacts.video.codec} to ${outputFacts.video.codec}.`,
      });
    }
  }

  if (sourceFacts.hasAudio) {
    const audioKept = outputFacts.hasAudio;
    checks.push({ name: 'audioPreserved', passed: audioKept, expected: 'audio present', actual: audioKept ? 'present' : 'missing' });
    if (!audioKept) {
      findings.push({ severity: 'warning', code: 'audio_dropped', message: 'The source had audio but the output does not.' });
    } else if ((outputFacts.audio?.channels ?? 0) > 0 && (sourceFacts.audio?.channels ?? 0) > (outputFacts.audio?.channels ?? 0)) {
      findings.push({
        severity: 'warning',
        code: 'channels_reduced',
        message: `Audio channels were reduced from ${sourceFacts.audio?.channels} to ${outputFacts.audio?.channels}.`,
      });
    }
  }

  if (sourceFacts.durationSeconds > 0 && outputFacts.durationSeconds > 0) {
    const drift = Math.abs(outputFacts.durationSeconds - sourceFacts.durationSeconds) / sourceFacts.durationSeconds;
    const durationOk = drift <= DURATION_TOLERANCE;
    checks.push({
      name: 'durationMatches',
      passed: durationOk,
      expected: `~${sourceFacts.durationSeconds.toFixed(1)}s`,
      actual: `${outputFacts.durationSeconds.toFixed(1)}s`,
    });
    if (!durationOk) {
      findings.push({
        severity: 'warning',
        code: 'duration_changed',
        message: `The output duration (${outputFacts.durationSeconds.toFixed(1)}s) differs from the source (${sourceFacts.durationSeconds.toFixed(1)}s).`,
      });
    }
  }

  const passed = checks.every((check) => check.passed);
  const sizeDelta = outputFacts.sizeBytes - sourceFacts.sizeBytes;
  const sizeNote = sizeDelta <= 0 ? `${humanBytes(Math.abs(sizeDelta))} smaller` : `${humanBytes(sizeDelta)} larger`;
  return {
    passed,
    summary: `Output is ${humanBytes(outputFacts.sizeBytes)} (${sizeNote}) with ${checks.filter((c) => c.passed).length}/${checks.length} checks passing.`,
    checks,
    findings,
    source: sourceFacts,
    output: outputFacts,
  };
}
