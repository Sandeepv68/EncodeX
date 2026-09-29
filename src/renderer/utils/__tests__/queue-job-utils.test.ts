import { describe, it, expect } from 'vitest';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MediaStreamInfo, QueueJob } from '../../../shared/types';
import { isJobActive, statusChipColor, planEnqueues, type PlanEnqueuesContext } from '../queue-job-utils';

function makeJob(status: string): QueueJob {
  return { id: '1', input: '/a/b.mp4', output: '/a/out.mp4', operation: 'convert', status, createdAt: 0 } as QueueJob;
}

describe('isJobActive', () => {
  it('returns true for queued or running jobs', () => {
    expect(isJobActive(makeJob(QUEUE_STATUS.QUEUED))).toBe(true);
    expect(isJobActive(makeJob(QUEUE_STATUS.RUNNING))).toBe(true);
  });

  it('returns false for done, error, and unknown statuses', () => {
    expect(isJobActive(makeJob(QUEUE_STATUS.DONE))).toBe(false);
    expect(isJobActive(makeJob(QUEUE_STATUS.ERROR))).toBe(false);
  });
});

describe('statusChipColor', () => {
  it('maps each queue status to its chip color', () => {
    expect(statusChipColor(QUEUE_STATUS.QUEUED)).toBe('warning');
    expect(statusChipColor(QUEUE_STATUS.RUNNING)).toBe('primary');
    expect(statusChipColor(QUEUE_STATUS.DONE)).toBe('success');
    expect(statusChipColor(QUEUE_STATUS.ERROR)).toBe('error');
  });

  it('falls back to default for unknown statuses', () => {
    expect(statusChipColor('bogus')).toBe('default');
  });
});

const ENC = {
  videoCodec: 'libx264',
  audioCodec: 'aac',
  container: 'mp4',
  videoBitrate: '2000k',
  audioBitrate: '192k',
  quality: '20',
  scale: '1280x720',
  rotate: '90',
  flipH: true,
  flipV: false,
  pixelFormat: 'yuv420p',
  videoFilters: [],
};

function context(partial: Partial<PlanEnqueuesContext> = {}): PlanEnqueuesContext {
  return {
    selections: [],
    currentJobs: [],
    outputDir: '',
    enc: ENC,
    hw: { hardwareAcceleration: true, hwaccelMode: 'auto' },
    suffix: '_encodex_converted',
    transcoder: 'FFMPEG',
    overwrite: false,
    ...partial,
  };
}

function queuedJob(partial: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'j1',
    input: '/in/old.mp4',
    output: '/in/old_encodex_converted.mp4',
    operation: 'convert',
    status: QUEUE_STATUS.QUEUED,
    createdAt: 0,
    ...partial,
  };
}

