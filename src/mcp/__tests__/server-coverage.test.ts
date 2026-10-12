/**
 * @fileoverview Regression tests for the diff-coverage gap in `src/mcp/server.ts`:
 * headless/commit confirm paths, workload error branches (compress_to_target ladder,
 * workflow steps), AI-tool failure catches, and resolved transcript/probe paths.
 * Every test is hermetic: transcoders, the job manager, frame sampling, and STT
 * behaviour are injected, and no FFmpeg binary is touched.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MediaInfo, MediaStreamInfo, TranscoderType } from '../../shared/types';
import type { ConversionOptions } from '../../shared/types';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';
import { createMcpServer } from '../server';
import { MCPJobManager } from '../jobs/manager';
import type { MCPJob } from '../jobs/manager';
import { FakeTranscoder, type FakeTranscoderOptions } from './test-helpers';

/** A 720p H.264 + AAC stream set for the fake probe (video + audio). */
const STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
];

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cov-'));

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Creates a dummy file on disk. */
function makeFile(name: string): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, 'stub');
  return file;
}

/**
 * A transcoder whose `getInfo` reports probe streams, so both `probeMedia` and
 * the produced-output re-probe in `compress_to_target` read the same facts.
 * @class
 */
class StreamsTranscoder extends FakeTranscoder {
  /**
   * Returns the fixed probe facts for any path.
   * @param {string} input - The path to probe.
   * @returns {Promise<MediaInfo>} The probe facts.
   */
  async getInfo(input: string): Promise<MediaInfo> {
    return { file: input, format: 'mov,mp4', size: 10 * 1024 * 1024, duration: 60, bitrate: '1500k', streams: STREAMS };
  }
}

/**
 * A transcoder whose probe succeeds for inputs but fails for produced outputs,
 * so the `compress_to_target` "unreadable output" branch is exercised.
 * @class
 */
class UnreadableOutputTranscoder extends StreamsTranscoder {
  /**
   * Throws for the suffixed candidate outputs; probes everything else normally.
   * @param {string} input - The path to probe.
   * @returns {Promise<MediaInfo>} The probe facts.
   * @throws {Error} When the path is a produced candidate output.
   */
  async getInfo(input: string): Promise<MediaInfo> {
    if (input.includes('_target_')) throw new Error('output unreadable');
    return super.getInfo(input);
  }
}

/** A transcoder whose probe always fails (find_similar_media fallback path). */
class ProbeFailingTranscoder extends FakeTranscoder {
  /** @throws {Error} Always. */
  async getInfo(input: string): Promise<MediaInfo> {
    void input;
    throw new Error('probe exploded');
  }
}

/** A job manager whose enqueue always throws (ladder enqueue-failure branch). */
class ThrowingEnqueueJobManager extends MCPJobManager {
  /**
   * @throws {Error} Always.
   */
  enqueue(_input: string, _output: string, _options: ConversionOptions, _transcoder?: TranscoderType): MCPJob {
    throw new Error('enqueue exploded');
  }
}

/** A job manager that never reports a queued job (ladder wait timeout branch). */
class MissingJobJobManager extends MCPJobManager {
  /** Always unknown. @returns {undefined} */
  getJob(_id: string): MCPJob | undefined {
    return undefined;
  }
}

/** A job manager whose lookup throws (explain_error catch branch). */
class ThrowingGetJobJobManager extends MCPJobManager {
  /** @throws {Error} Always. */
  getJob(_id: string): MCPJob {
    throw new Error('job store exploded');
  }
}

/**
 * A transcoder that writes its output path, so a later workflow step consuming
 * `{{<step>.output}}` sees the file the earlier step produced.
 * @class
 */
class WritingTranscoder extends FakeTranscoder {
  /**
   * Materializes the output then delegates to the fake's async completion.
   * @param {string} input - Input path (ignored).
   * @param {string} output - Output path to materialize.
   * @param {ConversionOptions} options - Conversion options.
   * @returns {import('events').EventEmitter} The fake's emitter.
   */
  convert(input: string, output: string, options: ConversionOptions): import('events').EventEmitter {
    fs.writeFileSync(output, 'output');
    return super.convert(input, output, options);
  }
}

/** Setup knobs for the coverage-regression sessions. */
interface SessionOptions {
  uiCapable?: boolean;
  transcoderFactory?: (type: TranscoderType) => FakeTranscoder | StreamsTranscoder | WritingTranscoder;
  jobManager?: MCPJobManager;
  frameSampler?: (file: string, at: number) => Promise<string | undefined>;
  transcoderOptions?: FakeTranscoderOptions;
}

