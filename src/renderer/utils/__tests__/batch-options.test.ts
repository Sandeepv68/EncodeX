import { describe, it, expect } from 'vitest';
import {
  buildBatchOptions,
  buildOutputPath,
  inferJobOperation,
  recomputeJobOutput,
  recomputeJobOutputDir,
  type BatchEncodingValues,
} from '../batch-options';
import type { QueueJob } from '../../../shared/types';

const VALUES: BatchEncodingValues = {
  videoCodec: 'libx264',
  audioCodec: 'aac',
  container: '',
  videoBitrate: '2000k',
  audioBitrate: '192k',
  quality: '20',
  scale: '1280x720',
  rotate: '90',
  flipH: true,
  flipV: false,
  pixelFormat: 'yuv420p',
};

const HW = { hardwareAcceleration: true, hwaccelMode: 'auto' as const };

function makeJob(partial: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'job-1',
    input: '/in/video.mp4',
    output: '/in/video_encodex_converted.mp4',
    options: {},
    transcoder: 'FFMPEG',
    status: 'queued',
    progress: 0,
    createdAt: 1,
    ...partial,
  };
}

describe('inferJobOperation', () => {
  it('infers transcode from a video codec', () => {
    expect(inferJobOperation({ videoCodec: 'libx264' })).toBe('transcode');
  });

  it('infers extract_audio from an audio codec without a video codec', () => {
    expect(inferJobOperation({ audioCodec: 'aac' })).toBe('extract_audio');
  });

  it('infers compress_image from a qscale', () => {
    expect(inferJobOperation({ qscale: 20 })).toBe('compress_image');
  });

  it('infers transcode when options carry both a video and an audio codec', () => {
    expect(inferJobOperation({ videoCodec: 'libx264', audioCodec: 'aac' })).toBe('transcode');
  });

  it('falls back to the first batch operation for options without markers', () => {
    expect(inferJobOperation({})).toBe('transcode');
  });
});

describe('buildBatchOptions', () => {
  it('builds transcode options with video+audio codecs, bitrates, scale, and pixel format', () => {
    expect(buildBatchOptions('transcode', VALUES, HW)).toEqual({
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      qscale: undefined,
      scale: '1280x720',
      rotate: '90',
      flipH: true,
      flipV: undefined,
      pixelFormat: 'yuv420p',
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
    });
  });

  it('builds extract_audio options with audio only', () => {
    expect(buildBatchOptions('extract_audio', VALUES, HW)).toEqual({
      videoCodec: undefined,
      audioCodec: 'aac',
      videoBitrate: undefined,
      audioBitrate: '192k',
      qscale: undefined,
      scale: undefined,
      rotate: undefined,
      flipH: undefined,
      flipV: undefined,
      pixelFormat: undefined,
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
    });
  });

  it('builds compress_image options with qscale, scale, and rotation', () => {
    expect(buildBatchOptions('compress_image', VALUES, HW)).toEqual({
      videoCodec: undefined,
      audioCodec: undefined,
      videoBitrate: undefined,
      audioBitrate: undefined,
      qscale: 20,
      scale: '1280x720',
      rotate: '90',
      flipH: true,
      flipV: undefined,
      pixelFormat: undefined,
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
    });
  });

  it('drops empty bitrates, quality, scale, and rotation', () => {
    const values: BatchEncodingValues = { ...VALUES, videoBitrate: '', audioBitrate: '', quality: '', scale: '', rotate: '' };
    expect(buildBatchOptions('transcode', values, HW).videoBitrate).toBeUndefined();
    expect(buildBatchOptions('transcode', values, HW).audioBitrate).toBeUndefined();
    expect(buildBatchOptions('compress_image', values, HW).qscale).toBeUndefined();
    expect(buildBatchOptions('compress_image', values, HW).scale).toBeUndefined();
    expect(buildBatchOptions('transcode', values, HW).rotate).toBeUndefined();
  });

  it('reflects disabled hardware acceleration', () => {
    const options = buildBatchOptions('transcode', VALUES, { hardwareAcceleration: false, hwaccelMode: 'none' });
    expect(options.hardwareAcceleration).toBe(false);
    expect(options.hwaccelMode).toBe('none');
  });
});

