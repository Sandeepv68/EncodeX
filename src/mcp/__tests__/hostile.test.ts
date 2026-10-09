/**
 * @fileoverview Phase 6.2 - MCP hostile input tests.
 *
 * Every assertion in this file drives the production MCP layer: a real
 * `McpServer` connected to a real `Client` over `InMemoryTransport`, so tool
 * arguments pass through the SDK's zod boundary and then the tool handlers,
 * planners and job manager exactly as a hostile MCP host would drive them.
 *
 * The previous contents of this file asserted `JSON.parse` threw on a literal
 * string it built itself, and never imported `src/mcp/**`; that tested nothing
 * about the server. The three `vi.mock` calls it carried were also inert:
 * `server.ts` imports `@modelcontextprotocol/sdk/server/mcp.js`, never the
 * `stdio`/`http`/`server/index.js` modules they replaced.
 *
 * Two behaviours that are hostile-but-not-refused are deliberately NOT pinned
 * here, because pinning a defect as a contract is how it survives a fix:
 *
 *  - error envelopes echo attacker input without any truncation bound, and
 *  - `fs.existsSync` accepts a directory, so a directory reaches the queue.
 *
 * Both are recorded in the plan rather than encoded as expectations.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { MCPJobManager } from '../jobs/manager';
import { FakeTranscoder } from './test-helpers';
import type { FakeTranscoderOptions } from './test-helpers';
import type { MediaStreamInfo } from '../../shared/types';

/** Live MCP session: a connected client plus every transcoder it spawned. */
interface TestSession {
  client: Client;
  transcoders: FakeTranscoder[];
  close: () => Promise<void>;
}

/**
 * Builds a session wired to a `FakeTranscoder` factory, the same shape
 * `server.test.ts` uses so both files exercise an identical server.
 * @param {FakeTranscoderOptions} [options] - Behavior knobs for spawned fakes.
 * @returns {Promise<TestSession>} A connected client/server pair.
 */
async function setup(options: FakeTranscoderOptions = {}): Promise<TestSession> {
  const transcoders: FakeTranscoder[] = [];
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: () => {
      const t = new FakeTranscoder(options);
      transcoders.push(t);
      return t;
    },
  });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-hostile-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, transcoders, close: () => client.close() };
}

/**
 * Calls a tool, casting to `any` because the hostile suite deliberately sends
 * shapes the SDK's types forbid.
 * @param {TestSession} session - Connected session.
 * @param {string} tool - Tool name, possibly unknown.
 * @param {unknown} args - Arguments, possibly wrong-typed.
 * @returns {Promise<any>} The raw tool result.
 */
async function callTool(session: TestSession, tool: string, args: unknown): Promise<Record<string, unknown>> {
  return (await session.client.callTool({ name: tool, arguments: args as Record<string, unknown> })) as Record<string, unknown>;
}

/** Concatenated text blocks of a tool result. @returns {string} Raw text. */
function textOf(result: Record<string, unknown>): string {
  const contents = (result.content ?? []) as Array<{ type?: string; text?: string }>;
  return contents
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

/**
 * Asserts a call was refused at the zod boundary.
 *
 * The SDK reports schema failures as `isError` with a plain `MCP error -32602`
 * string rather than the server's JSON envelope, so the check is "not JSON",
 * which is what actually distinguishes boundary rejection from a handler reply.
 * @param {Record<string, unknown>} result - Raw tool result.
 * @returns {void}
 */
function expectSchemaRejection(result: Record<string, unknown>): void {
  expect(result.isError).toBe(true);
  const text = textOf(result);
  expect(() => JSON.parse(text), `zod rejection must not look like a JSON envelope: ${text.slice(0, 160)}`).toThrow();
}

/**
 * Asserts a call was refused by a handler and returns the JSON error envelope.
 * @param {Record<string, unknown>} result - Raw tool result.
 * @returns {{ok: false, code: string, message: string, detail?: string}} The envelope.
 */
function expectErrorEnvelope(result: Record<string, unknown>): { ok: false; code: string; message: string; detail?: string } {
  expect(result.isError).toBe(true);
  const parsed = JSON.parse(textOf(result)) as { ok?: boolean; code?: string; message?: string; detail?: string };
  expect(parsed.ok, `expected an error envelope, got ${textOf(result).slice(0, 200)}`).toBe(false);
  expect(parsed.code).toBeTypeOf('string');
  return parsed as { ok: false; code: string; message: string; detail?: string };
}

/**
 * Asserts a call succeeded and returns the parsed payload.
 * @param {Record<string, unknown>} result - Raw tool result.
 * @returns {Record<string, unknown>} The parsed payload.
 */
function expectOkPayload(result: Record<string, unknown>): Record<string, unknown> {
  expect(result.isError, `expected success, got ${textOf(result).slice(0, 300)}`).toBeFalsy();
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

/**
 * Creates a real file so tools pass their `fs.existsSync` guard and reach the
 * planner, where the interesting validation lives.
 * @returns {string} Absolute path to a throwaway media file.
 */
function tempMediaFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-hostile-'));
  const file = path.join(dir, 'clip.mp4');
  fs.writeFileSync(file, 'not really a video');
  return file;
}

/** Probed streams: video + audio only, so a subtitle request matches nothing. */
const NO_SUBTITLES: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264' },
  { index: 1, type: 'audio', codec: 'aac' },
];

