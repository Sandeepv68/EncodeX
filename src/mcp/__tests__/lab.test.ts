/**
 * @fileoverview Tests for the measured target-size loop (`compress_to_target`)
 * and the folder savings report (`analyze_folder`).
 *
 * A size-aware fake transcoder reports an output size computed from the video
 * bitrate it was asked to encode, so the loop's convergence is driven by the
 * measured bytes — exactly what production does with a re-probe.
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../server';
import type { ITranscoder } from '../../main/transcoders/types';
import type { ConversionOptions, MediaInfo } from '../../shared/types';

/**
 * Extracts a kbps integer from a bitrate value such as '571k' or '128k'.
 * @param {string | undefined} value - The bitrate value.
 * @returns {number} The kbps value, or 0 when absent.
 */
function kbps(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Probe facts for a 60 s, 10 MB clip with one video and one audio stream.
 * @const {MediaInfo}
 */
const SOURCE: MediaInfo = {
  file: 'source.mp4',
  format: 'mov,mp4',
  size: 10 * 1024 * 1024,
  duration: 60,
  bitrate: '1500k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
    { index: 1, type: 'audio', codec: 'aac', channels: 2 },
  ],
};

/**
 * A transcoder whose output size is `(videoKbps + audioKbps) * 1000 / 8 *
 * duration`, so a lower requested bitrate yields a smaller measured output.
 * @class SizeAwareTranscoder
 */
class SizeAwareTranscoder implements ITranscoder {
  /** Options recorded per output path. */
  readonly outputs = new Map<string, ConversionOptions>();

  /** Output paths passed to `convert`, in order. */
  readonly converted: string[] = [];

  /**
   * Records the options for an output and completes on a microtask.
   * @param {string} input - Input path (ignored).
   * @param {string} output - Output path used as the map key.
   * @param {ConversionOptions} options - Encoder options carrying the bitrates.
   * @returns {EventEmitter} The converting emitter.
   */
  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    void input;
    this.outputs.set(output, options);
    this.converted.push(output);
    const emitter = new EventEmitter();
    queueMicrotask(() => emitter.emit('end'));
    return emitter;
  }

  /**
   * Returns the source facts for the input, or the size-derived facts for a
   * produced output.
   * @param {string} input - The path to probe.
   * @returns {Promise<MediaInfo>} The probe result.
   */
  async getInfo(input: string): Promise<MediaInfo> {
    const options = this.outputs.get(input);
    if (!options) return SOURCE;
    const totalKbps = kbps(options.videoBitrate) + kbps(options.audioBitrate);
    return {
      file: input,
      format: 'mov,mp4',
      size: Math.round(((totalKbps * 1000) / 8) * SOURCE.duration),
      duration: SOURCE.duration,
      bitrate: `${totalKbps}k`,
      streams: SOURCE.streams,
    };
  }

  /** No-op. @returns {void} */
  cancel(): void {}
  /** No-op. @returns {void} */
  pause(): void {}
  /** No-op. @returns {void} */
  resume(): void {}
  /** Backend id. @returns {string} Always 'FFMPEG'. */
  getType(): string {
    return 'FFMPEG';
  }
}

/**
 * Creates a throwaway media file so path guards pass.
 * @param {string} dir - The directory to create it in.
 * @param {string} name - The file name.
 * @returns {string} The absolute file path.
 */
function mediaFile(dir: string, name: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, 'not-a-real-video');
  return file;
}

/**
 * Connects an in-memory client to a server whose transcoders are size-aware.
 * @param {SizeAwareTranscoder} transcoder - The shared fake transcoder.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function connect(transcoder: SizeAwareTranscoder): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => transcoder });
  await server.connect(serverTransport);
  const client = new Client({ name: 'lab-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

describe('compress_to_target', () => {
  it('stops at the highest candidate whose measured output fits', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-lab-'));
    const input = mediaFile(dir, 'clip.mp4');
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'compress_to_target',
        arguments: { input, maxBytes: 5 * 1024 * 1024 },
      })) as CallToolResult;
      const lab = (result.structuredContent as { lab?: Record<string, unknown> }).lab;
      expect(lab).toBeDefined();
      expect(lab?.converged).toBe(true);
      const chosen = lab?.chosen as { videoBitrateKbps?: number };
      // 657k+128k overshoots 5 MB; the 571k baseline fits.
      expect(chosen.videoBitrateKbps).toBe(571);
      expect((lab?.attempts as unknown[]).length).toBe(2);
    } finally {
      await close();
    }
  });

  it('reports no fit when every candidate overshoots the ceiling', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-lab-'));
    const input = mediaFile(dir, 'clip.mp4');
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'compress_to_target',
        arguments: { input, maxBytes: 700 * 1024 },
      })) as CallToolResult;
      const lab = (result.structuredContent as { lab?: Record<string, unknown> }).lab;
      expect(lab?.converged).toBe(false);
      expect(lab?.chosen).toBeUndefined();
      expect((lab?.attempts as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('fails clearly when the input does not exist', async () => {
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'compress_to_target',
        arguments: { input: path.join(os.tmpdir(), 'missing-encodex-lab.mp4'), maxBytes: 1024 },
      })) as CallToolResult;
      expect(result.isError).toBe(true);
      expect((result.structuredContent as { code?: string }).code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });
});

describe('analyze_folder', () => {
  it('projects per-file savings and rolls them into a folder summary', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-folder-'));
    mediaFile(dir, 'a.mp4');
    mediaFile(dir, 'b.mov');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'not media');
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'analyze_folder',
        arguments: { path: dir },
      })) as CallToolResult;
      const library = (result.structuredContent as { library?: Record<string, unknown> }).library;
      expect(library).toBeDefined();
      expect(library?.scanned).toBe(2);
      expect(library?.analyzedCount).toBe(2);
      expect(library?.errorCount).toBe(0);
      expect(library?.totalSourceBytes).toBe(2 * 10 * 1024 * 1024);
      expect(library?.totalSavingsBytes as number).toBeGreaterThan(0);
      expect(library?.isEstimated).toBe(true);
      expect((library?.largest as unknown[]).length).toBe(2);
    } finally {
      await close();
    }
  });

  it('honours maxFiles', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-folder-'));
    mediaFile(dir, 'a.mp4');
    mediaFile(dir, 'b.mp4');
    mediaFile(dir, 'c.mp4');
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'analyze_folder',
        arguments: { path: dir, maxFiles: 2 },
      })) as CallToolResult;
      const library = (result.structuredContent as { library?: Record<string, unknown> }).library;
      expect(library?.scanned).toBe(3);
      expect(library?.analyzed).toBe(2);
      expect(library?.truncated).toBe(true);
    } finally {
      await close();
    }
  });

  it('fails clearly when the folder does not exist', async () => {
    const transcoder = new SizeAwareTranscoder();
    const { client, close } = await connect(transcoder);
    try {
      const result = (await client.callTool({
        name: 'analyze_folder',
        arguments: { path: path.join(os.tmpdir(), 'missing-encodex-folder') },
      })) as CallToolResult;
      expect(result.isError).toBe(true);
      expect((result.structuredContent as { code?: string }).code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });
});
