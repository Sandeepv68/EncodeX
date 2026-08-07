import { describe, it, expect } from 'vitest';
import { estimateRemaining, formatEstimate } from '../estimate';
import { QUEUE_STATUS } from '../media-options';
import type { ConversionProgress, QueueJob } from '../types';

function job(overrides: Partial<QueueJob>): QueueJob {
  return {
    id: 'job-1',
    input: '/in/video.mp4',
    output: '/out/video_converted.mp4',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    options: {},
    transcoder: 'FFMPEG',
    createdAt: 0,
    ...overrides,
  };
}

function progress(eta: string): ConversionProgress {
  return { percent: 50, time: '00:00:05', fps: 30, speed: '2x', eta, bitrate: '1500k' };
}

describe('estimateRemaining', () => {
  it('returns null when nothing is running', () => {
    expect(estimateRemaining([job({})], {})).toBeNull();
    expect(estimateRemaining([], {})).toBeNull();
  });

  it('returns null when running jobs have no usable eta', () => {
    const jobs = [job({ id: 'job-1', status: QUEUE_STATUS.RUNNING })];
    expect(estimateRemaining(jobs, {})).toBeNull();
    expect(estimateRemaining(jobs, { 'job-1': progress('0') })).toBeNull();
    expect(estimateRemaining(jobs, { 'job-1': progress('abc') })).toBeNull();
  });

  it('extrapolates the running eta across queued jobs', () => {
    const jobs = [
      job({ id: 'job-1', status: QUEUE_STATUS.RUNNING }),
      job({ id: 'job-2', status: QUEUE_STATUS.QUEUED }),
      job({ id: 'job-3', status: QUEUE_STATUS.QUEUED }),
    ];
    expect(estimateRemaining(jobs, { 'job-1': progress('45') })).toBe(135);
  });

  it('averages etas across multiple running jobs', () => {
    const jobs = [
      job({ id: 'job-1', status: QUEUE_STATUS.RUNNING }),
      job({ id: 'job-2', status: QUEUE_STATUS.RUNNING }),
      job({ id: 'job-3', status: QUEUE_STATUS.QUEUED }),
    ];
    expect(estimateRemaining(jobs, { 'job-1': progress('30'), 'job-2': progress('90') })).toBe(180);
  });

  it('ignores zero or non-numeric etas while keeping valid ones', () => {
    const jobs = [job({ id: 'job-1', status: QUEUE_STATUS.RUNNING }), job({ id: 'job-2', status: QUEUE_STATUS.RUNNING })];
    expect(estimateRemaining(jobs, { 'job-1': progress('0'), 'job-2': progress('10') })).toBe(20);
  });

  it('does not count done or failed jobs toward the estimate', () => {
    const jobs = [
      job({ id: 'job-1', status: QUEUE_STATUS.RUNNING }),
      job({ id: 'job-2', status: QUEUE_STATUS.DONE }),
      job({ id: 'job-3', status: QUEUE_STATUS.ERROR }),
    ];
    expect(estimateRemaining(jobs, { 'job-1': progress('10') })).toBe(10);
  });
});

describe('formatEstimate', () => {
  it('formats sub-minute values in seconds', () => {
    expect(formatEstimate(0)).toBe('0s');
    expect(formatEstimate(45)).toBe('45s');
    expect(formatEstimate(59.6)).toBe('1m');
  });

  it('formats minute-level values with remaining seconds', () => {
    expect(formatEstimate(90)).toBe('1m 30s');
    expect(formatEstimate(120)).toBe('2m');
  });

  it('formats hour-level values with remaining minutes', () => {
    expect(formatEstimate(3725)).toBe('1h 2m');
    expect(formatEstimate(3600)).toBe('1h');
  });

  it('never returns negative values', () => {
    expect(formatEstimate(-10)).toBe('0s');
  });
});