describe('MCP hostile input', () => {
  describe('the zod boundary', () => {
    it('rejects a missing, empty, or wrong-typed required input', async () => {
      const session = await setup();
      try {
        for (const args of [{}, { input: '' }, { input: 42 }, { input: ['a'] }, { input: null }]) {
          expectSchemaRejection(await callTool(session, 'convert_media', args));
        }
      } finally {
        await session.close();
      }
    });

    it('rejects wrong-typed and out-of-range optional fields', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        expectSchemaRejection(await callTool(session, 'convert_media', { input, qscale: '23' }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, qscale: 23.5 }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, rotate: '45' }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, copy: 'yes' }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, transcoder: 'NOPE' }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, concurrency: 99 }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, concurrency: 0 }));
      } finally {
        await session.close();
      }
    });

    it('caps filter arrays before the planner ever sees them', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        expectSchemaRejection(
          await callTool(session, 'convert_media', { input, videoFilters: Array.from({ length: 9 }, (_, i) => `fps=${i}`) }),
        );
        expectSchemaRejection(await callTool(session, 'convert_media', { input, videoFilters: [''] }));
        expectSchemaRejection(await callTool(session, 'convert_media', { input, presets: [''] }));
      } finally {
        await session.close();
      }
    });

    it('rejects empty collections and ids', async () => {
      const session = await setup();
      try {
        expectSchemaRejection(await callTool(session, 'batch_convert', { inputs: [] }));
        expectSchemaRejection(await callTool(session, 'get_job', { jobId: '' }));
        expectSchemaRejection(await callTool(session, 'cancel_job', { jobId: '' }));
        expectSchemaRejection(await callTool(session, 'get_profile', { profileId: '' }));
      } finally {
        await session.close();
      }
    });

    it('rejects an unknown tool name', async () => {
      const session = await setup();
      try {
        const result = await callTool(session, 'no_such_tool', {});
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain('no_such_tool');
      } finally {
        await session.close();
      }
    });

    it('rejects arguments that are not a record', async () => {
      const session = await setup();
      try {
        for (const args of ['notanobject', ['x'], null, 7]) {
          await expect(
            session.client.callTool({ name: 'convert_media', arguments: args as unknown as Record<string, unknown> }),
            `arguments ${JSON.stringify(args)} must be refused`,
          ).rejects.toThrow(McpError);
        }
      } finally {
        await session.close();
      }
    });

    it('strips an unknown extra key instead of forwarding or crashing on it', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const payload = await expectOkPayload(await callTool(session, 'convert_media', { input, totallyUnexpected: { nested: true } }));
        expect(payload.jobId).toBeTypeOf('string');
        expect(payload).not.toHaveProperty('totallyUnexpected');
      } finally {
        await session.close();
      }
    });
  });

  describe('prototype pollution', () => {
    it('does not pollute Object.prototype from a __proto__ argument key', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const hostile = JSON.parse(`{"input":${JSON.stringify(input)},"__proto__":{"polluted":true}}`) as Record<string, unknown>;
        await callTool(session, 'convert_media', hostile);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.prototype).not.toHaveProperty('polluted');
      } finally {
        await session.close();
      }
    });

    it('does not treat __proto__ or constructor as a job id lookup', async () => {
      const session = await setup();
      try {
        for (const jobId of ['__proto__', 'constructor', 'toString', 'prototype']) {
          const envelope = expectErrorEnvelope(await callTool(session, 'get_job', { jobId }));
          expect(envelope.code, `lookup of ${jobId} must miss, not resolve`).toBe('UNKNOWN');
          expect(envelope.message).toBe(`Job not found: ${jobId}`);

          const cancelled = expectErrorEnvelope(await callTool(session, 'cancel_job', { jobId }));
          expect(cancelled.message).toBe(`Job not found: ${jobId}`);
        }
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      } finally {
        await session.close();
      }
    });
  });

  describe('path traversal in tool arguments', () => {
    it('reports a missing traversal input as FILE_NOT_FOUND rather than crashing', async () => {
      const session = await setup();
      try {
        // `/etc/shadow` cannot be used as the absolute-path case: it exists on the Linux CI
        // runner, so the existsSync guard passes and the call succeeds instead of erroring.
        // A path inside a freshly made temp dir is missing by construction on every host.
        const missingAbsolute = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-hostile-missing-')), 'shadow.mp4');
        // A bare `../../etc/passwd` is only missing while the suite runs from a directory at
        // least three levels below the filesystem root; from a shallow working directory it
        // resolves to a real file. Traversing to a leaf name that exists nowhere keeps the
        // input hostile-looking and absent at any cwd depth.
        const traversal = path.join('..', '..', 'etc', 'encodex-missing-input');
        for (const input of [traversal, '..\\..\\Windows\\System32\\cmd.exe', missingAbsolute, '\\\\server\\share\\clip.mp4']) {
          const envelope = expectErrorEnvelope(await callTool(session, 'convert_media', { input }));
          expect(envelope.code, `input ${input}`).toBe('FILE_NOT_FOUND');
          expect(envelope.message).toContain(input);
        }
        expect(session.transcoders).toHaveLength(0);
      } finally {
        await session.close();
      }
    });

    it('keeps a traversal batch suffix inside the input directory', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const dir = path.dirname(input);
        const payload = await expectOkPayload(await callTool(session, 'batch_convert', { inputs: [input], suffix: '/../../evil' }));
        const jobs = payload.jobs as Array<{ output: string }>;
        expect(jobs).toHaveLength(1);
        expect(path.dirname(jobs[0]!.output), `output ${jobs[0]!.output} escaped`).toBe(dir);
        expect(path.basename(jobs[0]!.output)).toBe('evil.mkv');
      } finally {
        await session.close();
      }
    });

    it('keeps a traversal compress format inside the input directory', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const payload = await expectOkPayload(await callTool(session, 'compress_image', { input, format: '../../evil' }));
        expect(path.dirname(payload.output as string)).toBe(path.dirname(input));
        expect(path.basename(payload.output as string)).toBe('evil');
      } finally {
        await session.close();
      }
    });

    it('resolves a traversal batch outputDir against the cwd, not the input directory', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const payload = await expectOkPayload(await callTool(session, 'batch_convert', { inputs: [input], outputDir: '..' }));
        const jobs = payload.jobs as Array<{ output: string }>;
        expect(path.dirname(jobs[0]!.output)).not.toBe(path.dirname(input));
        expect(path.dirname(jobs[0]!.output)).toBe(path.resolve('..'));
      } finally {
        await session.close();
      }
    });
  });

  describe('shell metacharacters in filter chains', () => {
    const hostile: Array<[string, string]> = [
      ['a command separator', 'fps=30;id'],
      ['a pipe', 'fps=30|id'],
      ['a subshell', 'fps=$(id)'],
      ['a backtick', 'fps=`id`'],
      ['a variable expansion', 'a$b'],
      ['an unmatched quote', "fps='30"],
      ['unbalanced parens', 'scale(iw'],
      ['an over-long entry', `x${'y'.repeat(300)}`],
    ];

    it('refuses every hostile entry with INVALID_VIDEO_FILTERS', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        for (const [label, chain] of hostile) {
          const envelope = expectErrorEnvelope(await callTool(session, 'convert_media', { input, videoFilters: [chain] }));
          expect(envelope.code, label).toBe('INVALID_VIDEO_FILTERS');
          expect(envelope.detail, label).toContain('Invalid video filter chain');
        }
        expect(session.transcoders).toHaveLength(0);
      } finally {
        await session.close();
      }
    });

    it('refuses an unknown preset by name', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const envelope = expectErrorEnvelope(await callTool(session, 'convert_media', { input, presets: ['nope'] }));
        expect(envelope.code).toBe('INVALID_VIDEO_FILTERS');
        expect(envelope.detail).toBe('Unknown video filter preset: nope.');
        expect(session.transcoders).toHaveLength(0);
      } finally {
        await session.close();
      }
    });

    it('refuses filters combined with a lossless copy', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const envelope = expectErrorEnvelope(await callTool(session, 'convert_media', { input, copy: true, videoFilters: ['fps=30'] }));
        expect(envelope.code).toBe('FILTERS_REQUIRE_RE_ENCODE');
        expect(envelope.detail).toBeUndefined();
        expect(session.transcoders).toHaveLength(0);
      } finally {
        await session.close();
      }
    });
  });

  describe('container and stream refusals', () => {
    it('refuses a chapters file for a container that cannot store chapters', async () => {
      const session = await setup({ streams: NO_SUBTITLES });
      try {
        const input = tempMediaFile();
        const chapters = path.join(path.dirname(input), 'chapters.txt');
        fs.writeFileSync(chapters, 'CHAPTER01');
        const envelope = expectErrorEnvelope(
          await callTool(session, 'remux_media', { input, container: 'ts', chapters: { file: chapters } }),
        );
        expect(envelope.code).toBe('INCOMPATIBLE_CONTAINER');
        expect(envelope.message).toContain('does not store chapters');
      } finally {
        await session.close();
      }
    });

    it('refuses cover art for a container that cannot store it', async () => {
      const session = await setup({ streams: NO_SUBTITLES });
      try {
        const input = tempMediaFile();
        const art = path.join(path.dirname(input), 'cover.jpg');
        fs.writeFileSync(art, 'jpg');
        const envelope = expectErrorEnvelope(await callTool(session, 'remux_media', { input, container: 'avi', thumbnail: { file: art } }));
        expect(envelope.code).toBe('INCOMPATIBLE_CONTAINER');
        expect(envelope.message).toContain('cannot store cover art');
      } finally {
        await session.close();
      }
    });

    it('refuses an unknown container by name', async () => {
      const session = await setup({ streams: NO_SUBTITLES });
      try {
        const input = tempMediaFile();
        const envelope = expectErrorEnvelope(await callTool(session, 'remux_media', { input, container: '; rm -rf /' }));
        expect(envelope.code).toBe('INCOMPATIBLE_CONTAINER');
      } finally {
        await session.close();
      }
    });

    it('refuses a missing auxiliary file before enqueueing anything', async () => {
      const session = await setup({ streams: NO_SUBTITLES });
      try {
        const input = tempMediaFile();
        const missing = path.join(path.dirname(input), '../../evil.srt');
        const envelope = expectErrorEnvelope(
          await callTool(session, 'remux_media', { input, container: 'mkv', addSubtitle: [{ file: missing }] }),
        );
        expect(envelope.code).toBe('AUXILIARY_INPUT_NOT_FOUND');
        expect(envelope.message).toContain('Auxiliary input file not found');
        expect(session.transcoders).toHaveLength(0);
      } finally {
        await session.close();
      }
    });

    it('refuses a demux whose requested stream kind is absent', async () => {
      const session = await setup({ streams: NO_SUBTITLES });
      try {
        const input = tempMediaFile();
        const envelope = expectErrorEnvelope(await callTool(session, 'demux_media', { input, subtitles: true }));
        expect(envelope.code).toBe('STREAM_NOT_FOUND');
        expect(envelope.message).toContain('No subtitle streams');
      } finally {
        await session.close();
      }
    });

    it('refuses a batch whose glob matches nothing', async () => {
      const session = await setup();
      try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-hostile-glob-'));
        const subdir = path.join(dir, 'sub');
        fs.mkdirSync(subdir);
        fs.writeFileSync(path.join(subdir, 'clip.mp4'), 'not really a video');
        const envelope = expectErrorEnvelope(await callTool(session, 'batch_convert', { inputs: [`${dir}/**/*.does-not-exist`] }));
        expect(envelope.code).toBe('FILE_NOT_FOUND');
        expect(envelope.message).toContain('No input files matched');
      } finally {
        await session.close();
      }
    });
  });

  describe('job id hostility', () => {
    it('answers an unknown job id with a named envelope instead of throwing', async () => {
      const session = await setup();
      try {
        for (const jobId of ['nope', 'missing-job', '00000000-0000-0000-0000-000000000000']) {
          const envelope = expectErrorEnvelope(await callTool(session, 'get_job', { jobId }));
          expect(envelope.code).toBe('UNKNOWN');
          expect(envelope.message).toBe(`Job not found: ${jobId}`);
        }
      } finally {
        await session.close();
      }
    });

    it('reports an unknown profile id with a named envelope', async () => {
      const session = await setup();
      try {
        const envelope = expectErrorEnvelope(await callTool(session, 'get_profile', { profileId: 'no-such-profile' }));
        expect(envelope.code).toBe('UNKNOWN');
        expect(envelope.message).toBe('Profile not found: no-such-profile');
      } finally {
        await session.close();
      }
    });

    it('round-trips a real job so a miss means a miss, not a broken queue', async () => {
      const session = await setup();
      try {
        const input = tempMediaFile();
        const queued = await expectOkPayload(await callTool(session, 'convert_media', { input }));
        const jobId = queued.jobId as string;
        expect(expectOkPayload(await callTool(session, 'get_job', { jobId })).id).toBe(jobId);
        expect(expectOkPayload(await callTool(session, 'cancel_job', { jobId })).cancelled).toBe(true);
        expect(expectErrorEnvelope(await callTool(session, 'get_job', { jobId })).message).toBe(`Job not found: ${jobId}`);
      } finally {
        await session.close();
      }
    });
  });

  describe('MCPJobManager under hostile input', () => {
    it('clamps a hostile constructor concurrency instead of trusting it', () => {
      // Six jobs against a transcoder that never finishes: however many slots the
      // caller asked for, at most MAX_QUEUE_CONCURRENCY can be running at once.
      // `Infinity`/`NaN`/`1e9` must all land on the cap, `0`/`-5` on one.
      const running = (concurrency: number): number => {
        const manager = new MCPJobManager({ concurrency, transcoderFactory: () => new FakeTranscoder({ hang: true }) });
        for (let i = 0; i < 6; i++) manager.enqueue(`in-${i}`, `out-${i}`, {});
        return manager.listJobs().filter((job) => job.status === 'running').length;
      };

      expect(running(Infinity)).toBe(4);
      expect(running(1e9)).toBe(4);
      expect(running(NaN)).toBe(1);
      expect(running(-5)).toBe(1);
      expect(running(0)).toBe(1);
    });

    it('refuses a hostile id at the manager boundary', () => {
      const manager = new MCPJobManager({ transcoderFactory: () => new FakeTranscoder({ hang: true }) });
      for (const id of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
        expect(manager.getJob(id), `getJob(${id})`).toBeUndefined();
        expect(manager.cancelJob(id), `cancelJob(${id})`).toBe(false);
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('answers hostile ids without ever walking the prototype chain', () => {
      const manager = new MCPJobManager();
      for (const id of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
        expect(manager.getJob(id), `getJob(${id})`).toBeUndefined();
        expect(manager.cancelJob(id), `cancelJob(${id})`).toBe(false);
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('stays bounded across 1,000 rapid enqueue/cancel cycles', () => {
      const manager = new MCPJobManager({ transcoderFactory: () => new FakeTranscoder({ hang: true }) });
      for (let i = 0; i < 1_000; i++) {
        const job = manager.enqueue(`in-${i}`, `out-${i}`, {});
        expect(manager.cancelJob(job.id), `cycle ${i} must cancel`).toBe(true);
        expect(manager.cancelJob(job.id), `cycle ${i} must not double-free`).toBe(false);
      }
      expect(manager.listJobs(), 'cancelled jobs must leave the queue').toHaveLength(0);
      expect(manager.pendingCount()).toBe(0);
    });
  });
});
