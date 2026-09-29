import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCompressPlan,
  buildExtractAudioPlan,
  buildCutPlan,
  buildBatchPlan,
  buildRemuxPlan,
  buildDemuxPlan,
  buildDemuxJobOptions,
} from '../operations';
import type { MCPRemuxFields } from '../operations';
import type { MediaStreamInfo } from '../../shared/types';

function tempMedia(ext: string, name = 'clip'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-'));
  const file = path.join(dir, `${name}.${ext}`);
  fs.writeFileSync(file, 'fake');
  return file;
}

function stream(partial: Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }): MediaStreamInfo {
  return { index: 0, codec: 'unknown', ...partial } as MediaStreamInfo;
}

const PROBED: MediaStreamInfo[] = [
  stream({ index: 0, type: 'video', codec: 'h264' }),
  stream({ index: 1, type: 'audio', codec: 'aac' }),
  stream({ index: 2, type: 'subtitle', codec: 'subrip' }),
];

describe('buildCompressPlan', () => {
  it('defaults the format to the source extension and maps the image codec', () => {
    const input = tempMedia('jpg');
    const plan = buildCompressPlan(input, {});
    expect(plan.format).toBe('jpg');
    expect(plan.options.videoCodec).toBe('mjpeg');
    expect(plan.options.qscale).toBe(23);
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip_compressed.jpg'));
  });

  it('maps png/webp formats and honors explicit quality and scale', () => {
    const input = tempMedia('png');
    const plan = buildCompressPlan(input, { format: 'WEBP', quality: 15, scale: '50%' });
    expect(plan.format).toBe('webp');
    expect(plan.options.videoCodec).toBe('libwebp');
    expect(plan.options.qscale).toBe(15);
    expect(plan.options.scale).toBe('50%');
    expect(plan.output.endsWith('.webp')).toBe(true);
  });

  it('drops out-of-range quality and uses an explicit output when given', () => {
    const input = tempMedia('jpg');
    const plan = buildCompressPlan(input, { quality: 99 });
    expect(plan.options.qscale).toBeUndefined();
    const explicit = buildCompressPlan(input, { output: 'C:\\out\\thumb.webp', format: 'webp' });
    expect(explicit.output).toBe('C:\\out\\thumb.webp');
  });
});

describe('buildExtractAudioPlan', () => {
  it('defaults to mp3 with 192k and drops the video stream', () => {
    const input = tempMedia('mp4');
    const plan = buildExtractAudioPlan(input, {});
    expect(plan.audioCodec).toBe('libmp3lame');
    expect(plan.ext).toBe('mp3');
    expect(plan.options).toMatchObject({ audioCodec: 'libmp3lame', audioBitrate: '192k', video: false });
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip.mp3'));
  });

  it('derives the extension and bitrate from explicit fields', () => {
    const input = tempMedia('mkv');
    const plan = buildExtractAudioPlan(input, { audioCodec: 'aac', bitrate: '128k' });
    expect(plan.ext).toBe('m4a');
    expect(plan.options.audioCodec).toBe('aac');
    expect(plan.options.audioBitrate).toBe('128k');
    expect(plan.output.endsWith('.m4a')).toBe(true);
  });

  it('uses an explicit output when given', () => {
    const input = tempMedia('mp4');
    const plan = buildExtractAudioPlan(input, { output: 'C:\\out\\sound.wav', audioCodec: 'pcm_s16le' });
    expect(plan.output).toBe('C:\\out\\sound.wav');
    expect(plan.ext).toBe('wav');
  });
});