describe('recomputeJobOutput', () => {
  it('keeps the current output when the container is empty', () => {
    expect(recomputeJobOutput(makeJob(), '')).toBe('/in/video_encodex_converted.mp4');
  });

  it('swaps the extension when the container is compatible with the job video codec', () => {
    const job = makeJob({ options: { videoCodec: 'libx264' } });
    expect(recomputeJobOutput(job, 'mkv')).toBe('/in/video_encodex_converted.mkv');
  });

  it('keeps the output when the container is incompatible with the job video codec', () => {
    const job = makeJob({ options: { videoCodec: 'libx264' } });
    expect(recomputeJobOutput(job, 'webm')).toBe('/in/video_encodex_converted.mp4');
  });

  it('swaps the extension when the container is compatible with the job audio codec', () => {
    const job = makeJob({ output: '/in/audio_encodex_converted.mp4', options: { audioCodec: 'aac' } });
    expect(recomputeJobOutput(job, 'm4a')).toBe('/in/audio_encodex_converted.m4a');
  });

  it('keeps the output when the container is incompatible with the job audio codec', () => {
    const job = makeJob({ output: '/in/audio_encodex_converted.mp4', options: { audioCodec: 'libmp3lame' } });
    expect(recomputeJobOutput(job, 'm4a')).toBe('/in/audio_encodex_converted.mp4');
  });

  it('swaps the extension for compress_image jobs using image formats', () => {
    const job = makeJob({ output: '/in/photo_encodex_converted.png', options: { qscale: 20 } });
    expect(recomputeJobOutput(job, 'webp')).toBe('/in/photo_encodex_converted.webp');
  });

  it('keeps the output for compress_image jobs when the format is not an image format', () => {
    const job = makeJob({ output: '/in/photo_encodex_converted.png', options: { qscale: 20 } });
    expect(recomputeJobOutput(job, 'mp4')).toBe('/in/photo_encodex_converted.png');
  });

  it('keeps the output when the job operation cannot be inferred', () => {
    const job = makeJob({ options: {} });
    expect(recomputeJobOutput(job, 'mkv')).toBe('/in/video_encodex_converted.mp4');
  });

  it('handles Windows-style output paths and leading-dot containers', () => {
    const job = makeJob({ output: 'C:\\in\\video_encodex_converted.mp4', options: { videoCodec: 'libx264' } });
    expect(recomputeJobOutput(job, '.mkv')).toBe('C:\\in\\video_encodex_converted.mkv');
  });
});

describe('recomputeJobOutputDir', () => {
  it('moves the output into the given directory', () => {
    const job = makeJob({ output: '/in/video_encodex_converted.mp4' });
    expect(recomputeJobOutputDir(job, '/out')).toBe('/out/video_encodex_converted.mp4');
  });

  it('moves the output back to source-adjacent when outputDir is empty', () => {
    const job = makeJob({ output: '/out/video_encodex_converted.mp4' });
    expect(recomputeJobOutputDir(job, '')).toBe('/in/video_encodex_converted.mp4');
  });

  it('returns the same path when the directory already matches', () => {
    const job = makeJob({ output: '/in/video_encodex_converted.mp4' });
    expect(recomputeJobOutputDir(job, '')).toBe('/in/video_encodex_converted.mp4');
  });

  it('normalises Windows backslash separators in outputDir', () => {
    const job = makeJob({ input: 'C:\\in\\video.mp4', output: 'C:\\out\\video_encodex_converted.mp4' });
    expect(recomputeJobOutputDir(job, 'C:\\new-out')).toBe('C:/new-out/video_encodex_converted.mp4');
  });

  it('strips trailing slashes from outputDir', () => {
    const job = makeJob({ output: '/in/video_encodex_converted.mp4' });
    expect(recomputeJobOutputDir(job, '/out/')).toBe('/out/video_encodex_converted.mp4');
  });
});

describe('buildOutputPath', () => {
  const base = { container: 'mp4', audioCodec: 'aac', videoCodec: 'libx264', outputDir: '', suffix: '_encodex_converted' };

  it('builds a source-adjacent output with the configured suffix', () => {
    expect(buildOutputPath({ ...base, file: '/in/video.mp4', operation: 'transcode', sourceExt: 'mp4' })).toBe(
      '/in/video_encodex_converted.mp4',
    );
  });

  it('places the output in the configured output directory', () => {
    expect(buildOutputPath({ ...base, file: '/in/video.mp4', operation: 'transcode', sourceExt: 'mp4', outputDir: '/out' })).toBe(
      '/out/video_encodex_converted.mp4',
    );
  });

  it('strips trailing slashes and normalises backslashes in outputDir', () => {
    expect(buildOutputPath({ ...base, file: '/in/video.mp4', operation: 'transcode', sourceExt: 'mp4', outputDir: 'C:\\Out\\' })).toBe(
      'C:/Out/video_encodex_converted.mp4',
    );
  });

  it('derives the extension from the audio-codec container for extract_audio', () => {
    expect(buildOutputPath({ ...base, container: '', file: '/in/movie.mp4', operation: 'extract_audio', sourceExt: 'mp4' })).toBe(
      '/in/movie_encodex_converted.m4a',
    );
  });

  it('keeps the source extension when no container and no audio-codec mapping exist', () => {
    expect(
      buildOutputPath({
        ...base,
        container: '',
        audioCodec: 'mystery_codec',
        file: '/in/movie.mp4',
        operation: 'extract_audio',
        sourceExt: 'mp4',
      }),
    ).toBe('/in/movie_encodex_converted.mp4');
  });

  it('uses the video-codec container when transcode has no container and no source extension', () => {
    expect(buildOutputPath({ ...base, container: '', file: '/in/stream', operation: 'transcode', sourceExt: '' })).toBe(
      '/in/stream_encodex_converted.mp4',
    );
  });

  it('falls back to mp4 when no extension can be derived', () => {
    expect(buildOutputPath({ ...base, container: '', file: '/in/photo.png', operation: 'compress_image', sourceExt: '' })).toBe(
      '/in/photo_encodex_converted.mp4',
    );
  });

  it('inserts the current suffix value', () => {
    expect(buildOutputPath({ ...base, file: '/in/video.mp4', operation: 'transcode', sourceExt: 'mp4', suffix: '_v2' })).toBe(
      '/in/video_v2.mp4',
    );
  });
});
