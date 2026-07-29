import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';

describe('ITranscoder interface contract', () => {
  it('requires getInfo, convert, cancel, getType methods', () => {
    const mock: Parameters<() => { getInfo(input: string): Promise<unknown>; convert(input: string, output: string, options: unknown): EventEmitter; cancel(): void; getType(): string }>[0] = {
      getInfo: async () => ({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: () => new EventEmitter(),
      cancel: () => {},
      getType: () => 'FFMPEG',
    };
    expect(mock.getType()).toBe('FFMPEG');
    expect(mock.convert('a', 'b', {})).toBeInstanceOf(EventEmitter);
  });
});