describe('buildCutPlan', () => {
  it('defaults to lossless stream copy with a _cut suffix and the source extension', () => {
    const input = tempMedia('mp4');
    const plan = buildCutPlan(input, { startTime: '00:01:00', endTime: '00:02:00' });
    expect(plan.options.copy).toBe(true);
    expect(plan.options.startTime).toBe('00:01:00');
    expect(plan.options.endTime).toBe('00:02:00');
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip_cut.mp4'));
  });

  it('honors duration, audio exclusion, and re-encode mode', () => {
    const input = tempMedia('mkv');
    const plan = buildCutPlan(input, { duration: '30', copy: false, audio: false });
    expect(plan.options.copy).toBe(false);
    expect(plan.options.duration).toBe('30');
    expect(plan.options.audio).toBe(false);
  });

  it('uses an explicit output when given', () => {
    const input = tempMedia('mp4');
    const plan = buildCutPlan(input, { output: 'C:\\out\\segment.mp4' });
    expect(plan.output).toBe('C:\\out\\segment.mp4');
  });
});

describe('buildBatchPlan', () => {
  it('expands inputs and derives per-file outputs with the default suffix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-'));
    fs.writeFileSync(path.join(dir, 'a.mp4'), 'x');
    fs.writeFileSync(path.join(dir, 'b.mp4'), 'x');
    const plan = buildBatchPlan([`${dir}/*.mp4`], { videoCodec: 'libx264' });
    expect(plan.jobs).toHaveLength(2);
    expect(plan.suffix).toBe('_encodex_converted');
    for (const job of plan.jobs) {
      expect(job.output).toContain('_encodex_converted');
      expect(job.output.endsWith('.mp4')).toBe(true);
      expect(job.options.videoCodec).toBe('libx264');
    }
  });

  it('projects outputs into outputDir with a custom suffix', () => {
    const input = tempMedia('mp4');
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-out-'));
    const plan = buildBatchPlan([input], { videoCodec: 'libx264' }, outDir, '_done');
    expect(plan.jobs[0].output).toBe(path.join(outDir, 'clip_done.mp4'));
  });

  it('keeps the source extension in copy mode and audio-only mode', () => {
    const inputA = tempMedia('mp4');
    const planCopy = buildBatchPlan([inputA], { copy: true });
    expect(planCopy.jobs[0].output.endsWith('.mp4')).toBe(true);
    const inputB = tempMedia('flac', 'song');
    const planAudio = buildBatchPlan([inputB], { video: false, audioCodec: 'flac' });
    expect(planAudio.jobs[0].output.endsWith('.flac')).toBe(true);
  });

  it('returns an empty plan when nothing matches', () => {
    const plan = buildBatchPlan(['C:\\no-such-dir\\**\\*.mp4'], {});
    expect(plan.jobs).toHaveLength(0);
  });
});

