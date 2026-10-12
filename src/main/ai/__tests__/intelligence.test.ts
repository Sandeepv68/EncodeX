/**
 * @fileoverview Tests for the Copilot media-intelligence builder.
 *
 * The builder wires the MCP-only intelligence tools into the Copilot's
 * read-only result contract. Every engine is injected here so no FFmpeg or
 * whisper binary is required; the focus is orchestration, per-file skip
 * isolation, and cross-file dedupe.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildIntelligenceResults, isIntelligenceOperation, INTELLIGENCE_OPERATIONS } from '../intelligence';
import type { IntelligenceDeps } from '../intelligence';
import type { ProbedEntry } from '../operation-router';
import type { MediaFacts } from '../../../shared/ai/types';
import type { Transcript } from '../../../shared/ai/transcript';
import type { MediaInfo } from '../../../shared/types';

/** Reduced facts for a probed file. */
function facts(file: string, overrides: Partial<MediaFacts> = {}): MediaFacts {
  return {
    file,
    format: 'mp4',
    sizeBytes: 1_000_000,
    durationSeconds: 12,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
    video: { width: 1920, height: 1080, hdr: false, interlaced: false },
    ...overrides,
  };
}

/** A probed entry. */
function entry(file: string, overrides: Partial<MediaFacts> = {}): ProbedEntry {
  const info: MediaInfo = { file, format: 'mp4', size: 1_000_000, duration: 12, bitrate: '2000k', streams: [] };
  return { file, facts: facts(file, overrides), info };
}

/** A short deterministic transcript for a file. */
function transcriptFor(file: string): Transcript {
  return {
    language: 'en',
    durationSeconds: 12,
    engine: 'fake',
    segments: [
      { start: 0, end: 4, text: `Welcome to ${file}` },
      { start: 4, end: 8, text: 'The pricing plan is very simple' },
      { start: 8, end: 12, text: 'Thanks for watching' },
    ],
  };
}

/** Fake dependencies that never touch a real engine. */
function deps(overrides: Partial<IntelligenceDeps> = {}): IntelligenceDeps {
  return {
    transcribe: vi.fn(async (file: string) => transcriptFor(file)),
    translate: {
      id: 'fake',
      label: 'Fake',
      dataEgress: 'none',
      available: async () => true,
      translate: async (request) => request.segments.map((segment) => ({ ...segment, text: `[${request.targetLanguage}] ${segment.text}` })),
    },
    sampleFrame: vi.fn(async (file: string) => (file.includes('same') ? 'ffffffff' : '00000000')),
    ...overrides,
  };
}

describe('isIntelligenceOperation', () => {
  it('recognises exactly the intelligence operations', () => {
    for (const operation of INTELLIGENCE_OPERATIONS) expect(isIntelligenceOperation(operation)).toBe(true);
    expect(isIntelligenceOperation('convert')).toBe(false);
    expect(isIntelligenceOperation('analyze')).toBe(false);
  });
});

describe('buildIntelligenceResults', () => {
  it('transcribes a file into formatted subtitles', async () => {
    const built = await buildIntelligenceResults('transcribe', { format: 'srt' }, [entry('/a/clip.mp4')], deps());
    expect(built.actions).toHaveLength(0);
    expect(built.skips).toHaveLength(0);
    expect(built.results).toHaveLength(1);
    const content = built.results[0].content as { subtitles: string; format: string };
    expect(content.format).toBe('srt');
    expect(content.subtitles).toContain('pricing plan');
  });

  it('summarizes a transcript', async () => {
    const built = await buildIntelligenceResults('summarize', {}, [entry('/a/clip.mp4')], deps());
    expect(built.results).toHaveLength(1);
    expect(typeof built.results[0].summary).toBe('string');
    expect((built.results[0].summary ?? '').length).toBeGreaterThan(0);
  });

  it('generates chapters with timestamps', async () => {
    const built = await buildIntelligenceResults('chapters', {}, [entry('/a/clip.mp4')], deps());
    const content = built.results[0].content as { chapters: unknown[]; youtube: string };
    expect(Array.isArray(content.chapters)).toBe(true);
    expect(typeof content.youtube).toBe('string');
  });

  it('finds a spoken passage by query', async () => {
    const built = await buildIntelligenceResults('search_transcript', { query: 'pricing plan' }, [entry('/a/clip.mp4')], deps());
    const content = built.results[0].content as { matches: unknown[] };
    expect(content.matches.length).toBeGreaterThan(0);
  });

  it('skips a transcript search without a query', async () => {
    const built = await buildIntelligenceResults('search_transcript', {}, [entry('/a/clip.mp4')], deps());
    expect(built.results).toHaveLength(0);
    expect(built.skips).toHaveLength(1);
  });

  it('translates subtitles when a target language is given', async () => {
    const built = await buildIntelligenceResults('translate', { targetLanguage: 'es' }, [entry('/a/clip.mp4')], deps());
    const content = built.results[0].content as { subtitles: string; segments: unknown[] };
    expect(content.segments).toHaveLength(3);
    expect(content.subtitles).toContain('[es]');
  });

  it('skips a translation without a target language', async () => {
    const built = await buildIntelligenceResults('translate', {}, [entry('/a/clip.mp4')], deps());
    expect(built.results).toHaveLength(0);
    expect(built.skips).toHaveLength(1);
  });

  it('isolates a per-file transcription failure into a skip', async () => {
    const failing = deps({
      transcribe: vi.fn(async (file: string) => {
        if (file.includes('bad')) throw new Error('no speech engine');
        return transcriptFor(file);
      }),
    });
    const built = await buildIntelligenceResults('transcribe', {}, [entry('/a/bad.mp4'), entry('/a/good.mp4')], failing);
    expect(built.results).toHaveLength(1);
    expect(built.results[0].input).toBe('/a/good.mp4');
    expect(built.skips).toHaveLength(1);
    expect(built.skips[0].input).toBe('/a/bad.mp4');
  });

  it('clusters duplicate media in find_similar', async () => {
    const built = await buildIntelligenceResults(
      'find_similar',
      {},
      [entry('/a/same1.mp4'), entry('/a/same2.mp4'), entry('/a/other.mp4')],
      deps(),
    );
    expect(built.results).toHaveLength(1);
    const content = built.results[0].content as { cluster: { files: string[] } };
    expect(content.cluster.files).toHaveLength(2);
  });

  it('reports no duplicates when nothing clusters', async () => {
    const built = await buildIntelligenceResults(
      'find_similar',
      {},
      [
        entry('/a/one.mp4', { durationSeconds: 12, sizeBytes: 1_000_000 }),
        entry('/a/two.mp4', { durationSeconds: 120, sizeBytes: 9_000_000 }),
      ],
      deps({ sampleFrame: vi.fn(async (file: string) => (file.includes('one') ? 'ffffffff' : '00000000')) }),
    );
    expect(built.results).toHaveLength(1);
    expect(built.results[0].title).toContain('No duplicate');
  });
});
