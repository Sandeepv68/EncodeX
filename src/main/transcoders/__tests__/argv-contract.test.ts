import { describe, it, expect, vi } from 'vitest';
import type { ConversionOptions } from '../../../shared/types';
import { buildFfmpegArgs, buildVideoFilterChain } from '../ffmpeg-utils';

// Same binary-path mocks as ffmpeg-utils.test.ts: `buildFfmpegArgs` resolves
// the ffmpeg executable through `getFfmpegPath`. The argv itself never embeds
// that path, but the module still needs the import to resolve.
const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));

vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock,
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:/static/ffmpeg.exe' }));

/**
 * @fileoverview Phase 9 contract snapshots: the exact ffmpeg argv each CLI
 * transcoder produces is a behaviour contract. If `-map` order, a sync offset,
 * a disposition, or a filter token ever changes, the snapshot fails and the
 * change must be reviewed as a deliberate behaviour change rather than
 * slipping through a value assertion.
 *
 * `buildFfmpegArgs` is the single CLI argv builder shared by the FFToolCore
 * and BmfCore backends (see ffmpeg-utils.ts), and `buildVideoFilterChain` is
 * the filter-chain half of the same contract.
 */

describe('phase 9 ffmpeg argv contract', () => {
  it('matches the copy/remux argv', () => {
    expect(buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true })).toMatchSnapshot();
  });

  it('matches the full re-encode argv', () => {
    const options: ConversionOptions = {
      videoCodec: 'libx265',
      audioCodec: 'aac',
      videoBitrate: '1000k',
      audioBitrate: '192k',
      qscale: 23,
      scale: '1280x720',
      keepAspectRatio: true,
      pixelFormat: 'yuv420p',
      startTime: '10',
      endTime: '20',
      duration: '30',
      rotate: '90',
      flipH: true,
      videoFilters: ['eq=contrast=1.1'],
    };
    expect(buildFfmpegArgs('in.mp4', 'out.mkv', options)).toMatchSnapshot();
  });

  it('matches the hardware-accelerated argv', () => {
    const options: ConversionOptions = {
      videoCodec: 'h264_nvenc',
      audioCodec: 'aac',
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
      extraArgs: ['-preset', 'p5'],
    };
    expect(buildFfmpegArgs('in.mkv', 'out.mp4', options)).toMatchSnapshot();
  });

  it('matches the added-track sync argv', () => {
    const options: ConversionOptions = {
      copy: true,
      audioSyncSeconds: 1.5,
      additionalInputs: [
        { path: 'subs.srt', map: ['1:0'], codec: 'mov_text' },
        { path: 'cover.jpg', map: ['2:0'], disposition: 'attached_pic' },
      ],
      copyChapters: true,
    };
    expect(buildFfmpegArgs('in.mp4', 'out.mp4', options)).toMatchSnapshot();
  });

  it('matches the audio-disabled + map + input-args argv', () => {
    const options: ConversionOptions = {
      copy: true,
      audio: false,
      map: ['0:0'],
      inputArgs: ['-ss', '5'],
      subtitleCodec: 'mov_text',
    };
    expect(buildFfmpegArgs('in.mp4', 'out.mp4', options)).toMatchSnapshot();
  });

  it('matches the filter-chain contract', () => {
    expect(
      buildVideoFilterChain({
        scale: '1920x1080',
        rotate: '270',
        flipV: true,
        videoFilters: ['hue=s=0'],
      }),
    ).toMatchSnapshot();
    expect(buildVideoFilterChain({})).toMatchSnapshot();
  });
});