/**
 * Connects an in-memory client to a server using fake transcoders (defaulting
 * to video + audio probe streams) and optional injected dependencies.
 * @param {SessionOptions} [options] - Client/server behavior overrides.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(options: SessionOptions = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const factory = options.transcoderFactory ?? (() => new FakeTranscoder(options.transcoderOptions ?? { streams: STREAMS }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: factory,
    jobManager: options.jobManager,
    frameSampler: options.frameSampler,
  });
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'mcp-cov-test', version: '1.0.0' },
    options.uiCapable ? { capabilities: { extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } } } : undefined,
  );
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

/** Parses the structuredContent of a tool result. */
function structured(result: any): any {
  return result.structuredContent;
}

describe('confirm branches (MCP Apps clients)', () => {
  it.each([
    ['compress_image', { format: 'webp' }],
    ['extract_audio', { audioCodec: 'mp3' }],
    ['cut_video', { startTime: '00:00:01', endTime: '00:00:02' }],
    ['remux_media', { container: 'mkv' }],
    ['demux_media', { video: true }],
  ])('proposes %s for confirmation and commits it headlessly', async (tool, extra) => {
    const input = makeFile(`${tool}.mp4`);
    const { client, close } = await setup({ uiCapable: true, transcoderFactory: () => new StreamsTranscoder() });
    try {
      const proposed = await client.callTool({ name: tool, arguments: { input, ...extra } });
      const confirmation = structured(proposed).confirmation;
      expect(confirmation.operation).toBe(tool);

      const committed = await client.callTool({ name: 'commit_operation', arguments: { tool, args: confirmation.args } });
      expect(committed.isError).toBeFalsy();
      const jobs = await client.callTool({ name: 'list_jobs', arguments: {} });
      expect(structured(jobs).count).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });
});

describe('headless execution edge paths', () => {
  it('applies concurrency when converting a file', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'convert_media',
        arguments: { input: makeFile('conv-conc.mp4'), concurrency: 2 },
      });
      expect(result.isError).toBeFalsy();
      expect(structured(result).job.id).toBeTruthy();
    } finally {
      await close();
    }
  });

  it('applies concurrency when batching files', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'batch-conc-'));
    fs.writeFileSync(path.join(dir, 'one.mp4'), 'stub');
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'batch_convert',
        arguments: { inputs: [dir], concurrency: 2 },
      });
      expect(result.isError).toBeFalsy();
      expect(structured(result).total).toBe(1);
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails clearly when a cut input is missing', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'cut_video',
        arguments: { input: path.join(tempDir, 'cut-missing.mp4') },
      });
      expect(result.isError).toBe(true);
      expect(structured(result).code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });

  it('ignores a malformed approved envelope on batch commit', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'batch-env-'));
    fs.writeFileSync(path.join(dir, 'one.mp4'), 'stub');
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'commit_operation',
        arguments: {
          tool: 'batch_convert',
          args: { inputs: [dir], __envelope: { fileCount: 'nope', totalBytes: 'nope' } },
        },
      });
      expect(result.isError).toBeFalsy();
      expect(structured(result).total).toBe(1);
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('compress_to_target failure ladder', () => {
  it('errors when no size-target candidate can be planned', async () => {
    const { client, close } = await setup({ transcoderOptions: { streams: [] } });
    try {
      const result = await client.callTool({
        name: 'compress_to_target',
        arguments: { input: makeFile('no-video.mp4'), maxBytes: 1024 },
      });
      expect(result.isError).toBe(true);
      expect(structured(result).code).toBe('UNKNOWN');
    } finally {
      await close();
    }
  });

  it('records an error attempt when enqueueing a candidate fails', async () => {
    const { client, close } = await setup({ jobManager: new ThrowingEnqueueJobManager() });
    try {
      const result = await client.callTool({
        name: 'compress_to_target',
        arguments: { input: makeFile('enqueue-fail.mp4'), maxBytes: 5 * 1024 * 1024 },
      });
      const lab = structured(result).lab;
      expect(lab.converged).toBe(false);
      expect(lab.attempts[0].status).toBe('error');
      expect(lab.attempts[0].error).toContain('enqueue exploded');
    } finally {
      await close();
    }
  });

  it('records a timeout attempt when a candidate job disappears', async () => {
    const { client, close } = await setup({ jobManager: new MissingJobJobManager() });
    try {
      const result = await client.callTool({
        name: 'compress_to_target',
        arguments: { input: makeFile('job-vanishes.mp4'), maxBytes: 5 * 1024 * 1024 },
      });
      const lab = structured(result).lab;
      expect(lab.converged).toBe(false);
      expect(lab.attempts[0].status).toBe('timeout');
      expect(lab.attempts[0].error).toContain('Job not found');
    } finally {
      await close();
    }
  });

  it('records an error attempt when a candidate job fails', async () => {
    const { client, close } = await setup({ transcoderOptions: { streams: STREAMS, fail: true } });
    try {
      const result = await client.callTool({
        name: 'compress_to_target',
        arguments: { input: makeFile('job-fails.mp4'), maxBytes: 5 * 1024 * 1024 },
      });
      const lab = structured(result).lab;
      expect(lab.converged).toBe(false);
      expect(lab.attempts[0].status).toBe('error');
    } finally {
      await close();
    }
  });

  it('records an unreadable attempt when the produced output cannot be re-probed', async () => {
    const { client, close } = await setup({ transcoderFactory: () => new UnreadableOutputTranscoder() });
    try {
      const result = await client.callTool({
        name: 'compress_to_target',
        arguments: { input: makeFile('unreadable.mp4'), maxBytes: 5 * 1024 * 1024 },
      });
      const lab = structured(result).lab;
      expect(lab.converged).toBe(false);
      expect(lab.attempts[0].status).toBe('unreadable');
    } finally {
      await close();
    }
  });
});

