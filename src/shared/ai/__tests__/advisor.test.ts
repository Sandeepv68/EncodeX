/**
 * @fileoverview Unit tests for {@link adviseEncoding} (roadmap R2 / F7).
 */

import { describe, it, expect } from 'vitest';
import type { EncoderCapabilities } from '../../types';
import type { MediaFacts } from '../types';
import { adviseEncoding } from '../advisor';

/**
 * Builds source media facts with a video codec.
 * @param {Partial<MediaFacts>} overrides - Fields to override.
 * @returns {MediaFacts} Complete facts.
 */
function makeFacts(overrides: Partial<MediaFacts> = {}): MediaFacts {
  return {
    file: 'C:/media/clip.mp4',
    format: 'mp4',
    sizeBytes: 8 * 1024 * 1024,
    durationSeconds: 60,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
    video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
    audio: { codec: 'aac', channels: 2 },
    ...overrides,
  };
}

/**
 * Builds encoder capabilities.
 * @param {Partial<EncoderCapabilities>} overrides - Fields to override.
 * @returns {EncoderCapabilities} Complete capabilities.
 */
function makeCaps(overrides: Partial<EncoderCapabilities> = {}): EncoderCapabilities {
  return { videoEncoders: [], audioEncoders: [], hwaccels: [], ...overrides };
}

describe('adviseEncoding', () => {
  it('uses the software encoder when no hardware is detected', () => {
    const advice = adviseEncoding(makeFacts(), makeCaps());
    expect(advice.recommendedVideoCodec).toBe('libx264');
    expect(advice.useHardware).toBe(false);
    expect(advice.hardwareMethod).toBeUndefined();
    expect(advice.findings).toContainEqual(expect.objectContaining({ code: 'software_only' }));
  });

  it('prefers a matching hardware encoder when available', () => {
    const advice = adviseEncoding(makeFacts(), makeCaps({ videoEncoders: ['h264_nvenc', 'libx264'] }));
    expect(advice.recommendedVideoCodec).toBe('h264_nvenc');
    expect(advice.useHardware).toBe(true);
    expect(advice.hardwareMethod).toBe('h264_nvenc');
    expect(advice.notes.join(' ')).toContain('faster');
    expect(advice.findings).toContainEqual(expect.objectContaining({ code: 'hardware_encoder_available' }));
  });

  it('maps the hevc family to libx265', () => {
    const advice = adviseEncoding(
      makeFacts({ video: { codec: 'hevc', width: 1920, height: 1080, hdr: false, interlaced: false } }),
      makeCaps(),
    );
    expect(advice.sourceCodecFamily).toBe('hevc');
    expect(advice.recommendedVideoCodec).toBe('libx265');
  });

  it('reports hardware that exists but does not match the source family', () => {
    const advice = adviseEncoding(makeFacts(), makeCaps({ videoEncoders: ['hevc_nvenc'] }));
    expect(advice.useHardware).toBe(false);
    expect(advice.recommendedVideoCodec).toBe('libx264');
    expect(advice.findings).toContainEqual(expect.objectContaining({ code: 'hardware_available_no_match' }));
  });

  it('warns about an HDR source', () => {
    const advice = adviseEncoding(
      makeFacts({ video: { codec: 'hevc', width: 3840, height: 2160, hdr: true, interlaced: false } }),
      makeCaps(),
    );
    expect(advice.findings).toContainEqual(expect.objectContaining({ code: 'hdr_source', severity: 'warning' }));
  });
});
