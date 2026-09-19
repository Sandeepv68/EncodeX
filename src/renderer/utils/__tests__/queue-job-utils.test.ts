import { describe, it, expect } from 'vitest';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { QueueJob } from '../../../shared/types';
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
  it('builds a valid draft with derived output and encoded options', () => {
    const plan = planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }] }));
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

  it('skips unsupported extensions', () => {
    const plan = planEnqueues(context({ selections: [{ file: '/in/notes.txt', operation: 'transcode' }] }));
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['notes.txt']);
  });

  it('skips files whose extension does not fit their operation', () => {
    const wrongImage = planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'compress_image' }] }));
    expect(wrongImage.skippedNames).toEqual(['movie.mp4']);

    const wrongVideo = planEnqueues(context({ selections: [{ file: '/in/photo.png', operation: 'transcode' }] }));
    expect(wrongVideo.skippedNames).toEqual(['photo.png']);
  });

  it('accepts images for compress_image and uses the image output extension', () => {
    const plan = planEnqueues(
      context({ selections: [{ file: '/in/photo.png', operation: 'compress_image' }], enc: { ...ENC, container: '' } }),
    );
    expect(plan.enqueues).toHaveLength(1);
    expect(plan.enqueues[0].output).toBe('/in/photo_encodex_converted.png');
    expect(plan.enqueues[0].options.qscale).toBe(20);
  });

  it('skips files whose input+output pair is already queued', () => {
    const currentJobs = [queuedJob({ input: '/in/movie.mp4', output: '/in/movie_encodex_converted.mp4' })];
    const plan = planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], currentJobs }));
    expect(plan.enqueues).toHaveLength(0);
    expect(plan.skippedNames).toEqual(['movie.mp4']);
  });

  it('skips files whose output path is already claimed', () => {
    const currentJobs = [queuedJob({ input: '/other/source.mp4', output: '/in/movie_encodex_converted.mp4' })];
    const plan = planEnqueues(context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], currentJobs }));
    expect(plan.enqueues).toHaveLength(0);
  });

  it('de-duplicates repeated selections within the same batch', () => {
    const plan = planEnqueues(
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

  it('uses the configured output directory and suffix', () => {
    const plan = planEnqueues(
      context({ selections: [{ file: '/in/movie.mp4', operation: 'transcode' }], outputDir: '/out', suffix: '_v2' }),
    );
    expect(plan.enqueues[0].output).toBe('/out/movie_v2.mp4');
  });

  it('uses the codec-suggested extension when no container is set', () => {
    const plan = planEnqueues(
      context({ selections: [{ file: '/in/movie.mp4', operation: 'extract_audio' }], enc: { ...ENC, container: '' } }),
    );
    expect(plan.enqueues[0].output).toBe('/in/movie_encodex_converted.m4a');
  });
});
