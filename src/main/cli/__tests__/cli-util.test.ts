/**
 * @fileoverview Unit tests for the CLI helper utilities (cli-util.ts):
 * input expansion (globs/directories), output path derivation, and the small
 * formatting/parsing helpers used across the CLI subcommands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getInputExtension,
  expandInputs,
  deriveOutputPath,
  timemarkToSeconds,
  percentFromTimemark,
  formatBytes,
  formatDuration,
  parseTimeValue,
} from '../cli-util';

describe('getInputExtension', () => {
  it('returns the lower-cased extension without the dot', () => {
    expect(getInputExtension('/a/b/video.MP4')).toBe('mp4');
    expect(getInputExtension('clip.webm')).toBe('webm');
  });

  it('returns an empty string for paths without an extension', () => {
    expect(getInputExtension('/a/b/noext')).toBe('');
    expect(getInputExtension('archive.')).toBe('');
  });
});

describe('expandInputs', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-cli-util-'));
    fs.writeFileSync(path.join(dir, 'a.mp4'), 'a');
    fs.writeFileSync(path.join(dir, 'b.mp4'), 'b');
    fs.writeFileSync(path.join(dir, 'c.avi'), 'c');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'd.mp4'), 'd');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'notes');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('expands a simple glob and returns absolute sorted paths', () => {
    const result = expandInputs([path.join(dir, '*.mp4')]);
    expect(result).toEqual([path.join(dir, 'a.mp4'), path.join(dir, 'b.mp4')]);
  });

  it('expands `**` recursively', () => {
    const result = expandInputs([path.join(dir, '**', '*.mp4')]);
    expect(result).toEqual([path.join(dir, 'a.mp4'), path.join(dir, 'b.mp4'), path.join(dir, 'sub', 'd.mp4')]);
  });

  it('collects files of a directory non-recursively', () => {
    const result = expandInputs([dir]);
    expect(result).toEqual([path.join(dir, 'a.mp4'), path.join(dir, 'b.mp4'), path.join(dir, 'c.avi'), path.join(dir, 'notes.txt')]);
  });

  it('keeps plain existing files and dedupes results', () => {
    const file = path.join(dir, 'a.mp4');
    const result = expandInputs([file, file, path.join(dir, '*.mp4')]);
    expect(result).toEqual([path.join(dir, 'a.mp4'), path.join(dir, 'b.mp4')]);
  });

  it('ignores patterns that match nothing', () => {
    expect(expandInputs([path.join(dir, '*.mkv')])).toEqual([]);
    expect(expandInputs([path.join(dir, 'missing.mp4')])).toEqual([]);
  });

  it('expands a home-directory prefix', () => {
    const homeDir = fs.mkdtempSync(path.join(os.homedir(), 'encodex-cli-util-home-'));
    const file = path.join(homeDir, 'a.mp4');
    fs.writeFileSync(file, 'a');
    const result = expandInputs([`~${file.slice(os.homedir().length)}`]);
    expect(result).toEqual([file]);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });
});

describe('deriveOutputPath', () => {
  it('keeps the input extension by default', () => {
    expect(deriveOutputPath('/a/b/clip.mp4')).toBe(path.join('/a/b', 'clip.mp4'));
  });

  it('appends a suffix before the extension', () => {
    expect(deriveOutputPath('/a/b/clip.mp4', { suffix: '_converted' })).toBe(path.join('/a/b', 'clip_converted.mp4'));
  });

  it('replaces the extension when outputExt is given', () => {
    expect(deriveOutputPath('/a/b/clip.mp4', { suffix: '_converted', outputExt: 'webm' })).toBe(path.join('/a/b', 'clip_converted.webm'));
  });

  it('places the output in outputDir when given', () => {
    const out = deriveOutputPath('/a/b/clip.mp4', { suffix: '_c', outputExt: 'mp4', outputDir: '/out' });
    expect(out).toBe(path.join(path.resolve('/out'), 'clip_c.mp4'));
  });
});

describe('timemarkToSeconds', () => {
  it('parses HH:MM:SS and HH:MM:SS.mmm', () => {
    expect(timemarkToSeconds('00:01:30')).toBe(90);
    expect(timemarkToSeconds('00:01:30.5')).toBe(90.5);
    expect(timemarkToSeconds('01:02:03')).toBe(3723);
  });

  it('parses MM:SS and plain seconds', () => {
    expect(timemarkToSeconds('01:30')).toBe(90);
    expect(timemarkToSeconds('45')).toBe(45);
  });

  it('returns NaN for unparsable values', () => {
    expect(timemarkToSeconds('abc')).toBeNaN();
    expect(timemarkToSeconds('00:xx:00')).toBeNaN();
    expect(timemarkToSeconds('')).toBeNaN();
  });
});

describe('percentFromTimemark', () => {
  it('computes a clamped percentage', () => {
    expect(percentFromTimemark('00:00:30', 120)).toBe(25);
    expect(percentFromTimemark('00:03:00', 120)).toBe(100);
    expect(percentFromTimemark('00:00:00', 120)).toBe(0);
  });

  it('returns 0 for invalid or non-positive durations', () => {
    expect(percentFromTimemark('bad', 120)).toBe(0);
    expect(percentFromTimemark('00:00:30', 0)).toBe(0);
    expect(percentFromTimemark('00:00:30', -5)).toBe(0);
  });
});

describe('formatBytes', () => {
  it('formats binary units with one decimal', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
    expect(formatBytes(1610612736)).toBe('1.5 GB');
  });

  it('falls back to 0 B for invalid input', () => {
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('formats hours, minutes, and seconds compactly', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('falls back to 0s for invalid input', () => {
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(-3)).toBe('0s');
  });
});

describe('parseTimeValue', () => {
  it('parses plain seconds', () => {
    expect(parseTimeValue('90')).toBe(90);
    expect(parseTimeValue('1.5')).toBe(1.5);
  });

  it('parses MM:SS and HH:MM:SS', () => {
    expect(parseTimeValue('01:30')).toBe(90);
    expect(parseTimeValue('00:01:30')).toBe(90);
  });

  it('returns NaN for invalid values', () => {
    expect(parseTimeValue('')).toBeNaN();
    expect(parseTimeValue('abc')).toBeNaN();
    expect(parseTimeValue('1:2:3:4')).toBeNaN();
    expect(parseTimeValue('1:xx')).toBeNaN();
  });
});