describe('analyze_folder edge rows', () => {
  it('reports a per-file error when a source has no size-targetable video', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'folder-novideo-'));
    fs.writeFileSync(path.join(dir, 'audio.mov'), 'stub');
    const { client, close } = await setup({ transcoderOptions: { streams: [] } });
    try {
      const result = await client.callTool({ name: 'analyze_folder', arguments: { path: dir } });
      const library = structured(result).library;
      expect(result.isError).toBeFalsy();
      expect(library.errorCount).toBe(1);
      expect(library.fileCount).toBe(1);
      expect(library.analyzedCount).toBe(0);
      expect(library.notes[0]).toContain('could not be projected');
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tolerates a probe failure per file and records it as an error row', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'folder-probe-'));
    fs.writeFileSync(path.join(dir, 'broken.mp4'), 'stub');
    const { client, close } = await setup({ transcoderFactory: () => new ProbeFailingTranscoder() });
    try {
      const result = await client.callTool({ name: 'analyze_folder', arguments: { path: dir } });
      const library = structured(result).library;
      expect(result.isError).toBeFalsy();
      expect(library.errorCount).toBe(1);
      expect(library.analyzedCount).toBe(0);
      expect(library.notes[0]).toContain('could not be projected');
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('workflow execution paths', () => {
  it('runs compress_image, extract_audio, and remux_media steps', async () => {
    const writing = () => new WritingTranscoder({ streams: STREAMS });
    const { client, close } = await setup({ transcoderFactory: writing });
    try {
      const input = makeFile('wf-multi.mp4');
      const subtitle = makeFile('wf-sub.srt');
      const audioTrack = makeFile('wf-audio.m4a');
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: {
          steps: [
            { id: 'a', tool: 'convert_media', args: { input } },
            { id: 'b', tool: 'compress_image', args: { input: '{{a.output}}' } },
            { id: 'c', tool: 'extract_audio', args: { input: '{{a.output}}' } },
            {
              id: 'd',
              tool: 'remux_media',
              args: { input: '{{a.output}}', addSubtitle: [{ file: subtitle }], addAudio: [{ file: audioTrack }] },
            },
          ],
        },
      });
      const report = structured(result).result;
      expect(report.completed).toBe(true);
      expect(report.steps).toHaveLength(4);
      expect(report.steps.map((step: { tool: string }) => step.tool)).toEqual([
        'convert_media',
        'compress_image',
        'extract_audio',
        'remux_media',
      ]);
    } finally {
      await close();
    }
  });

  it('reports a failed step when a job ends in error', async () => {
    const { client, close } = await setup({ transcoderOptions: { streams: STREAMS, fail: true } });
    try {
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: { steps: [{ id: 'a', tool: 'convert_media', args: { input: makeFile('wf-fail.mp4') } }] },
      });
      const report = structured(result).result;
      expect(report.completed).toBe(false);
      expect(report.failed?.id).toBe('a');
      expect(report.steps[0].status).toBe('error');
    } finally {
      await close();
    }
  });

  it('fails clearly for an invalid workflow', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: { steps: [{ id: 'a', tool: 'convert_media', args: { input: '{{nope.output}}' } }] },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});

