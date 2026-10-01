/**
 * @fileoverview Property-based tests for the codec/container lookup tables (Phase 1).
 *
 * These functions are pure lookups over hard-coded tables, so the interesting
 * properties are negative: they must answer a question for *any* input rather
 * than throwing on an unknown codec or extension. They are called with values
 * that came out of ffprobe on a corrupt file, so 'undefined', 'unknown', and
 * `null` are all realistic arguments, not just valid codec names.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  AUDIO_CONTAINER_EXTENSIONS,
  classifyVideoCodec,
  getAudioCodecContainers,
  getExtension,
  getVideoCodecContainer,
  isBitmapSubtitleCodec,
  isContainerCompatibleWithChapters,
  isContainerCompatibleWithCover,
  isContainerCompatibleWithStream,
  isExtensionCompatibleWithVideoCodec,
  isSubtitleCodecAllowed,
  isSubtitleCodecCompatibleWithContainer,
  replaceExtension,
  suggestedExtensionForAudioCodec,
  suggestedExtensionForVideoCodec,
  withExtension,
} from '../codec-containers';
import type { MediaStreamInfo } from '../types';

/** Codec/extension strings as ffprobe actually reports them, including junk. */
const codecArb = fc.oneof(
  fc.constantFrom('h264', 'hevc', 'vp9', 'av1', 'mpeg4', 'libx264', 'prores', 'aac', 'mp3', 'opus', 'flac', 'ac3'),
  fc.constantFrom('', 'undefined', 'null', 'none', 'unknown', 'N/A'),
  fc.string(),
);

const extArb = fc.oneof(
  fc.constantFrom('mp4', 'mkv', 'webm', 'mov', 'avi', 'ts', 'srt', 'ass', 'vtt'),
  fc.constantFrom('', '.mp4', 'MP4', 'unknown', 'undefined'),
  fc.string(),
);

describe('video codec lookups never throw', () => {
  it('classifyVideoCodec always returns a string', () => {
    fc.assert(
      fc.property(codecArb, (codec) => {
        const result = classifyVideoCodec(codec);
        expect(typeof result).toBe('string');
      }),
      { seed: 12345 },
    );
  });

  it('getVideoCodecContainer always returns a usable object', () => {
    fc.assert(
      fc.property(codecArb, (codec) => {
        const result = getVideoCodecContainer(codec);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('object');
        expect(JSON.stringify(result)).not.toMatch(/undefined/);
      }),
      { seed: 12345 },
    );
  });

  it('suggestedExtensionForVideoCodec always returns a non-empty extension', () => {
    fc.assert(
      fc.property(codecArb, (codec) => {
        const ext = suggestedExtensionForVideoCodec(codec);
        expect(typeof ext).toBe('string');
        expect(ext.length).toBeGreaterThan(0);
        expect(ext).not.toMatch(/[/\\]/);
      }),
      { seed: 12345 },
    );
  });

  it('isExtensionCompatibleWithVideoCodec always returns a boolean', () => {
    fc.assert(
      fc.property(codecArb, extArb, (codec, ext) => {
        const result = isExtensionCompatibleWithVideoCodec(ext, codec);
        expect(typeof result).toBe('boolean');
      }),
      { seed: 12345 },
    );
  });
});

