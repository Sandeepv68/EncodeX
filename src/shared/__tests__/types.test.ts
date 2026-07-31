import { describe, it, expect } from 'vitest';
import { QUEUE_STATUS } from '../media-options';
import {
  ConversionOptions,
  MediaStreamInfo,
  MediaInfo,
  QueueJob,
  ConversionProgress,
  PlayerFrame,
  ConversionOperation,
  FileItem,
} from '../types';
import { TranscoderType, TRANSCODER_TYPES } from '../transcoder-constants';

describe('TranscoderType', () => {
  it('is a union of TRANSCODER_TYPES values', () => {
    const t: TranscoderType = 'FFMPEG';
    expect(TRANSCODER_TYPES.includes(t)).toBe(true);
  });
});

describe('ConversionOptions', () => {
  it('allows partial options', () => {
    const opts: ConversionOptions = { videoCodec: 'libx264' };
    expect(opts.videoCodec).toBe('libx264');
    expect(opts.audioCodec).toBeUndefined();
  });
});

describe('MediaStreamInfo', () => {
  it('requires index, type, and codec', () => {
    const stream: MediaStreamInfo = { index: 0, type: 'video', codec: 'h264' };
    expect(stream.index).toBe(0);
    expect(stream.type).toBe('video');
    expect(stream.codec).toBe('h264');
  });
});

describe('MediaInfo', () => {
  it('holds file info and streams', () => {
    const info: MediaInfo = {
      file: 'test.mp4',
      format: 'mp4',
      size: 1000,
      duration: 60,
      bitrate: '1000k',
      streams: [],
    };
    expect(info.file).toBe('test.mp4');
    expect(info.streams).toEqual([]);
  });
});

describe('QueueJob', () => {
  it('holds job data', () => {
    const job: QueueJob = {
      id: 'abc',
      input: 'in.mp4',
      output: 'out.mp4',
      options: {},
      transcoder: 'FFMPEG',
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      createdAt: Date.now(),
    };
    expect(job.id).toBe('abc');
    expect(job.status).toBe('queued');
  });

  it('allows optional error field', () => {
    const job: QueueJob = {
      id: 'abc',
      input: 'in.mp4',
      output: 'out.mp4',
      options: {},
      transcoder: 'FFMPEG',
      status: QUEUE_STATUS.ERROR,
      progress: 0,
      createdAt: Date.now(),
      error: 'something failed',
    };
    expect(job.error).toBe('something failed');
  });
});

describe('ConversionProgress', () => {
  it('holds progress data', () => {
    const p: ConversionProgress = {
      percent: 50,
      time: '00:00:30',
      fps: 30,
      speed: '1x',
      eta: '30',
      bitrate: '500k',
    };
    expect(p.percent).toBe(50);
    expect(p.fps).toBe(30);
  });
});

describe('PlayerFrame', () => {
  it('holds frame data', () => {
    const f: PlayerFrame = {
      data: new ArrayBuffer(100),
      width: 640,
      height: 360,
      pts: 1000,
    };
    expect(f.width).toBe(640);
    expect(f.height).toBe(360);
  });
});

describe('ConversionOperation', () => {
  it('has expected enum values', () => {
    expect(ConversionOperation.Transcode).toBe('transcode');
    expect(ConversionOperation.ExtractAudio).toBe('extract_audio');
    expect(ConversionOperation.CompressImage).toBe('compress_image');
    expect(ConversionOperation.CreateGif).toBe('create_gif');
    expect(ConversionOperation.CutVideo).toBe('cut_video');
  });
});

describe('FileItem', () => {
  it('holds file item data', () => {
    const item: FileItem = {
      path: '/a/b.mp4',
      name: 'b.mp4',
      size: 1024,
      operation: ConversionOperation.Transcode,
    };
    expect(item.name).toBe('b.mp4');
    expect(item.operation).toBe('transcode');
  });
});
