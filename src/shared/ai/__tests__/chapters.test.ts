/**
 * @fileoverview Unit tests for deterministic chapter generation.
 */

import { describe, it, expect } from 'vitest';
import { buildTranscript } from '../transcript';
import { chapterTimestamp, chaptersToFfmpeg, chaptersToYouTube, generateChapters } from '../chapters';

const TRANSCRIPT = buildTranscript(
  [
    { start: 0, end: 10, text: 'Intro music and welcome to the channel' },
    { start: 10, end: 50, text: 'In this video we will bake bread step by step' },
    { start: 55, end: 90, text: 'First mix the flour and water into dough' },
    { start: 90, end: 130, text: 'Knead the dough for ten minutes until smooth' },
    { start: 135, end: 180, text: 'Now let the dough rise somewhere warm' },
  ],
  { engine: 'test', durationSeconds: 180 },
);

describe('generateChapters', () => {
  it('splits on pauses after the minimum length', () => {
    const chapters = generateChapters(TRANSCRIPT);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].start).toBe(0);
    expect(chapters[1].start).toBe(55);
    expect(chapters[2].start).toBe(135);
    for (const chapter of chapters) expect(chapter.title.length).toBeGreaterThan(0);
  });

  it('merges down to maxChapters', () => {
    const chapters = generateChapters(TRANSCRIPT, { maxChapters: 1 });
    expect(chapters).toHaveLength(1);
    expect(chapters[0].start).toBe(0);
    expect(chapters[0].end).toBe(180);
  });

  it('returns no chapters for an empty transcript', () => {
    expect(generateChapters(buildTranscript([], { engine: 'test' }))).toEqual([]);
  });
});

describe('chapter formatting', () => {
  it('formats YouTube timestamps', () => {
    expect(chapterTimestamp(0)).toBe('0:00');
    expect(chapterTimestamp(83)).toBe('1:23');
    expect(chapterTimestamp(3723)).toBe('1:02:03');
  });

  it('renders a YouTube timestamp list', () => {
    const chapters = generateChapters(TRANSCRIPT);
    const youtube = chaptersToYouTube(chapters);
    expect(youtube.split('\n')).toHaveLength(3);
    expect(youtube).toContain('0:00 ');
    expect(youtube).toContain('0:55 ');
  });

  it('renders an FFmpeg chapter metadata document', () => {
    const chapters = generateChapters(TRANSCRIPT);
    const ffmpeg = chaptersToFfmpeg(chapters, 180);
    expect(ffmpeg.startsWith(';FFMETADATA1')).toBe(true);
    expect(ffmpeg).toContain('TIMEBASE=1/1000');
    expect(ffmpeg).toContain('START=0');
    expect(ffmpeg).toContain('END=180000');
  });
});