describe('planEnqueues', () => {
  it('builds a valid draft with derived output and encoded options', async () => {
    const plan = await planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }] }));
    expect(plan.skippedNames).toEqual([]);
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0]).toMatchObject({
      file: '/in/movie.mp4',
      output: '/in/movie_encodex_converted.mp4',
      transcoder: 'FFMPEG',
      overwrite: false,
    });
    expect(plan.enqueues[0].options.videoCodec).toBe('libx264');
    expect(plan.enqueues[0].options.hwaccelMode).toBe('auto');
  });

  it('carries the configured video filters into transcode job options', async () => {
    const plan = await planEnqueues(
      context({
        selections: [{ file: '/in/movie.mp4', operation: 'transcode' }],
        enc: { ...ENC, videoFilters: ['hflip', 'eq=brightness=0.1'] },
      }),
    );
    expect(plan.enqueues[0].options.videoFilters).toEqual(['hflip', 'eq=brightness=0.1']);
  });

  it('skips unsupported extensions', async () => {
    const plan = await planEnqueues(context({ selections: [{ file: '/in/notes.txt', operation: 'transcode' }] }));
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['notes.txt']);
  });

  it('skips files whose extension does not fit their operation', async () => {
    const wrongImage = await planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'compress_image' }] }));
    expect(wrongImage.skippedNames).toEqual(['movie.mp4']);

    const wrongVideo = await planEnqueues(context({ selections: [{ file: '/in/photo.png', operation: 'transcode' }] }));
    expect(wrongVideo.skippedNames).toEqual(['photo.png']);
  });

  it('accepts images for compress_image and uses the image output extension', async () => {
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/photo.png', operation: 'compress_image' }], enc: { ...ENC, container: '' } }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0].output).toBe('/in/photo_encodex_converted.png');
    expect(plan.enqueues[0].options.qscale).toBe(20);
  });

  it('skips files whose input+output pair is already queued', async () => {
    const currentJobs = [queuedJob({ input: '/in/movie.mp4', output: '/in/movie_encodex_converted.mp4' })];
    const plan = await planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], currentJobs }));
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['movie.mp4']);
  });

  it('skips files whose output path is already claimed', async () => {
    const currentJobs = [queuedJob({ input: '/other/source.mp4', output: '/in/movie_encodex_converted.mp4' })];
    const plan = await planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], currentJobs }));
    expect(plan.enqueues).toHaveLength(0);
  });

  it('de-duplicates repeated selections within the same batch', async () => {
    const plan = await planEnqueues(
      context({
        selections: [
          { file: '/in/movie.mp4', operation: 'transcode' },
          { file: '/in/movie.mp4', operation: 'transcode' },
        ],
      }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.skippedNames).toEqual(['movie.mp4']);
  });

  it('uses the configured output directory and suffix', async () => {
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], outputDir: '/out', suffix: '_v2' }),
    );
    expect(plan.enqueues[0].output).toBe('/out/movie_v2.mp4');
  });

  it('uses the codec-suggested extension when no container is set', async () => {
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mp4', operation: 'extract_audio' }], enc: { ...ENC, container: '' } }),
    );
    expect(plan.enqueues[0].output).toBe('/in/movie_encodex_converted.m4a');
  });

  it('builds a remux draft with a stream copy into the container and no encoders', async () => {
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mkv', operation: 'remux' }], enc: { ...ENC, container: 'mp4' } }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0].output).toBe('/in/movie_encodex_converted.mp4');
    expect(plan.enqueues[0].options).toEqual({
      copy: true,
      video: undefined,
      audio: undefined,
      map: undefined,
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
    });
  });

  it('skips remux images', async () => {
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/photo.png', operation: 'remux' }], enc: { ...ENC, container: 'mkv' } }),
    );
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['photo.png']);
  });

  it('skips demux files when no prober is provided', async () => {
    const plan = await planEnqueues(context({ selections: [{ file: '/in/movie.mkv', operation: 'demux' }] }));
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['movie.mkv']);
  });

  it('skips demux files whose probe rejects', async () => {
    const plan = await planEnqueues(
      context({
        selections: [{ file: '/in/movie.mkv', operation: 'demux' }],
        probe: async () => {
          throw new Error('probe boom');
        },
      }),
    );
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['movie.mkv']);
  });

  it('builds one demux draft per selected stream with its own map and output', async () => {
    const probe = async (): Promise<MediaStreamInfo[]> => [videoStream(0), audioStream(1), audioStream(2), subripStream(3)];
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mkv', operation: 'demux' }], probe, enc: { ...ENC, container: '' } }),
    );
    expect(plan.skippedNames).toEqual([]);
    expect(plan.enqueues).toHaveLength(4);
    expect(plan.enqueues[0]).toMatchObject({
      output: '/in/movie.video_encodex_converted.mp4',
      options: { copy: true, video: true, audio: false, map: ['0:v:0'] },
    });
    expect(plan.enqueues[1]).toMatchObject({
      output: '/in/movie.audio_0_encodex_converted.m4a',
      options: { copy: true, video: false, audio: true, map: ['0:a:0'] },
    });
    expect(plan.enqueues[2]).toMatchObject({
      output: '/in/movie.audio_1_encodex_converted.m4a',
      options: { copy: true, video: false, audio: true, map: ['0:a:1'] },
    });
    expect(plan.enqueues[3]).toMatchObject({
      output: '/in/movie.subtitle_0_encodex_converted.srt',
      options: { copy: true, video: false, audio: false, map: ['0:s:0'] },
    });
  });

  it('re-encodes demux audio to the configured codec', async () => {
    const probe = async (): Promise<MediaStreamInfo[]> => [audioStream(0)];
    const plan = await planEnqueues(
      context({
        selections: [{ file: '/in/movie.mkv', operation: 'demux' }],
        probe,
        enc: { ...ENC, container: '', demuxAudioCodec: 'mp3' },
      }),
    );
    expect(plan.enqueues[0].output).toBe('/in/movie.audio_0_encodex_converted.mp3');
    expect(plan.enqueues[0].options).toMatchObject({ copy: false, video: false, audio: true, audioCodec: 'mp3', map: ['0:a:0'] });
  });

  it('respects the configured demux kind filter', async () => {
    const probe = async (): Promise<MediaStreamInfo[]> => [videoStream(0), audioStream(1), subripStream(2)];
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mkv', operation: 'demux' }], probe, enc: { ...ENC, demuxKinds: ['subtitle'] } }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0].options.map).toEqual(['0:s:0']);
  });

  it('skips demux files whose streams expose none of the selected kinds', async () => {
    const probe = async (): Promise<MediaStreamInfo[]> => [audioStream(0)];
    const plan = await planEnqueues(
      context({ selections: [{ file: '/in/movie.mkv', operation: 'demux' }], probe, enc: { ...ENC, demuxKinds: ['video'] } }),
    );
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['movie.mkv']);
  });

  it('excludes attached-picture streams from demux and reports re-selected files once', async () => {
    const probe = async (): Promise<MediaStreamInfo[]> => [audioStream(0), { ...audioStream(1), disposition: ['attached_pic'] }];
    const plan = await planEnqueues(
      context({
        selections: [
          { file: '/in/movie.mkv', operation: 'demux' },
          { file: '/in/movie.mkv', operation: 'demux' },
        ],
        probe,
      }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0].output).toBe('/in/movie.audio_0_encodex_converted.m4a');
    expect(plan.skippedNames).toEqual(['movie.mkv']);
  });
});

function videoStream(index: number): MediaStreamInfo {
  return { index, type: 'video', codec: 'h264', width: 1920, height: 1080 };
}

function audioStream(index: number): MediaStreamInfo {
  return { index, type: 'audio', codec: 'aac', sampleRate: 48000, channels: 2 };
}

function subripStream(index: number): MediaStreamInfo {
  return { index, type: 'subtitle', codec: 'subrip' };
}
