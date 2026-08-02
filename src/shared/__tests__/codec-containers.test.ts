import { describe, it, expect } from 'vitest';
import {
  classifyVideoCodec,
  suggestedExtensionForVideoCodec,
  suggestedExtensionForAudioCodec,
  isExtensionCompatibleWithVideoCodec,
  getExtension,
  replaceExtension,
} from '../codec-containers';

describe('classifyVideoCodec', () => {
  it('classifies H.264 families', () => {
    expect(classifyVideoCodec('libx264')).toBe('h264');
    expect(classifyVideoCodec('h264_nvenc')).toBe('h264');
    expect(classifyVideoCodec('h264_qsv')).toBe('h264');
    expect(classifyVideoCodec('h264_videotoolbox')).toBe('h264');
  });

  it('classifies H.265/HEVC families', () => {
    expect(classifyVideoCodec('libx265')).toBe('h265');
    expect(classifyVideoCodec('hevc_nvenc')).toBe('h265');
    expect(classifyVideoCodec('hevc_amf')).toBe('h265');
  });

  it('classifies VP8, VP9 and AV1', () => {
    expect(classifyVideoCodec('libvpx')).toBe('vp8');
    expect(classifyVideoCodec('libvpx-vp9')).toBe('vp9');
    expect(classifyVideoCodec('vp9_vaapi')).toBe('vp9');
    expect(classifyVideoCodec('libaom-av1')).toBe('av1');
    expect(classifyVideoCodec('av1_nvenc')).toBe('av1');
  });

  it('classifies legacy and niche codecs', () => {
    expect(classifyVideoCodec('libtheora')).toBe('theora');
    expect(classifyVideoCodec('prores_ks')).toBe('prores');
    expect(classifyVideoCodec('dnxhd')).toBe('dnx');
    expect(classifyVideoCodec('mpeg2video')).toBe('mpeg2');
    expect(classifyVideoCodec('mpeg1video')).toBe('mpeg1');
    expect(classifyVideoCodec('mjpeg')).toBe('mjpeg');
    expect(classifyVideoCodec('mpeg4')).toBe('mpeg4');
  });

  it('falls back to other for unknown codecs', () => {
    expect(classifyVideoCodec('snow')).toBe('other');
    expect(classifyVideoCodec(undefined)).toBe('other');
    expect(classifyVideoCodec('')).toBe('other');
  });
});

describe('suggestedExtensionForVideoCodec', () => {
  it('maps codec families to container extensions', () => {
    expect(suggestedExtensionForVideoCodec('libx264')).toBe('mp4');
    expect(suggestedExtensionForVideoCodec('libx265')).toBe('mp4');
    expect(suggestedExtensionForVideoCodec('libvpx-vp9')).toBe('webm');
    expect(suggestedExtensionForVideoCodec('libaom-av1')).toBe('webm');
    expect(suggestedExtensionForVideoCodec('libtheora')).toBe('ogv');
    expect(suggestedExtensionForVideoCodec('prores_ks')).toBe('mov');
    expect(suggestedExtensionForVideoCodec('mpeg2video')).toBe('mpg');
  });
});

describe('isExtensionCompatibleWithVideoCodec', () => {
  it('accepts valid container/codec pairs', () => {
    expect(isExtensionCompatibleWithVideoCodec('mp4', 'libx264')).toBe(true);
    expect(isExtensionCompatibleWithVideoCodec('mkv', 'libx265')).toBe(true);
    expect(isExtensionCompatibleWithVideoCodec('webm', 'libvpx-vp9')).toBe(true);
  });

  it('rejects invalid container/codec pairs', () => {
    expect(isExtensionCompatibleWithVideoCodec('mp4', 'libvpx')).toBe(false);
    expect(isExtensionCompatibleWithVideoCodec('avi', 'libtheora')).toBe(false);
    expect(isExtensionCompatibleWithVideoCodec('mp4', 'prores_ks')).toBe(false);
  });

  it('handles dot-prefixed and case-insensitive extensions', () => {
    expect(isExtensionCompatibleWithVideoCodec('.MP4', 'libx264')).toBe(true);
    expect(isExtensionCompatibleWithVideoCodec('WEBM', 'libvpx-vp9')).toBe(true);
  });
});

describe('suggestedExtensionForAudioCodec', () => {
  it('maps audio codecs to container extensions', () => {
    expect(suggestedExtensionForAudioCodec('libmp3lame')).toBe('mp3');
    expect(suggestedExtensionForAudioCodec('aac')).toBe('m4a');
    expect(suggestedExtensionForAudioCodec('flac')).toBe('flac');
    expect(suggestedExtensionForAudioCodec('libvorbis')).toBe('ogg');
    expect(suggestedExtensionForAudioCodec('libopus')).toBe('opus');
    expect(suggestedExtensionForAudioCodec('pcm_s16le')).toBe('wav');
    expect(suggestedExtensionForAudioCodec('wmav2')).toBe('wma');
  });

  it('returns an empty string for unknown or missing codecs', () => {
    expect(suggestedExtensionForAudioCodec('nonexistent')).toBe('');
    expect(suggestedExtensionForAudioCodec(undefined)).toBe('');
    expect(suggestedExtensionForAudioCodec('')).toBe('');
  });
});

describe('getExtension', () => {
  it('extracts the extension', () => {
    expect(getExtension('/a/b/video.MP4')).toBe('mp4');
    expect(getExtension('video.webm')).toBe('webm');
  });

  it('returns an empty string when there is no extension', () => {
    expect(getExtension('/a/b/video')).toBe('');
    expect(getExtension(undefined)).toBe('');
  });
});

describe('replaceExtension', () => {
  it('swaps the extension', () => {
    expect(replaceExtension('/a/b/video.mp4', 'webm')).toBe('/a/b/video.webm');
    expect(replaceExtension('video.MP4', 'webm')).toBe('video.webm');
  });

  it('keeps dot-prefixed extensions', () => {
    expect(replaceExtension('video.mp4', '.mkv')).toBe('video.mkv');
  });
});