describe('audio codec lookups never throw', () => {
  it('getAudioCodecContainers always returns an array of strings', () => {
    fc.assert(
      fc.property(codecArb, (codec) => {
        const result = getAudioCodecContainers(codec);
        expect(Array.isArray(result)).toBe(true);
        for (const ext of result) {
          expect(typeof ext).toBe('string');
        }
      }),
      { seed: 12345 },
    );
  });

  it('returns "" for an audio codec that is not in the map', () => {
    // Documented contract: '' means "no suggestion", which is how a video codec
    // or any unknown encoder is handled. Not every input maps to a container.
    fc.assert(
      fc.property(fc.oneof(fc.constant('h264'), fc.constant(''), fc.constant('definitely-not-a-codec')), (codec) => {
        expect(suggestedExtensionForAudioCodec(codec)).toBe('');
      }),
      { seed: 12345 },
    );
  });

  it('every suggested audio extension is a listed container extension', () => {
    // Keys of AUDIO_CONTAINERS: the encoder names ffmpeg expects, which are not
    // always the decoder names ffprobe reports (e.g. libopus, not opus).
    const realAudioCodecs = ['aac', 'flac', 'ac3', 'libmp3lame', 'libopus'];
    fc.assert(
      fc.property(fc.constantFrom(...realAudioCodecs), (codec) => {
        const ext = suggestedExtensionForAudioCodec(codec);
        expect(ext).not.toBe('');
        expect(AUDIO_CONTAINER_EXTENSIONS).toContain(ext);
      }),
      { seed: 12345 },
    );
  });
});

describe('extension helpers never throw', () => {
  it('getExtension always returns a string', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(undefined)), (path) => {
        expect(typeof getExtension(path)).toBe('string');
      }),
      { seed: 12345 },
    );
  });

  it('replaceExtension never throws and never returns undefined', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (path, ext) => {
        const result = replaceExtension(path, ext);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/undefined/);
      }),
      { seed: 12345 },
    );
  });

  it('withExtension never throws and never returns undefined', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (path, ext) => {
        const result = withExtension(path, ext);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/undefined/);
      }),
      { seed: 12345 },
    );
  });

  it('withExtension is idempotent for an already-correct extension', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/), (name) => {
        const once = withExtension(`${name}.mp4`, 'mkv');
        expect(withExtension(once, 'mkv')).toBe(once);
      }),
      { seed: 12345 },
    );
  });
});

describe('subtitle and container compatibility never throw', () => {
  it('isSubtitleCodecCompatibleWithContainer always returns a boolean', () => {
    fc.assert(
      fc.property(codecArb, extArb, (codec, ext) => {
        expect(typeof isSubtitleCodecCompatibleWithContainer(codec, ext)).toBe('boolean');
      }),
      { seed: 12345 },
    );
  });

  it('isSubtitleCodecAllowed always returns a boolean', () => {
    fc.assert(
      fc.property(codecArb, extArb, (codec, ext) => {
        expect(typeof isSubtitleCodecAllowed(codec, ext)).toBe('boolean');
      }),
      { seed: 12345 },
    );
  });

  it('isContainerCompatibleWithCover/Chapters always return a boolean', () => {
    fc.assert(
      fc.property(extArb, (ext) => {
        expect(typeof isContainerCompatibleWithCover(ext)).toBe('boolean');
        expect(typeof isContainerCompatibleWithChapters(ext)).toBe('boolean');
      }),
      { seed: 12345 },
    );
  });

  it('isContainerCompatibleWithStream always returns a boolean for any stream shape', () => {
    fc.assert(
      fc.property(extArb, (ext) => {
        const streams: unknown[] = [
          undefined,
          null,
          {},
          { type: 'video', codec: 'h264' },
          { type: 'audio', codec: 'aac' },
          { type: 'subtitle', codec: 'subrip' },
          { type: 'subtitle', codec: 'hdmv_pgs_subtitle' },
          { index: 0, type: 'data', codec: '' },
        ];
        for (const stream of streams) {
          const result = isContainerCompatibleWithStream(ext, stream as MediaStreamInfo);
          expect(typeof result).toBe('boolean');
        }
      }),
      { seed: 12345 },
    );
  });

  it('isBitmapSubtitleCodec always returns a boolean', () => {
    fc.assert(
      fc.property(fc.oneof(codecArb, fc.constant(undefined)), (codec) => {
        expect(typeof isBitmapSubtitleCodec(codec)).toBe('boolean');
      }),
      { seed: 12345 },
    );
  });
});
