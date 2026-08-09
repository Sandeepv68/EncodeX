import { describe, it, expect, beforeEach } from 'vitest';
import { readStoredBatchConfig, persistBatchConfig, DEFAULT_BATCH_CONFIG, type BatchConfig } from '../batchConfig';
import { BATCH_CONFIG_STORAGE_KEY } from '../../../shared/constants';

describe('batchConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(readStoredBatchConfig()).toEqual(DEFAULT_BATCH_CONFIG);
  });

  it('round-trips a stored config', () => {
    const config: BatchConfig = {
      operation: 'compress_image',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      container: 'webp',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      quality: '15',
      scale: '1280x720',
      pixelFormat: 'yuv420p',
    };
    persistBatchConfig(config);
    expect(readStoredBatchConfig()).toEqual(config);
  });

  it('falls back to defaults for invalid entries', () => {
    localStorage.setItem(BATCH_CONFIG_STORAGE_KEY, JSON.stringify({ operation: 'bogus', videoCodec: 'nope', container: 'x' }));
    const result = readStoredBatchConfig();
    expect(result.operation).toBe(DEFAULT_BATCH_CONFIG.operation);
    expect(result.videoCodec).toBe(DEFAULT_BATCH_CONFIG.videoCodec);
    expect(result.container).toBe('x');
  });

  it('returns defaults when the stored value is malformed', () => {
    localStorage.setItem(BATCH_CONFIG_STORAGE_KEY, 'not json');
    expect(readStoredBatchConfig()).toEqual(DEFAULT_BATCH_CONFIG);
  });
});
