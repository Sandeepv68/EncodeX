/**
 * @fileoverview Unit tests for the `compress` and `extract-audio` CLI
 * subcommand helpers (cli-compress.ts): buildCompressFlags plus the output
 * path/flag derivation used by runCompress and runExtractAudio.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildCompressFlags } from '../cli-compress';
import { deriveOutputPath } from '../cli-util';
import { AUDIO_EXTRACT_DEFAULT_CODEC } from '../../../shared/constants';
import { suggestedExtensionForAudioCodec } from '../../../shared/codec-containers';

describe('buildCompressFlags', () => {
  it('maps the source format to its image encoder and defaults quality to 23', () => {
    const flags = buildCompressFlags('/a/b/photo.png', {});
    expect(flags.videoCodec).toBe('png');
    expect(flags.qscale).toBe('23');
    expect(flags.scale).toBeUndefined();
  });

  it('uses the requested format when given', () => {
    const flags = buildCompressFlags('/a/b/photo.png', { format: 'webp' });
    expect(flags.videoCodec).toBe('libwebp');
  });

  it('falls back to jpeg for unknown formats', () => {
    const flags = buildCompressFlags('/a/b/photo.xyz', {});
    expect(flags.videoCodec).toBe('mjpeg');
  });

  it('passes through scale and an explicit quality', () => {
    const flags = buildCompressFlags('/a/b/photo.png', { scale: '50%', quality: '28' });
    expect(flags.scale).toBe('50%');
    expect(flags.qscale).toBe('28');
  });
});

describe('runCompress output derivation', () => {
  it('derives a _compressed output in the requested format', () => {
    const format = 'jpg';
    const output = deriveOutputPath('/a/b/photo.png', { suffix: '_compressed', outputExt: format });
    expect(output).toBe(path.join('/a/b', 'photo_compressed.jpg'));
  });
});

describe('runExtractAudio output derivation', () => {
  it('derives an extension from the default audio codec', () => {
    const ext = suggestedExtensionForAudioCodec(AUDIO_EXTRACT_DEFAULT_CODEC) || 'mp3';
    const output = deriveOutputPath('/a/b/video.mkv', { suffix: '', outputExt: ext });
    expect(output).toBe(path.join('/a/b', `video.${ext}`));
  });
});
