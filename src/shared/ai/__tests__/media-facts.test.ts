/**
 * @fileoverview Unit tests for {@link extractMediaFacts}.
 */

import { describe, it, expect } from 'vitest';
import type { MediaInfo, MediaStreamInfo } from '../../types';
import { extractMediaFacts } from '../media-facts';

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
    duration: 3725,
    bitrate: '3200k',
    streams: [],
    ...overrides,
  };
}

/**
 * Builds a stream with a type and codec.
 * @param {Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }} stream - Stream fields.
 * @returns {MediaStreamInfo} A complete stream.
 */
function stream(overrides: Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }): MediaStreamInfo {
  return { index: 0, codec: 'unknown', ...overrides };
}

describe('extractMediaFacts', () => {
  it('selects the primary video and audio streams', () => {
    const facts = extractMediaFacts(
      makeInfo({
        streams: [
          stream({ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }),
          stream({ index: 1, type: 'audio', codec: 'aac', channels: 2, channelLayout: 'stereo' }),
          stream({ index: 2, type: 'subtitle', codec: 'subrip' }),
        ],
      }),
    );
    expect(facts.hasVideo).toBe(true);
    expect(facts.hasAudio).toBe(true);
    expect(facts.subtitleCount).toBe(1);
    expect(facts.video).toMatchObject({ codec: 'h264', width: 1920, height: 1080, hdr: false });
    expect(facts.audio).toMatchObject({ codec: 'aac', channelLayout: 'stereo' });
    expect(facts.sizeBytes).toBe(1572864);
    expect(facts.durationSeconds).toBe(3725);
  });

  it('ignores attached cover-art video streams when picking the primary video', () => {
    const facts = extractMediaFacts(
      makeInfo({
        streams: [
          stream({ index: 0, type: 'video', codec: 'mjpeg', disposition: ['attached_pic'] }),
          stream({ index: 1, type: 'video', codec: 'h264', width: 1280, height: 720 }),
        ],
      }),
    );
    expect(facts.video?.codec).toBe('h264');
  });

  it('classifies HDR from transfer/primaries/bit depth', () => {
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', colorTransfer: 'smpte2084' })] })).video?.hdr).toBe(true);
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', colorPrimaries: 'bt2020' })] })).video?.hdr).toBe(true);
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', bitDepth: 10 })] })).video?.hdr).toBe(true);
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', colorTransfer: 'bt709' })] })).video?.hdr).toBe(false);
  });

  it('classifies interlacing and tolerates empty streams', () => {
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', fieldOrder: 'tt' })] })).video?.interlaced).toBe(true);
    expect(extractMediaFacts(makeInfo({ streams: [stream({ type: 'video', fieldOrder: 'progressive' })] })).video?.interlaced).toBe(false);
    const empty = extractMediaFacts(makeInfo({ streams: [] }));
    expect(empty.hasVideo).toBe(false);
    expect(empty.video).toBeUndefined();
  });
});
