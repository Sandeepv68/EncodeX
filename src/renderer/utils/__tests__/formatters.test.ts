import { describe, it, expect } from 'vitest';
import { formatSize, formatDuration } from '../formatters';

describe('formatSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1024 ** 3)).toBe('1.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatSize(1024 ** 4)).toBe('1.0 TB');
    expect(formatSize(5 * 1024 ** 4)).toBe('5.0 TB');
  });
});

describe('formatDuration', () => {
  it('formats seconds with two decimals', () => {
    expect(formatDuration(0)).toBe('0.00s');
    expect(formatDuration(1.234)).toBe('1.23s');
    expect(formatDuration(90)).toBe('90.00s');
  });
});