describe('buildRemuxPlan', () => {
  it('defaults to the input container and selects every probed stream in copy mode', () => {
    const input = tempMedia('mp4');
    const plan = buildRemuxPlan(input, {}, PROBED);
    expect(plan.container).toBe('mp4');
    expect(plan.options.copy).toBe(true);
    expect(plan.options.map).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    expect(plan.output).toBe(path.join(path.dirname(input), 'clip.mp4'));
    expect(plan.options.copyChapters).toBe(true);
  });

  it('derives the container from the output extension and honors explicit maps', () => {
    const input = tempMedia('mp4');
    const plan = buildRemuxPlan(input, { output: 'C:\\out\\movie.mkv', map: ['0:v:0', '0:a:0'] }, PROBED);
    expect(plan.container).toBe('mkv');
    expect(plan.output).toBe('C:\\out\\movie.mkv');
    expect(plan.options.map).toEqual(['0:v:0', '0:a:0']);
  });

  it('drops subtitle streams from the default selection when subtitles are false', () => {
    const plan = buildRemuxPlan(tempMedia('mkv'), { subtitles: false }, PROBED);
    expect(plan.options.map).toEqual(['0:v:0', '0:a:0']);
  });

  it('numbers added subtitle/audio inputs and applies the subtitle codec precedence', () => {
    const input = tempMedia('mp4');
    const fields: MCPRemuxFields = {
      container: 'mkv',
      addSubtitle: [{ file: 'C:\\subs\\forced.ass', codec: 'ass' }, { file: 'C:\\subs\\forced.srt' }],
      addAudio: [{ file: 'C:\\audio\\commentary.m4a', syncOffsetSeconds: -1.5 }],
    };
    const plan = buildRemuxPlan(input, fields, PROBED);
    const added = plan.options.additionalInputs ?? [];
    expect(added).toHaveLength(3);
    expect(added[0]).toMatchObject({ path: 'C:\\subs\\forced.ass', map: ['1:0'], codec: 'ass' });
    expect(added[1]).toMatchObject({ path: 'C:\\subs\\forced.srt', map: ['2:0'], codec: 'subrip' });
    expect(added[2]).toMatchObject({ path: 'C:\\audio\\commentary.m4a', map: ['3:0'], codec: 'copy', syncOffsetSeconds: -1.5 });
  });

  it('lets subtitleCodec override the per-file codec', () => {
    const plan = buildRemuxPlan(
      tempMedia('mp4'),
      { container: 'mp4', addSubtitle: [{ file: 'a.ass', codec: 'ass' }], subtitleCodec: 'mov_text' },
      PROBED,
    );
    expect(plan.options.additionalInputs?.[0]).toMatchObject({ codec: 'mov_text' });
  });

  it('attaches cover art for mkv and maps it as attached_pic for mp4', () => {
    const mkv = buildRemuxPlan(tempMedia('mp4'), { container: 'mkv', thumbnail: { file: 'cover.jpg' } }, PROBED);
    expect(mkv.options.additionalInputs?.at(-1)).toMatchObject({ path: 'cover.jpg', map: [], attachment: true });

    const mp4 = buildRemuxPlan(tempMedia('mkv'), { container: 'mp4', thumbnail: { file: 'cover.jpg' } }, PROBED);
    expect(mp4.options.additionalInputs?.at(-1)).toMatchObject({ path: 'cover.jpg', map: ['1:0'], disposition: 'attached_pic' });
  });

  it('rejects cover art the container cannot store', () => {
    expect(() => buildRemuxPlan(tempMedia('mkv'), { container: 'avi', thumbnail: { file: 'cover.jpg' } }, PROBED)).toThrow(
      /cannot store cover art/,
    );
    expect(() =>
      buildRemuxPlan(tempMedia('mkv'), { container: 'mp4', thumbnail: { file: 'cover.jpg', type: 'attachment' } }, PROBED),
    ).toThrow(/cannot store attached cover art/);
  });

  it('imports a chapters file and rejects containers that drop chapters', () => {
    const ok = buildRemuxPlan(tempMedia('mp4'), { container: 'mkv', chapters: { file: 'meta.txt' } }, PROBED);
    expect(ok.options.chaptersFile).toBe('meta.txt');
    expect(() => buildRemuxPlan(tempMedia('mp4'), { container: 'ts', chapters: { file: 'meta.txt' } }, PROBED)).toThrow(
      /does not store chapters/,
    );
  });

  it('keeps source chapters for the "source" chapters value', () => {
    const plan = buildRemuxPlan(tempMedia('mkv'), { chapters: 'source' }, PROBED);
    expect(plan.options.copyChapters).toBe(true);
    expect(plan.options.chaptersFile).toBeUndefined();
  });

  it('applies the audio re-read trick for audioSyncSeconds', () => {
    const plan = buildRemuxPlan(tempMedia('mp4'), { audioSyncSeconds: 2 }, PROBED);
    expect(plan.options.map).toEqual(['0:v:0', '0:s:0']);
    expect(plan.options.additionalInputs?.at(-1)).toMatchObject({ path: expect.stringContaining('clip.mp4'), syncOffsetSeconds: 2 });
    expect(plan.options.extraArgs).toEqual(['-c:a', 'copy']);
  });

  it('rejects a stream copy the container cannot hold', () => {
    const streams = [stream({ index: 0, type: 'video', codec: 'theora' }), stream({ index: 1, type: 'audio', codec: 'aac' })];
    try {
      buildRemuxPlan(tempMedia('mkv'), { container: 'mp4' }, streams);
      expect.unreachable('expected INCOMPATIBLE_CONTAINER');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('INCOMPATIBLE_CONTAINER');
    }
  });

  it('requires a determinable container', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-noext-'));
    const input = path.join(dir, 'noextension');
    fs.writeFileSync(input, 'x');
    expect(() => buildRemuxPlan(input, {})).toThrow(/requires a target container/);
  });

  it('turns the copy into a re-encode when videoFilters are given', () => {
    const input = tempMedia('mkv');
    const plan = buildRemuxPlan(input, { videoFilters: ['fps=30', 'hue=s=0'] }, PROBED);
    expect(plan.options.copy).toBe(false);
    expect(plan.options.videoFilters).toEqual(['fps=30', 'hue=s=0']);
    expect(plan.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(true);
  });

  it('expands the preset.value shorthand in a videoFilters list', () => {
    const plan = buildRemuxPlan(tempMedia('mkv'), { videoFilters: ['framerate.60', 'deinterlace.tff'] }, PROBED);
    expect(plan.options.videoFilters).toEqual(['fps=60', 'yadif=1']);
  });

  it('rejects an invalid videoFilters entry with INVALID_VIDEO_FILTERS', () => {
    try {
      buildRemuxPlan(tempMedia('mkv'), { videoFilters: ['fps=30;rm -rf /'] }, PROBED);
      expect.unreachable('expected INVALID_VIDEO_FILTERS');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('INVALID_VIDEO_FILTERS');
    }
  });

  it('stays a lossless copy for an empty videoFilters list', () => {
    const plan = buildRemuxPlan(tempMedia('mkv'), { videoFilters: [] }, PROBED);
    expect(plan.options.copy).toBe(true);
    expect(plan.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(false);
  });
});

describe('buildDemuxPlan', () => {
  it('builds one copy target per probed stream next to the input', () => {
    const input = tempMedia('mkv');
    const plan = buildDemuxPlan(input, {}, PROBED);
    expect(plan.targets).toHaveLength(3);
    expect(plan.targets.map((t) => t.output)).toEqual([
      path.join(path.dirname(input), 'clip.video.mp4'),
      path.join(path.dirname(input), 'clip.audio_0.m4a'),
      path.join(path.dirname(input), 'clip.subtitle_0.srt'),
    ]);
    for (const target of plan.targets) {
      expect(target.copy).toBe(true);
    }
  });

  it('filters by kind and resolves outputs into outputDir', () => {
    const input = tempMedia('mkv');
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-demux-'));
    const plan = buildDemuxPlan(input, { audio: true, outputDir: outDir }, PROBED);
    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].kind).toBe('audio');
    expect(plan.targets[0].output).toBe(path.join(outDir, 'clip.audio_0.m4a'));
  });

  it('re-encodes audio and subtitles through the media preferences', () => {
    const input = tempMedia('mkv');
    const plan = buildDemuxPlan(input, { audio: true, audioCodec: 'mp3' }, PROBED);
    const [audio] = plan.targets;
    expect(audio.copy).toBe(false);
    expect(audio.codec).toBe('mp3');
    expect(audio.output.endsWith('.mp3')).toBe(true);

    const subs = buildDemuxPlan(input, { subtitles: true, subtitleCodec: 'ass' }, PROBED);
    expect(subs.targets[0]).toMatchObject({ copy: false, codec: 'ass' });
    expect(subs.targets[0].output.endsWith('.ass')).toBe(true);
  });

  it('re-encodes video into a different container', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm' }, PROBED);
    expect(plan.targets[0]).toMatchObject({ copy: false, codec: 'libvpx-vp9', container: 'webm' });
    expect(plan.targets[0].output.endsWith('.webm')).toBe(true);
  });

  it('treats "copy" preferences as stream copy', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { audio: true, audioCodec: 'copy', subtitleCodec: 'copy' }, PROBED);
    expect(plan.targets[0].copy).toBe(true);
  });

  it('rejects a kind the source does not contain with STREAM_NOT_FOUND', () => {
    const videoOnly = [stream({ index: 0, type: 'video', codec: 'h264' })];
    try {
      buildDemuxPlan(tempMedia('mkv'), { audio: true }, videoOnly);
      expect.unreachable('expected STREAM_NOT_FOUND');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('STREAM_NOT_FOUND');
    }
  });

  it('skips cover-art video streams', () => {
    const withCover = [...PROBED, stream({ index: 3, type: 'video', codec: 'mjpeg', disposition: ['attached_pic'] })];
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true }, withCover);
    expect(plan.targets).toHaveLength(1);
  });

  it('carries videoFilters onto a re-encoding video target', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm', videoFilters: ['fps=30'] }, PROBED);
    expect(plan.targets[0]).toMatchObject({ copy: false, videoFilters: ['fps=30'] });
  });

  it('warns that videoFilters are ignored while the video target is Copy', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoFilters: ['fps=30'] }, PROBED);
    expect(plan.warnings.some((w) => w.code === 'filtersIgnoredCopy')).toBe(true);
  });

  it('does not warn about ignored filters for a re-encoding video target', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm', videoFilters: ['fps=30'] }, PROBED);
    expect(plan.warnings.some((w) => w.code === 'filtersIgnoredCopy')).toBe(false);
  });

  it('expands the preset.value shorthand in a videoFilters list', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm', videoFilters: ['framerate.60'] }, PROBED);
    expect(plan.targets[0].videoFilters).toEqual(['fps=60']);
  });

  it('rejects an invalid videoFilters entry with INVALID_VIDEO_FILTERS', () => {
    try {
      buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm', videoFilters: ['fps=30|pipe'] }, PROBED);
      expect.unreachable('expected INVALID_VIDEO_FILTERS');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('INVALID_VIDEO_FILTERS');
    }
  });

  it('never attaches videoFilters to audio or subtitle targets', () => {
    const plan = buildDemuxPlan(tempMedia('mkv'), { video: true, videoContainer: 'webm', videoFilters: ['fps=30'] }, PROBED);
    const audio = plan.targets.find((t) => t.kind === 'audio');
    const subtitle = plan.targets.find((t) => t.kind === 'subtitle');
    expect(audio?.videoFilters ?? []).toEqual([]);
    expect(subtitle?.videoFilters ?? []).toEqual([]);
  });
});

describe('buildDemuxJobOptions', () => {
  it('maps a single stream and guards the other kinds', () => {
    const input = tempMedia('mkv');
    const [video, audio, subtitle] = buildDemuxPlan(input, { subtitleCodec: 'srt' }, PROBED).targets;
    expect(buildDemuxJobOptions(video)).toMatchObject({ copy: true, map: ['0:v:0'], video: true, audio: false });
    expect(buildDemuxJobOptions(audio)).toMatchObject({ copy: true, map: ['0:a:0'], video: false, audio: true });
    expect(buildDemuxJobOptions(subtitle)).toMatchObject({
      copy: false,
      map: ['0:s:0'],
      video: false,
      audio: false,
      extraArgs: ['-c:s', 'srt'],
    });
  });

  it('puts the filter chain on the video job options of a re-encoded target', () => {
    const input = tempMedia('mkv');
    const [video, audio] = buildDemuxPlan(input, { videoContainer: 'webm', videoFilters: ['fps=30'] }, PROBED).targets;
    expect(buildDemuxJobOptions(video).videoFilters).toEqual(['fps=30']);
    expect(buildDemuxJobOptions(audio).videoFilters).toBeUndefined();
  });
});
