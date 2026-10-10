/**
 * @fileoverview Unit tests for {@link compareQuality} (roadmap R2 / F8).
 */

import { describe, it, expect } from 'vitest';
import type { MediaInfo, MediaStreamInfo } from '../../types';
import { compareQuality } from '../quality';

/**
 * Builds a probe result with sensible defaults.
 * @param {Partial<MediaInfo>} overrides - Fields to override.
 * @returns {MediaInfo} A complete MediaInfo.
 */
function makeInfo(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return {
    file: 'C:/media/clip.mp4',
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

describe('compareQuality', () => {
  it('passes when the output matches the source', () => {
    const report = compareQuality(makeInfo(), makeInfo());
    expect(report.passed).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(report.summary).toContain('/');
    expect(report.findings).toEqual([]);
  });

  it('flags a reduced resolution as a warning and a failed check', () => {
    const output = makeInfo({
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 854, height: 480 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    const report = compareQuality(makeInfo(), output);
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === 'resolutionPreserved')?.passed).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'resolution_reduced', severity: 'warning' }),
    );
  });

  it('flags dropped audio', () => {
    const output = makeInfo({ streams: [{ index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 }] });
    const report = compareQuality(makeInfo(), output);
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === 'audioPreserved')?.passed).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: 'audio_dropped' }));
  });

  it('notes a codec change without failing the report', () => {
    const output = makeInfo({
      streams: [
        { index: 0, type: 'video', codec: 'hevc', width: 1280, height: 720 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    const report = compareQuality(makeInfo(), output);
    expect(report.passed).toBe(true);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'video_codec_changed', severity: 'info' }),
    );
  });

  it('flags a duration drift beyond the tolerance', () => {
    const report = compareQuality(makeInfo(), makeInfo({ duration: 30 }));
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === 'durationMatches')?.passed).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: 'duration_changed' }));
  });

  it('reports an unreadable output as an error', () => {
    const report = compareQuality(makeInfo(), makeInfo({ streams: [], size: 0 }));
    expect(report.passed).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: 'unreadable', severity: 'error' }));
  });

  it('honours explicit expectations for missing streams', () => {
    const silent = makeInfo({ streams: [{ index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 }] });
    const report = compareQuality(silent, silent, { hasAudio: false });
    expect(report.passed).toBe(true);
  });
});
