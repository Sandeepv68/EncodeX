import { describe, it, expect } from 'vitest';
import {
  classifyVideoCodec,
  suggestedExtensionForVideoCodec,
  suggestedExtensionForAudioCodec,
  isExtensionCompatibleWithVideoCodec,
  getExtension,
  replaceExtension,
  withExtension,
  isSubtitleCodecCompatibleWithContainer,
  isSubtitleCodecAllowed,
  isContainerCompatibleWithCover,
  isContainerCompatibleWithChapters,
  isContainerCompatibleWithStream,
  remuxWarnings,
  suggestedExtensionForStream,
  audioCodecToExtension,
  buildDemuxTargets,
  demuxWarnings,
} from '../codec-containers';
import type { MediaStreamInfo } from '../types';

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

describe('withExtension', () => {
  it('replaces an existing extension', () => {
    expect(withExtension('/a/b/video.mp4', 'webm')).toBe('/a/b/video.webm');
    expect(withExtension('video.MP4', 'mkv')).toBe('video.mkv');
  });

  it('appends the extension when the file name has none', () => {
    expect(withExtension('/a/b/video', 'mkv')).toBe('/a/b/video.mkv');
    expect(withExtension('video', 'mp4')).toBe('video.mp4');
  });

  it('ignores dots in directory names when locating the extension', () => {
    expect(withExtension('/a.b/c/video', 'mp4')).toBe('/a.b/c/video.mp4');
    expect(withExtension('/a.b/c/video.raw', 'mkv')).toBe('/a.b/c/video.mkv');
  });

  it('handles Windows separators', () => {
    expect(withExtension('C:\\shows\\episode.1', 'mkv')).toBe('C:\\shows\\episode.mkv');
    expect(withExtension('C:\\shows\\episode', 'mkv')).toBe('C:\\shows\\episode.mkv');
  });
});

const SAMPLE_STREAMS = {
  h264Video: { index: 0, type: 'video', codec: 'h264' },
  aacAudio: { index: 1, type: 'audio', codec: 'aac' },
  subripSub: { index: 2, type: 'subtitle', codec: 'subrip' },
  assSub: { index: 3, type: 'subtitle', codec: 'ass' },
  webvttSub: { index: 4, type: 'subtitle', codec: 'webvtt' },
  pgsSub: { index: 5, type: 'subtitle', codec: 'hdmv_pgs_subtitle' },
} as const;

describe('isSubtitleCodecCompatibleWithContainer', () => {
  it('accepts subrip into srt/mkv and rejects it inside webvtt', () => {
    expect(isSubtitleCodecCompatibleWithContainer('subrip', 'srt')).toBe(true);
    expect(isSubtitleCodecCompatibleWithContainer('subrip', 'mkv')).toBe(true);
    expect(isSubtitleCodecCompatibleWithContainer('subrip', 'webvtt')).toBe(false);
  });

  it('accepts pgs into mkv and rejects it into mp4', () => {
    expect(isSubtitleCodecCompatibleWithContainer('hdmv_pgs_subtitle', 'mkv')).toBe(true);
    expect(isSubtitleCodecCompatibleWithContainer('hdmv_pgs_subtitle', 'mp4')).toBe(false);
  });
});

describe('isSubtitleCodecAllowed', () => {
  it('honors the SUBTITLE_CODEC_CONTAINERS guidance', () => {
    expect(isSubtitleCodecAllowed('mov_text', 'mp4')).toBe(true);
    expect(isSubtitleCodecAllowed('subrip', 'mp4')).toBe(true);
    expect(isSubtitleCodecAllowed('ass', 'webm')).toBe(false);
  });
});

describe('isContainerCompatibleWithCover', () => {
  it('allows attached pictures in mkv/webm and disposition in mp4/mov', () => {
    expect(isContainerCompatibleWithCover('mkv')).toBe(true);
    expect(isContainerCompatibleWithCover('webm')).toBe(true);
    expect(isContainerCompatibleWithCover('mp4')).toBe(true);
    expect(isContainerCompatibleWithCover('mov')).toBe(true);
    expect(isContainerCompatibleWithCover('avi')).toBe(false);
  });
});

describe('isContainerCompatibleWithChapters', () => {
  it('stores chapters in mp4/mov/mkv but not webm', () => {
    expect(isContainerCompatibleWithChapters('mp4')).toBe(true);
    expect(isContainerCompatibleWithChapters('mov')).toBe(true);
    expect(isContainerCompatibleWithChapters('mkv')).toBe(true);
    expect(isContainerCompatibleWithChapters('webm')).toBe(false);
    expect(isContainerCompatibleWithChapters('avi')).toBe(false);
  });
});

describe('isContainerCompatibleWithStream', () => {
  it('checks video against its codec family', () => {
    expect(isContainerCompatibleWithStream('.mkv', SAMPLE_STREAMS.h264Video)).toBe(true);
    expect(isContainerCompatibleWithStream('webm', SAMPLE_STREAMS.h264Video)).toBe(false);
  });

  it('declares audio compatible by default', () => {
    expect(isContainerCompatibleWithStream('avi', SAMPLE_STREAMS.aacAudio)).toBe(true);
  });

  it('checks subtitles against the subtitle map', () => {
    expect(isContainerCompatibleWithStream('mkv', SAMPLE_STREAMS.pgsSub)).toBe(true);
    expect(isContainerCompatibleWithStream('mp4', SAMPLE_STREAMS.pgsSub)).toBe(false);
  });
});

