/**
 * @fileoverview Post-execution output validation (roadmap §6, `validate_output`).
 *
 * Re-probes the produced file and checks it against the caller's constraints.
 * "Validate before claiming success": a job that reports `done` is still only
 * trustworthy once the output exists, probes readable, and satisfies the
 * expectations. Everything here is deterministic code, not a model call.
 */

import type { MediaInfo } from '../types';
import type { ValidationCheck, ValidationExpectations, ValidationResult } from './types';
import { extractMediaFacts } from './media-facts';
import { parseResolution } from './units';

/**
 * Compares two codec names case-insensitively, treating `h265`/`hevc` as equal.
 * @param {string | undefined} actual - The observed codec.
 * @param {string} expected - The required codec.
 * @returns {boolean} True when the codecs match.
 */
function codecMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const normalize = (value: string): string => {
    const lower = value.toLowerCase();
    if (lower === 'h265') return 'hevc';
    if (lower === 'h264') return 'h264';
    return lower;
  };
  return normalize(actual) === normalize(expected);
}

/**
 * Re-probes an output and validates it against optional constraints.
 *
 * Always runs a `readable` check (the output must carry at least one stream),
 * then one check per supplied expectation. The overall `passed` flag is true
 * only when every check passed, so a caller can branch on the boolean or reason
 * over the individual {@link ValidationCheck}s.
 * @param {MediaInfo} info - The freshly probed output file.
 * @param {ValidationExpectations} [expect] - Constraints to verify.
 * @returns {ValidationResult} Overall pass/fail plus per-check detail.
 */
export function validateOutput(info: MediaInfo, expect: ValidationExpectations = {}): ValidationResult {
  const facts = extractMediaFacts(info);
  const checks: ValidationCheck[] = [];

  checks.push({
    name: 'readable',
    passed: facts.hasVideo || facts.hasAudio,
    expected: 'at least one readable stream',
    actual: `${facts.hasVideo ? 'video' : ''}${facts.hasAudio ? 'audio' : ''}`.trim() || 'no streams',
  });

  if (expect.hasVideo !== undefined) {
    checks.push({
      name: 'hasVideo',
      passed: facts.hasVideo === expect.hasVideo,
      expected: String(expect.hasVideo),
      actual: String(facts.hasVideo),
    });
  }

  if (expect.hasAudio !== undefined) {
    checks.push({
      name: 'hasAudio',
      passed: facts.hasAudio === expect.hasAudio,
      expected: String(expect.hasAudio),
      actual: String(facts.hasAudio),
    });
  }

  if (expect.maxBytes !== undefined) {
    checks.push({
      name: 'maxBytes',
      passed: facts.sizeBytes <= expect.maxBytes,
      expected: `<= ${expect.maxBytes} bytes`,
      actual: `${facts.sizeBytes} bytes`,
    });
  }

  if (expect.minResolution !== undefined) {
    const min = parseResolution(expect.minResolution);
    const actualWidth = facts.video?.width ?? 0;
    const actualHeight = facts.video?.height ?? 0;
    const passed = min !== undefined && actualWidth >= min.width && actualHeight >= min.height;
    checks.push({
      name: 'minResolution',
      passed,
      expected: expect.minResolution,
      actual: actualWidth && actualHeight ? `${actualWidth}x${actualHeight}` : 'unknown',
    });
  }

  if (expect.codec !== undefined) {
    checks.push({
      name: 'codec',
      passed: codecMatches(facts.video?.codec, expect.codec),
      expected: expect.codec,
      actual: facts.video?.codec ?? 'unknown',
    });
  }

  if (expect.container !== undefined) {
    const expected = expect.container.toLowerCase();
    checks.push({
      name: 'container',
      passed: facts.format.toLowerCase().includes(expected),
      expected: expected,
      actual: facts.format,
    });
  }

  if (expect.minDurationSeconds !== undefined) {
    checks.push({
      name: 'minDurationSeconds',
      passed: facts.durationSeconds >= expect.minDurationSeconds,
      expected: `>= ${expect.minDurationSeconds}s`,
      actual: `${facts.durationSeconds}s`,
    });
  }

  if (expect.maxDurationSeconds !== undefined) {
    checks.push({
      name: 'maxDurationSeconds',
      passed: facts.durationSeconds <= expect.maxDurationSeconds,
      expected: `<= ${expect.maxDurationSeconds}s`,
      actual: `${facts.durationSeconds}s`,
    });
  }

  return {
    passed: checks.every((check) => check.passed),
    checks,
    observed: facts,
  };
}
