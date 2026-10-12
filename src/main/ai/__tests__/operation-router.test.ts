/**
 * @fileoverview Tests for the deterministic Copilot operation router.
 *
 * The router is the offline default and the LLM fallback: it detects an
 * operation from the goal, extracts its fields, and builds ready-to-run actions
 * through the same MCP builders the queue uses.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildOperationActions, detectOperation, extractFields, routeOperationDeterministic } from '../operation-router';
import type { ProbedEntry } from '../operation-router';
import type { MediaFacts } from '../../../shared/ai/types';
import type { MediaInfo, MediaStreamInfo } from '../../../shared/types';

/** Writes a throwaway file and returns its path. */
function tempMedia(ext: string, name = 'clip'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-'));
  const file = path.join(dir, `${name}.${ext}`);
  fs.writeFileSync(file, 'fake');
  return file;
}

/** A probe stream with a type and codec. */
function stream(partial: Partial<MediaStreamInfo> & { type: MediaStreamInfo['type'] }): MediaStreamInfo {
  return { index: 0, codec: 'unknown', ...partial } as MediaStreamInfo;
}

/** Reduced facts for a probed file. */
function facts(file: string): MediaFacts {
  return {
    file,
    format: 'mp4',
    sizeBytes: 1_000_000,
    durationSeconds: 60,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
  };
}

/** A probed entry (facts are unused by the builders; info drives analyze). */
function entry(file: string, streams: MediaStreamInfo[]): ProbedEntry {
  const info: MediaInfo = { file, format: 'mp4', size: 1_000_000, duration: 60, bitrate: '2000k', streams };
  return { file, facts: facts(file), info };
}

describe('detectOperation', () => {
  it('matches each keyword family and defaults to convert', () => {
    const cases: Array<[string, string]> = [
      ['remux this into mkv', 'remux'],
      ['repackage without re-encoding', 'remux'],
      ['extract the audio track', 'extract_audio'],
      ['rip the music', 'extract_audio'],
      ['demux the file into separate streams', 'demux'],
      ['compress this jpeg photo', 'compress_image'],
      ['cut from 00:10 to 00:20', 'cut'],
      ['trim the intro', 'cut'],
      ['analyze this file', 'analyze'],
      ['make a smaller mp4', 'convert'],
      ['transcribe the audio', 'transcribe'],
      ['make captions for this video', 'transcribe'],
      ['summarize this recording', 'summarize'],
      ['give me a tl;dr', 'summarize'],
      ['generate chapters', 'chapters'],
      ['find the part where he says hello', 'search_transcript'],
      ['translate the subtitles', 'translate'],
      ['find duplicate videos', 'find_similar'],
      ['look for near-duplicate files', 'find_similar'],
    ];
    for (const [goal, expected] of cases) expect(detectOperation(goal)).toBe(expected);
  });
});

describe('extractFields', () => {
  it('extracts a remux container or falls back to the input extension', () => {
    expect(extractFields('remux', 'remux to mkv', 'mp4')).toEqual({ container: 'mkv' });
    expect(extractFields('remux', 'repackage it', 'avi')).toEqual({ container: 'avi' });
  });

  it('selects the demux stream category named in the goal', () => {
    expect(extractFields('demux', 'extract the video')).toEqual({ video: true });
    expect(extractFields('demux', 'separate the audio')).toEqual({ audio: true });
    expect(extractFields('demux', 'pull out subtitles')).toEqual({ subtitles: true });
    expect(extractFields('demux', 'split streams')).toEqual({ all: true });
  });

  it('maps an audio codec and bitrate for extract_audio', () => {
    expect(extractFields('extract_audio', 'extract audio as mp3')).toEqual({ audioCodec: 'libmp3lame' });
    expect(extractFields('extract_audio', 'rip audio at 128k')).toEqual({ bitrate: '128k' });
  });

  it('maps an image format and quality for compress_image', () => {
    expect(extractFields('compress_image', 'convert to webp quality 15')).toEqual({ format: 'webp', quality: 15 });
  });

  it('extracts a time range for cut and nothing for convert', () => {
    expect(extractFields('cut', 'cut from 00:10 to 00:20')).toEqual({ startTime: '00:10', endTime: '00:20' });
    expect(extractFields('convert', 'make it smaller')).toEqual({});
  });

  it('extracts language and format for transcribe', () => {
    expect(extractFields('transcribe', 'transcribe in spanish as srt')).toEqual({ language: 'es', format: 'srt' });
  });

  it('extracts a brevity and topic count for summarize', () => {
    expect(extractFields('summarize', 'give me a brief summary')).toEqual({ maxSentences: 3 });
    expect(extractFields('summarize', 'list 4 topics')).toEqual({ maxTopics: 4 });
  });

  it('extracts a chapter count for chapters', () => {
    expect(extractFields('chapters', 'generate 5 chapters')).toEqual({ maxChapters: 5 });
  });

  it('extracts a quoted phrase for search_transcript', () => {
    expect(extractFields('search_transcript', 'find "the pricing part"')).toEqual({ query: 'the pricing part' });
  });

  it('extracts a target language and format for translate', () => {
    expect(extractFields('translate', 'translate subtitles to french as vtt')).toEqual({ targetLanguage: 'fr', format: 'vtt' });
  });

  it('returns no fields for find_similar', () => {
    expect(extractFields('find_similar', 'find duplicates')).toEqual({});
  });

  it('accepts a bare two-letter language code and ignores unknown words', () => {
    expect(extractFields('transcribe', 'transcribe in xy')).toEqual({ language: 'xy' });
    expect(extractFields('transcribe', 'transcribe in zzz')).toEqual({});
  });
});

