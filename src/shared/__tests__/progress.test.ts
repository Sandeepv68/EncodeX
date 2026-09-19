import { describe, it, expect } from 'vitest';
import type { ConversionProgress } from '../types';
import { toTaskProgress } from '../progress';

const full: ConversionProgress = { percent: 42, time: '00:00:12', fps: 180, speed: '3.5x', eta: '00:00:03', bitrate: '1500k' };

describe('toTaskProgress', () => {
  it('projects the percent/time/speed/eta subset', () => {
    expect(toTaskProgress(full)).toEqual({ percent: 42, time: '00:00:12', speed: '3.5x', eta: '00:00:03' });
  });

  it('drops fps and bitrate fields', () => {
    const result = toTaskProgress(full);
    expect('fps' in result).toBe(false);
    expect('bitrate' in result).toBe(false);
  });

  it('returns a structurally valid TaskProgress', () => {
    const result = toTaskProgress(full);
    expect(typeof result.percent).toBe('number');
    expect(typeof result.time).toBe('string');
    expect(typeof result.speed).toBe('string');
    expect(typeof result.eta).toBe('string');
  });
});
