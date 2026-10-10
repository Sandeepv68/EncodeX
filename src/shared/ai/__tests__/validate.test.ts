/**
 * @fileoverview Unit tests for {@link validateOutput}.
 */

import { describe, it, expect } from 'vitest';
import type { MediaInfo, MediaStreamInfo } from '../../types';
import { validateOutput } from '../validate';

/**
 * Builds a probe result with sensible defaults.
 * @param {Partial<MediaInfo>} overrides - Fields to override.
 * @returns {MediaInfo} A complete MediaInfo.
 */
function makeInfo(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return {
    file: 'C:/out.mp4',
    format: 'mov,mp4,m4a,3gp,3g2,mj2',
    size: 8 * 1024 * 1024,
    duration: 60,
    bitrate: '1500k',
    streams: [
      { index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 } satisfies MediaStreamInfo,
      { index: 1, type: 'audio', codec: 'aac', channels: 2 } satisfies MediaStreamInfo,
    ],
    ...overrides,
  };
}

describe('validateOutput', () => {
  it('passes when all expectations are met', () => {
    const result = validateOutput(makeInfo(), {
      hasVideo: true,
      hasAudio: true,
      codec: 'h264',
      container: 'mp4',
      minResolution: '1280x720',
      maxBytes: 10 * 1024 * 1024,
    });
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.observed.hasVideo).toBe(true);
  });

  it('fails a constraint that is not met', () => {
    const result = validateOutput(makeInfo(), { maxBytes: 1024 });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'maxBytes')?.passed).toBe(false);
  });

  it('treats h265 and hevc as the same codec', () => {
    const info = makeInfo({ streams: [{ index: 0, type: 'video', codec: 'hevc', width: 1920, height: 1080 }] });
    expect(validateOutput(info, { codec: 'h265' }).passed).toBe(true);
  });

  it('fails when the output has no readable streams', () => {
    const result = validateOutput(makeInfo({ streams: [] }));
    expect(result.passed).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: 'readable', passed: false });
  });

  it('checks duration bounds', () => {
    const result = validateOutput(makeInfo(), { minDurationSeconds: 120 });
    expect(result.checks.find((check) => check.name === 'minDurationSeconds')?.passed).toBe(false);
  });
});