describe('remuxWarnings', () => {
  it('reports incompatible source streams with their stream reference', () => {
    const warnings = remuxWarnings([SAMPLE_STREAMS.h264Video, SAMPLE_STREAMS.pgsSub], undefined, undefined, 'mp4');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].icon).toBe('error');
    expect(warnings[0].stream?.codec).toBe('hdmv_pgs_subtitle');
  });

  it('reports attached covers only for non-mkv/webm containers', () => {
    const warnings = remuxWarnings([], [{ path: 'cover.jpg', map: [], attachment: true }], undefined, 'mp4');
    expect(warnings.some((w) => w.code === 'coverNotSupported')).toBe(true);
  });

  it('reports chapters dropped for webm', () => {
    const warnings = remuxWarnings([], undefined, 'chapters.txt', 'webm');
    expect(warnings.some((w) => w.code === 'chaptersUnsupported')).toBe(true);
  });

  it('returns no warnings for a clean mkv remux', () => {
    const warnings = remuxWarnings([SAMPLE_STREAMS.h264Video, SAMPLE_STREAMS.aacAudio], undefined, undefined, 'mkv');
    expect(warnings).toHaveLength(0);
  });

  it('reports filters_force_reencode when a video filter chain is given', () => {
    const warnings = remuxWarnings([SAMPLE_STREAMS.h264Video], undefined, undefined, 'mkv', ['fps=30']);
    expect(warnings.some((w) => w.code === 'filters_force_reencode')).toBe(true);
  });

  it('does not report filters_force_reencode for an empty chain', () => {
    const warnings = remuxWarnings([SAMPLE_STREAMS.h264Video], undefined, undefined, 'mkv', []);
    expect(warnings.some((w) => w.code === 'filters_force_reencode')).toBe(false);
  });
});

describe('suggestedExtensionForStream', () => {
  it('suggests per-kind extensions', () => {
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.h264Video)).toBe('mp4');
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.aacAudio)).toBe('m4a');
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.subripSub)).toBe('srt');
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.pgsSub)).toBe('mks');
  });

  it('preserves the native text-subtitle extension on copy', () => {
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.assSub)).toBe('ass');
    expect(suggestedExtensionForStream(SAMPLE_STREAMS.webvttSub)).toBe('vtt');
  });
});

describe('demuxWarnings', () => {
  it('returns no warnings when subtitle conversion is not requested', () => {
    expect(demuxWarnings([SAMPLE_STREAMS.pgsSub, SAMPLE_STREAMS.subripSub])).toEqual([]);
    expect(demuxWarnings([SAMPLE_STREAMS.pgsSub], { subtitleCodec: 'copy' })).toEqual([]);
  });

  it('warns for every selected bitmap subtitle when a text conversion is requested', () => {
    const warnings = demuxWarnings([SAMPLE_STREAMS.subripSub, SAMPLE_STREAMS.pgsSub], { subtitleCodec: 'srt' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      icon: 'warning',
      code: 'bitmapSubtitleWarning',
      stream: SAMPLE_STREAMS.pgsSub,
    });
  });

  it('leaves text subtitles alone and reports all bitmap subtitle codecs', () => {
    const warnings = demuxWarnings([SAMPLE_STREAMS.assSub, SAMPLE_STREAMS.webvttSub, SAMPLE_STREAMS.subripSub, SAMPLE_STREAMS.pgsSub], {
      subtitleCodec: 'ass',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.stream).toEqual(SAMPLE_STREAMS.pgsSub);
  });

  it('warns that video filters are ignored while the video target is Copy', () => {
    const warnings = demuxWarnings([SAMPLE_STREAMS.h264Video], { videoFilters: ['fps=30'] });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ icon: 'warning', code: 'filtersIgnoredCopy' });
  });

  it('does not warn about ignored filters for a re-encoding video target', () => {
    const warnings = demuxWarnings([SAMPLE_STREAMS.h264Video], { videoContainer: 'webm', videoFilters: ['fps=30'] });
    expect(warnings.some((w) => w.code === 'filtersIgnoredCopy')).toBe(false);
  });

  it('does not warn about ignored filters when no filter chain is given', () => {
    expect(demuxWarnings([SAMPLE_STREAMS.h264Video], { videoFilters: [] })).toEqual([]);
  });
});

describe('audioCodecToExtension', () => {
  it('resolves encoder long names and user-facing short names', () => {
    expect(audioCodecToExtension('libmp3lame')).toBe('mp3');
    expect(audioCodecToExtension('mp3')).toBe('mp3');
    expect(audioCodecToExtension('aac')).toBe('m4a');
    expect(audioCodecToExtension('flac')).toBe('flac');
    expect(audioCodecToExtension('wav')).toBe('wav');
  });

  it('falls back to empty for unknown codecs', () => {
    expect(audioCodecToExtension('not-a-codec')).toBe('');
  });
});

