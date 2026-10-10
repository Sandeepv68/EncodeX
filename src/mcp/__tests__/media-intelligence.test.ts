/**
 * @fileoverview Tests for the R4 media-intelligence tools: find_similar_media,
 * transcribe_media, translate_subtitles, generate_chapters, search_transcript,
 * summarize_media. STT, frame sampling, and the local model runtime are injected
 * so the tests stay hermetic.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MediaStreamInfo } from '../../shared/types';
import type { SttEngine } from '../../shared/ai/stt';
import type { FrameSampler } from '../../shared/ai/similarity';
import type { LocalModelClient } from '../../shared/ai/provider';
import { buildTranscript } from '../../shared/ai/transcript';
import { createMcpServer } from '../server';
import { FakeTranscoder, type FakeTranscoderOptions } from './test-helpers';

/** A 720p H.264 + AAC stream set for the fake probe. */
const STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
];

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r4-'));

/**
 * Creates a dummy file on disk.
 * @param {string} name - File name.
 * @returns {string} Absolute path.
 */
function makeFile(name: string): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, 'stub');
  return file;
}

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Injected dependencies for the R4 tools. */
interface R4Overrides {
  sttEngine?: SttEngine;
  frameSampler?: FrameSampler;
  localModelClient?: LocalModelClient;
}

/**
 * Connects an in-memory client to a server with injected R4 dependencies.
 * @param {R4Overrides} [overrides] - Dependency overrides.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(overrides: R4Overrides = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const fakeOptions: FakeTranscoderOptions = { streams: STREAMS };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: () => new FakeTranscoder(fakeOptions),
    ...overrides,
  });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-r4-test', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

/**
 * Parses the structuredContent of a tool result.
 * @param {any} result - A CallToolResult.
 * @returns {any} The structured content.
 */
function structured(result: any): any {
  return result.structuredContent;
}

const SEGMENTS = [
  { start: 0, end: 10, text: 'Intro music and welcome to the channel' },
  { start: 10, end: 50, text: 'In this video we will bake bread step by step' },
  { start: 55, end: 90, text: 'First mix the flour and water into dough' },
  { start: 90, end: 130, text: 'Knead the dough for ten minutes until smooth' },
];

describe('find_similar_media', () => {
  it('clusters near-duplicate files by frame hash', async () => {
    const { client, close } = await setup({
      frameSampler: async (file) => (file.endsWith('c.mp4') ? 'ffffffffffffffff' : '0000000000000000'),
    });
    try {
      makeFile('a.mp4');
      makeFile('b.mp4');
      makeFile('c.mp4');
      const result = await client.callTool({ name: 'find_similar_media', arguments: { inputs: [tempDir] } });
      const report = structured(result).report;
      expect(report.method).toBe('hash');
      expect(report.compared).toBe(3);
      expect(report.clusters).toHaveLength(1);
      expect(report.clusters[0].files.map((f: string) => path.basename(f))).toEqual(['a.mp4', 'b.mp4']);
    } finally {
      await close();
    }
  });

  it('errors when no media files match', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r4-empty-'));
    const { client, close } = await setup({ frameSampler: async () => undefined });
    try {
      const result = await client.callTool({ name: 'find_similar_media', arguments: { inputs: [empty] } });
      expect(result.isError).toBe(true);
    } finally {
      await close();
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('transcribe_media', () => {
  it('transcribes via the injected STT engine and formats subtitles', async () => {
    const transcript = buildTranscript(SEGMENTS, { engine: 'fake-stt', durationSeconds: 130, language: 'en' });
    const sttEngine: SttEngine = {
      id: 'fake-stt',
      label: 'Fake STT',
      available: async () => true,
      transcribe: async () => transcript,
    };
    const { client, close } = await setup({ sttEngine });
    try {
      const result = await client.callTool({
        name: 'transcribe_media',
        arguments: { input: makeFile('talk.mp4'), format: 'srt', language: 'en' },
      });
      const transcription = structured(result).transcription;
      expect(transcription.engine).toBe('fake-stt');
      expect(transcription.segmentCount).toBe(4);
      expect(transcription.language).toBe('en');
      expect(transcription.subtitles).toContain('1\n00:00:00,000 --> 00:00:10,000');
      expect(transcription.suggestedOutput).toMatch(/talk\.srt$/);
    } finally {
      await close();
    }
  });
});

describe('translate_subtitles', () => {
  it('translates supplied segments via the injected local model client', async () => {
    const localModelClient: LocalModelClient = {
      generate: async () => '["Bonjour tout le monde","Premiere ligne","Deuxieme ligne","Troisieme ligne"]',
    };
    const { client, close } = await setup({ localModelClient });
    try {
      const result = await client.callTool({
        name: 'translate_subtitles',
        arguments: { segments: SEGMENTS, targetLanguage: 'fr', format: 'vtt' },
      });
      const translation = structured(result).translation;
      expect(translation.provider).toBe('local');
      expect(translation.targetLanguage).toBe('fr');
      expect(translation.segments[0].text).toBe('Bonjour tout le monde');
      expect(translation.segments[0]).toMatchObject({ start: 0, end: 10 });
      expect(translation.subtitles).toContain('WEBVTT');
    } finally {
      await close();
    }
  });

  it('fails typed when no translation backend is available', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'translate_subtitles',
        arguments: { segments: SEGMENTS, targetLanguage: 'fr' },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(structured(result) ?? result.content)).toContain('TRANSLATION_UNAVAILABLE');
    } finally {
      await close();
    }
  });
});

describe('generate_chapters', () => {
  it('generates chapters with YouTube timestamps from supplied segments', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'generate_chapters',
        arguments: { segments: SEGMENTS, durationSeconds: 130 },
      });
      const payload = structured(result).result;
      expect(payload.chapterCount).toBeGreaterThanOrEqual(2);
      expect(payload.youtube).toContain('0:00 ');
      expect(payload.ffmpeg).toContain(';FFMETADATA1');
    } finally {
      await close();
    }
  });
});

describe('search_transcript', () => {
  it('finds a passage and proposes cut_video clip arguments', async () => {
    const { client, close } = await setup();
    const input = makeFile('cook.mp4');
    try {
      const result = await client.callTool({
        name: 'search_transcript',
        arguments: { segments: SEGMENTS, durationSeconds: 130, query: 'knead until smooth', input },
      });
      const payload = structured(result).result;
      expect(payload.matches.length).toBeGreaterThan(0);
      expect(payload.bestRange).toEqual({ start: 90, end: 130 });
      expect(payload.clip).toEqual({ input, startTime: '90.000', endTime: '130.000' });
    } finally {
      await close();
    }
  });
});

describe('summarize_media', () => {
  it('summarizes supplied segments deterministically', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'summarize_media',
        arguments: { segments: SEGMENTS, durationSeconds: 130, maxSentences: 2 },
      });
      const payload = structured(result).result;
      expect(payload.summary).toHaveLength(2);
      expect(payload.topics.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('requires either input or segments', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({ name: 'summarize_media', arguments: {} });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});
