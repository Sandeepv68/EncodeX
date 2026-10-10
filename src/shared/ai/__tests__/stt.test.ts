/**
 * @fileoverview Unit tests for whisper output parsing.
 */

import { describe, it, expect } from 'vitest';
import { parseClockTimestamp, parseWhisperJson, transcriptFromText } from '../stt';

describe('parseClockTimestamp', () => {
  it('parses HH:MM:SS,mmm and dot variants', () => {
    expect(parseClockTimestamp('00:00:02,500')).toBe(2.5);
    expect(parseClockTimestamp('01:00:00.000')).toBe(3600);
    expect(Number.isNaN(parseClockTimestamp('nope'))).toBe(true);
  });
});

describe('parseWhisperJson', () => {
  it('parses the whisper.cpp transcription array (offsets)', () => {
    const transcript = parseWhisperJson({
      result: { language: 'en' },
      transcription: [
        { offsets: { from: 0, to: 2500 }, text: ' Hello world' },
        { offsets: { from: 2500, to: 5000 }, text: ' second line' },
      ],
    });
    expect(transcript.language).toBe('en');
    expect(transcript.segments).toHaveLength(2);
    expect(transcript.segments[0]).toEqual({ start: 0, end: 2.5, text: 'Hello world' });
    expect(transcript.durationSeconds).toBe(5);
  });

  it('falls back to string timestamps when offsets are missing', () => {
    const transcript = parseWhisperJson({
      transcription: [{ timestamps: { from: '00:00:01,000', to: '00:00:03,000' }, text: 'hi' }],
    });
    expect(transcript.segments[0]).toEqual({ start: 1, end: 3, text: 'hi' });
  });

  it('parses the OpenAI-style segments array', () => {
    const transcript = parseWhisperJson({
      language: 'fr',
      segments: [{ start: 0, end: 1.5, text: 'bonjour' }],
    });
    expect(transcript.language).toBe('fr');
    expect(transcript.segments[0].text).toBe('bonjour');
  });

  it('tolerates an empty/unknown payload', () => {
    const transcript = parseWhisperJson({});
    expect(transcript.segments).toEqual([]);
    expect(transcript.durationSeconds).toBe(0);
  });
});

describe('transcriptFromText', () => {
  it('wraps plain text in a single timed segment', () => {
    const transcript = transcriptFromText('hello   world', 12, 'whisper.cpp');
    expect(transcript.engine).toBe('whisper.cpp');
    expect(transcript.segments).toEqual([{ start: 0, end: 12, text: 'hello world' }]);
  });
});
