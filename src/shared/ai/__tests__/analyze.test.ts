/**
 * @fileoverview Unit tests for {@link analyzeMedia}.
 */

import { describe, it, expect } from 'vitest';
import type { MediaInfo, MediaStreamInfo } from '../../types';
import { analyzeMedia } from '../analyze';

/**
 * Builds a probe result with sensible defaults.
 * @param {Partial<MediaInfo>} overrides - Fields to override.
 * @returns {MediaInfo} A complete MediaInfo.
 */
function makeInfo(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return {
    file: 'C:/media/clip.mkv',
    format: 'matroska,webm',
    size: 1572864,
    duration: 120,
    bitrate: '3200k',
    streams: [],
    ...overrides,
  };
}

/**
 * Builds a stream with a type and codec.
 * @param {Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }} overrides - Stream fields.
 * @returns {MediaStreamInfo} A complete stream.
 */
function stream(overrides: Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }): MediaStreamInfo {
  return { index: 0, codec: 'unknown', ...overrides };
}

describe('analyzeMedia', () => {
  it('flags HDR, uncommon video codecs and multichannel audio with recommendations', () => {
    const analysis = analyzeMedia(
      makeInfo({
        streams: [
          stream({ type: 'video', codec: 'hevc', width: 3840, height: 2160, colorTransfer: 'smpte2084' }),
          stream({ type: 'audio', codec: 'eac3', channels: 6, channelLayout: '5.1' }),
        ],
      }),
    );
    const codes = analysis.findings.map((finding) => finding.code);
    expect(codes).toContain('VIDEO_CODEC_COMPAT');
    expect(codes).toContain('HDR');
    expect(codes).toContain('HIGH_RESOLUTION');
    expect(codes).toContain('AUDIO_CODEC_COMPAT');
    expect(codes).toContain('MULTICHANNEL_AUDIO');
    expect(analysis.recommendations.join(' ')).toContain('H.264');
    expect(analysis.summary).toContain('HDR');
  });

  it('reports a broad-compatibility finding for modern streams', () => {
    const analysis = analyzeMedia(
      makeInfo({
        streams: [
          stream({ type: 'video', codec: 'h264', width: 1920, height: 1080 }),
          stream({ type: 'audio', codec: 'aac', channels: 2 }),
        ],
      }),
    );
    expect(analysis.findings.map((finding) => finding.code)).toContain('BROAD_COMPAT');
    expect(analysis.recommendations).toHaveLength(0);
  });

  it('errors when no streams are readable', () => {
    const analysis = analyzeMedia(makeInfo({ streams: [] }));
    const error = analysis.findings.find((finding) => finding.severity === 'error');
    expect(error?.code).toBe('NO_STREAMS');
  });

  it('adds a size report under the size focus', () => {
    const analysis = analyzeMedia(
      makeInfo({
        streams: [stream({ type: 'video', codec: 'h264' })],
      }),
      'size',
    );
    expect(analysis.findings.map((finding) => finding.code)).toContain('SIZE_REPORT');
  });
});
