/**
 * @fileoverview Unit tests for subtitle serialization.
 */

import { describe, it, expect } from 'vitest';
import { assTimestamp, deriveSubtitlePath, formatSubtitles, subtitleExtension, toAss, toSrt, toVtt } from '../subtitles';
import type { TranscriptSegment } from '../transcript';

const SEGMENTS: TranscriptSegment[] = [
  { start: 0, end: 2.5, text: 'Hello world' },
  { start: 2.5, end: 5.25, text: 'Second line' },
];

describe('subtitle timestamps', () => {
  it('formats ASS timestamps at centisecond resolution', () => {
    expect(assTimestamp(3661.5)).toBe('1:01:01.50');
    expect(assTimestamp(0)).toBe('0:00:00.00');
  });
});

describe('toSrt', () => {
  it('emits numbered blocks with comma milliseconds and a trailing newline', () => {
    const srt = toSrt(SEGMENTS);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:02,500\nHello world\n\n2\n00:00:02,500 --> 00:00:05,250\nSecond line\n');
  });
});

describe('toVtt', () => {
  it('emits a WEBVTT header and dot milliseconds', () => {
    const vtt = toVtt(SEGMENTS);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
  });
});

describe('toAss', () => {
  it('emits a script header and dialogue events', () => {
    const ass = toAss(SEGMENTS);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:02.50,Default,,0,0,0,,Hello world');
  });
});

describe('formatSubtitles', () => {
  it('dispatches to the requested format', () => {
    expect(formatSubtitles(SEGMENTS, 'srt')).toBe(toSrt(SEGMENTS));
    expect(formatSubtitles(SEGMENTS, 'vtt')).toBe(toVtt(SEGMENTS));
    expect(formatSubtitles(SEGMENTS, 'ass')).toBe(toAss(SEGMENTS));
    expect(subtitleExtension('srt')).toBe('srt');
  });
});

describe('deriveSubtitlePath', () => {
  it('replaces the media extension and keeps the directory + separator style', () => {
    expect(deriveSubtitlePath('C:/media/movie.mkv', 'srt')).toBe('C:/media/movie.srt');
    expect(deriveSubtitlePath('C:\\media\\movie.mkv', 'srt')).toBe('C:\\media\\movie.srt');
    expect(deriveSubtitlePath('/home/u/clip.mp4', 'vtt')).toBe('/home/u/clip.vtt');
  });
});