describe('AI-tool failure and probe paths', () => {
  it.each([
    ['recommend_settings', { input: 'missing-input.mp4', intent: 'make it small' }],
    ['estimate_conversion', { input: 'missing-input.mp4' }],
    ['validate_output', { output: 'missing-output.mp4' }],
    ['quality_report', { source: 'missing-source.mp4', output: 'missing-source.mp4' }],
    ['transcribe_media', { input: 'missing-input.mp4' }],
    ['generate_chapters', { input: 'missing-input.mp4' }],
    ['search_transcript', { input: 'missing-input.mp4', query: 'bread' }],
  ])('fails clearly when a %s input is missing', async (tool, args) => {
    const { client, close } = await setup();
    try {
      const argsWithPaths = Object.fromEntries(
        Object.entries(args).map(([key, value]) => [
          key,
          typeof value === 'string' && value.startsWith('missing-') ? path.join(tempDir, value) : value,
        ]),
      );
      const result = await client.callTool({ name: tool, arguments: argsWithPaths });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('rejects an unavailable translation provider', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'translate_subtitles',
        arguments: { segments: [{ start: 0, end: 5, text: 'hello' }], targetLanguage: 'fr', provider: 'cloud' },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(structured(result) ?? result.content)).toContain('TRANSLATION_UNAVAILABLE');
    } finally {
      await close();
    }
  });

  it('drops unreadable files during similarity probing', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'similar-probe-'));
    fs.writeFileSync(path.join(dir, 'broken.mp4'), 'stub');
    const { client, close } = await setup({ transcoderFactory: () => new ProbeFailingTranscoder() });
    try {
      const result = await client.callTool({
        name: 'find_similar_media',
        arguments: { inputs: [dir], method: 'metadata' },
      });
      expect(result.isError).toBeFalsy();
      expect(structured(result).report.compared).toBe(1);
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('probes the source when find_highlights has no explicit duration', async () => {
    const { client, close } = await setup({ frameSampler: async () => '0000000000000000' });
    try {
      const result = await client.callTool({
        name: 'find_highlights',
        arguments: { input: makeFile('highlights-probe.mp4'), samples: 4 },
      });
      const report = structured(result).report;
      expect(result.isError).toBeFalsy();
      expect(report.method).toBe('hash');
      expect(report.framesSampled).toBe(4);
    } finally {
      await close();
    }
  });

  it('degrades to time candidates when frame sampling fails', async () => {
    const failingSampler = async (): Promise<string | undefined> => {
      throw new Error('sampler down');
    };
    const { client, close } = await setup({ frameSampler: failingSampler });
    try {
      const result = await client.callTool({
        name: 'find_highlights',
        arguments: { input: makeFile('highlights-degrade.mp4'), durationSeconds: 60, samples: 4 },
      });
      const report = structured(result).report;
      expect(result.isError).toBeFalsy();
      expect(report.method).toBe('time');
    } finally {
      await close();
    }
  });
});

describe('explain_error job branches', () => {
  it('folds a failed job into the explanation by id', async () => {
    const { client, close } = await setup({ transcoderOptions: { streams: STREAMS, fail: true } });
    try {
      const converted = await client.callTool({ name: 'convert_media', arguments: { input: makeFile('explain-job.mp4') } });
      const jobId = structured(converted).job.id;

      const result = await client.callTool({ name: 'explain_error', arguments: { jobId } });
      expect(result.isError).toBeFalsy();
      expect(structured(result).error.code).toBeTruthy();
      expect(structured(result).error.explanation.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('tolerates an unknown job id', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({ name: 'explain_error', arguments: { jobId: 'no-such-job' } });
      expect(result.isError).toBeFalsy();
      expect(structured(result).error.code).toBeTruthy();
    } finally {
      await close();
    }
  });

  it('fails clearly when the job store errors', async () => {
    const { client, close } = await setup({ jobManager: new ThrowingGetJobJobManager() });
    try {
      const result = await client.callTool({ name: 'explain_error', arguments: { jobId: 'any-job' } });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});