describe('buildDemuxTargets', () => {
  // Typed rather than `as const` for the same reason as `remux-utils.test.ts`:
  // `buildDemuxTargets` takes a mutable `MediaStreamInfo[]`.
  const streams: MediaStreamInfo[] = [
    SAMPLE_STREAMS.h264Video,
    { index: 1, type: 'audio', codec: 'aac', channels: 2 },
    { index: 2, type: 'audio', codec: 'ac3', channels: 6 },
    { index: 3, type: 'subtitle', codec: 'subrip' },
    { index: 4, type: 'subtitle', codec: 'hdmv_pgs_subtitle' },
  ];

  it('names copy targets basename.kind[ordinal].ext in stream order', () => {
    const targets = buildDemuxTargets(
      '/in/movie.mp4',
      'movie',
      streams.map((s) => s),
    );
    expect(targets).toEqual([
      expect.objectContaining({ index: 0, kind: 'video', map: '0:v:0', copy: true, output: 'movie.video.mp4' }),
      expect.objectContaining({ index: 1, kind: 'audio', map: '0:a:0', copy: true, output: 'movie.audio_0.m4a' }),
      expect.objectContaining({ index: 2, kind: 'audio', map: '0:a:1', copy: true, output: 'movie.audio_1.ac3' }),
      expect.objectContaining({ index: 3, kind: 'subtitle', map: '0:s:0', copy: true, output: 'movie.subtitle_0.srt' }),
      expect.objectContaining({ index: 4, kind: 'subtitle', map: '0:s:1', copy: true, output: 'movie.subtitle_1.mks' }),
    ]);
  });

  it('converts audio when audioCodec is set', () => {
    const targets = buildDemuxTargets('/in/movie.mp4', 'movie', [streams[2]], { audioCodec: 'mp3' });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: false, codec: 'mp3', output: 'movie.audio_0.mp3' }));
  });

  it('re-encodes video to a requested container', () => {
    const targets = buildDemuxTargets('/in/movie.mp4', 'movie', [streams[0]], { videoContainer: 'webm' });
    expect(targets[0]).toEqual(
      expect.objectContaining({ copy: false, codec: 'libvpx-vp9', container: 'webm', output: 'movie.video.webm' }),
    );
  });

  it('keeps video copy when the requested container matches its native ext', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[0]], { videoContainer: 'mp4' });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: true, output: 'movie.video.mp4' }));
  });

  it('converts text subtitles and leaves bitmap subs as mks regardless', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[3], streams[4]], { subtitleCodec: 'srt' });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: false, codec: 'srt', output: 'movie.subtitle_0.srt' }));
    expect(targets[1]).toEqual(expect.objectContaining({ copy: true, output: 'movie.subtitle_1.mks' }));
  });

  it('converts text subtitles to ass', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[3]], { subtitleCodec: 'ass' });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: false, codec: 'ass', output: 'movie.subtitle_0.ass' }));
  });

  it('converts text subtitles to webvtt with a vtt extension', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[3]], { subtitleCodec: 'webvtt' });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: false, codec: 'webvtt', output: 'movie.subtitle_0.vtt' }));
  });

  it('preserves the native copy extension for ass and webvtt text subtitles', () => {
    const assTarget = buildDemuxTargets('/in/movie.mkv', 'movie', [{ index: 0, type: 'subtitle', codec: 'ass' }]);
    expect(assTarget[0]).toEqual(expect.objectContaining({ copy: true, output: 'movie.subtitle_0.ass' }));
    const webvttTarget = buildDemuxTargets('/in/movie.mkv', 'movie', [{ index: 0, type: 'subtitle', codec: 'webvtt' }]);
    expect(webvttTarget[0]).toEqual(expect.objectContaining({ copy: true, output: 'movie.subtitle_0.vtt' }));
  });

  it('carries the filter chain onto a re-encoding video target', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[0]], {
      videoContainer: 'webm',
      videoFilters: ['fps=30', 'hue=s=0'],
    });
    expect(targets[0]).toEqual(expect.objectContaining({ copy: false, videoFilters: ['fps=30', 'hue=s=0'] }));
  });

  it('drops the filter chain from a copied video target', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', [streams[0]], { videoFilters: ['fps=30'] });
    expect(targets[0].copy).toBe(true);
    expect(targets[0].videoFilters ?? []).toEqual([]);
  });

  it('never attaches the video filter chain to audio or subtitle targets', () => {
    const targets = buildDemuxTargets('/in/movie.mkv', 'movie', streams, {
      videoContainer: 'webm',
      videoFilters: ['fps=30'],
    });
    const audioTarget = targets.find((t) => t.kind === 'audio');
    const subtitleTarget = targets.find((t) => t.kind === 'subtitle');
    expect(audioTarget?.videoFilters ?? []).toEqual([]);
    expect(subtitleTarget?.videoFilters ?? []).toEqual([]);
  });
});
