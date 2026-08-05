import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import type { ITranscoder } from '../types';

describe('ITranscoder interface contract', () => {
  it('requires getInfo, convert, cancel, getType methods', () => {
    const mock: ITranscoder = {
      getInfo: async () => ({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: () => new EventEmitter(),
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      getType: () => 'FFMPEG',
    };
    expect(mock.getType()).toBe('FFMPEG');
    expect(mock.convert('a', 'b', {})).toBeInstanceOf(EventEmitter);
  });
});