describe('routeOperationDeterministic', () => {
  it('routes from the goal text and stamps the rules provider', () => {
    const routed = routeOperationDeterministic({ goal: 'remux to mkv', operation: null });
    expect(routed).toMatchObject({ operation: 'remux', fields: { container: 'mkv' }, providerId: 'rules', confidence: 0.5 });
    expect(routed.rationale[0]).toContain('Routed to');
  });

  it('honors a forced operation over the goal text', () => {
    const routed = routeOperationDeterministic({ goal: 'remux to mkv', operation: 'analyze' });
    expect(routed.operation).toBe('analyze');
    expect(routed.rationale[0]).toContain('selected explicitly');
  });
});

describe('buildOperationActions', () => {
  it('builds a read-only analyze result', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('analyze', {}, [entry(input, [stream({ type: 'video', codec: 'h264' })])], 0.5, ['why']);
    expect(built.results).toHaveLength(1);
    expect(built.results[0]).toMatchObject({ operation: 'analyze', input });
    expect(built.actions).toHaveLength(0);
  });

  it('builds a remux action', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('remux', { container: 'mkv' }, [entry(input, [stream({ type: 'video', codec: 'h264' })])], 0.5, [
      'why',
    ]);
    expect(built.actions).toHaveLength(1);
    expect(built.actions[0]).toMatchObject({ operation: 'remux', input, id: 'remux_0' });
    expect(built.actions[0]?.output?.endsWith('.mkv')).toBe(true);
  });

  it('builds one action per demuxed stream', () => {
    const input = tempMedia('mp4');
    const streams = [stream({ index: 0, type: 'video' }), stream({ index: 1, type: 'audio' }), stream({ index: 2, type: 'subtitle' })];
    const built = buildOperationActions('demux', { all: true }, [entry(input, streams)], 0.5, ['why']);
    expect(built.actions).toHaveLength(3);
    expect(built.actions.every((action) => action.operation === 'demux')).toBe(true);
  });

  it('skips an operation that is not available for the file', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('convert', {}, [entry(input, [])], 0.5, ['why']);
    expect(built.actions).toHaveLength(0);
    expect(built.skips).toHaveLength(1);
    expect(built.skips[0].reason).toContain('not available');
  });

  it('builds an extract_audio action', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('extract_audio', { audioCodec: 'libmp3lame' }, [entry(input, [stream({ type: 'audio' })])], 0.5, [
      'why',
    ]);
    expect(built.actions).toHaveLength(1);
    expect(built.actions[0]).toMatchObject({ operation: 'extract_audio', input, id: 'extract_audio_0' });
  });

  it('builds a compress_image action', () => {
    const input = tempMedia('png');
    const built = buildOperationActions(
      'compress_image',
      { format: 'webp', quality: 70 },
      [entry(input, [stream({ type: 'video' })])],
      0.5,
      ['why'],
    );
    expect(built.actions).toHaveLength(1);
    expect(built.actions[0]).toMatchObject({ operation: 'compress_image', input, id: 'compress_image_0' });
  });

  it('builds a cut action', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('cut', { startTime: '00:10', endTime: '00:20' }, [entry(input, [stream({ type: 'video' })])], 0.5, [
      'why',
    ]);
    expect(built.actions).toHaveLength(1);
    expect(built.actions[0]).toMatchObject({ operation: 'cut', input, id: 'cut_0' });
  });

  it('isolates a builder failure into a skip', () => {
    const input = tempMedia('mp4');
    const built = buildOperationActions('demux', {}, [entry(input, [])], 0.5, ['why']);
    expect(built.actions).toHaveLength(0);
    expect(built.skips).toHaveLength(1);
    expect(built.skips[0].input).toBe(input);
    expect(built.skips[0].reason).toContain('No');
  });
});
