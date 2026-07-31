import { describe, it, expect, vi } from 'vitest';

vi.mock('../ffmpeg-core', () => ({
  FfmpegCore: class {
    getType = vi.fn().mockReturnValue('FFMPEG');
  },
}));

vi.mock('../fftool-core', () => ({
  FFToolCore: class {
    getType = vi.fn().mockReturnValue('FFTOOL');
  },
}));

vi.mock('../bmf-core', () => ({
  BmfCore: class {
    getType = vi.fn().mockReturnValue('BMF');
  },
}));

const { createTranscoder } = await import('../factory');

describe('createTranscoder', () => {
  it('creates an FFMPEG transcoder', () => {
    expect(createTranscoder('FFMPEG').getType()).toBe('FFMPEG');
  });

  it('creates an FFTOOL transcoder', () => {
    expect(createTranscoder('FFTOOL').getType()).toBe('FFTOOL');
  });

  it('creates a BMF transcoder', () => {
    expect(createTranscoder('BMF').getType()).toBe('BMF');
  });
});
