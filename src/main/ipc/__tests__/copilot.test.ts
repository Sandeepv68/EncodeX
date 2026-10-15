/**
 * @fileoverview Tests for the Copilot plan IPC handler (roadmap 7.4, R6).
 *
 * The handler scans a folder, probes every media file through the transcoder
 * factory, plans one conversion per file with the *real* deterministic agent,
 * maps each action to its ready-to-enqueue `ConversionOptions`, and dry-runs
 * the workflow. Only the outside world is faked: the transcoder factory and
 * the encoder-capability probe. The filesystem and the agent layer are real.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { MediaInfo } from '../../../shared/types';
import type { CopilotPlan } from '../../../shared/copilot';
import type { MCPConversionFields } from '../../../mcp/conversion-options';

const {
  ipcMainMock,
  transcoderFactoryMock,
  capabilitiesMock,
  getHandlers,
  buildConversionOptionsMock,
  conversionOptionsRef,
  fsRef,
  readdirSyncMock,
  statSyncMock,
  realFs,
} = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  // Node builtins are pulled in through `createRequire` so the sync `vi.mock`
  // factory can spread the real module while overriding two exports below.
  const { createRequire } = require('module') as typeof import('module');
  const realFs = createRequire(import.meta.url)('fs') as typeof import('fs');
  const readdirSyncMock = vi.fn((...args: unknown[]) => (realFs.readdirSync as (...a: unknown[]) => unknown)(...args));
  const statSyncMock = vi.fn((...args: unknown[]) => (realFs.statSync as (...a: unknown[]) => unknown)(...args));
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    transcoderFactoryMock: {
      createTranscoder: vi.fn(),
    },
    capabilitiesMock: {
      getEncoderCapabilities: vi.fn(),
    },
    buildConversionOptionsMock: vi.fn(),
    conversionOptionsRef: { current: undefined as undefined | typeof import('../../../mcp/conversion-options') },
    fsRef: {
      readdirSync: realFs.readdirSync,
      statSync: realFs.statSync,
    },
    readdirSyncMock,
    statSyncMock,
    realFs,
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));
vi.mock('../../transcoders/factory', () => transcoderFactoryMock);
vi.mock('../../capabilities', () => capabilitiesMock);
// The provider resolver and the intelligence builder are stubbed so the LLM
// routing branch and the media-intelligence note can be exercised without a
// configured provider or a real whisper/ffmpeg engine.
const { providerRegistryMock, intelligenceMock } = vi.hoisted(() => ({
  providerRegistryMock: { resolveLLMOperationRouter: vi.fn() },
  intelligenceMock: { buildIntelligenceResults: vi.fn() },
}));
vi.mock('../../ai/provider-registry', () => providerRegistryMock);
vi.mock('../../ai/intelligence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ai/intelligence')>();
  return { ...actual, buildIntelligenceResults: intelligenceMock.buildIntelligenceResults };
});
// The happy path still runs through the real option builder; the mock only
// exists so a single test can force one action to fail option conversion and
// exercise the pipeline's per-action drop-and-record path.
vi.mock('../../../mcp/conversion-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../mcp/conversion-options')>();
  conversionOptionsRef.current = actual;
  return { ...actual, buildConversionOptions: buildConversionOptionsMock };
});
// `readdirSync`/`statSync` are mocked so two hostile-filesystem cases can force
// an unreadable directory and an unreadable child without depending on OS
// permissions. Everything delegates to the real function, so every other call
// behaves exactly as before. The overrides are repeated on `default` because
// the source module's named `fs` imports are interop-resolved from `default`.
vi.mock('fs', () => ({
  ...realFs,
  readdirSync: readdirSyncMock,
  statSync: statSyncMock,
  default: { ...realFs, readdirSync: readdirSyncMock, statSync: statSyncMock },
}));

const { registerCopilotHandlers } = await import('../copilot');
import { IPC } from '../../../shared/ipc-channels';
import { ErrorCode } from '../../../shared/errors';
import * as sharedAi from '../../../shared/ai';

/** Root temp directory for the media scanned by the handler. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-copilot-'));

/** Media files (and a decoy) living in the scan folder. */
const MEDIA = ['one.mp4', 'two.mkv', 'readme.txt'];

/** A minimal MediaInfo for a real video, mirroring the MCP-probe contract. */
function videoInfo(file: string): MediaInfo {
  return {
    file,
    format: 'mov,mp4,m4a,3gp,3g2,mj2',
    size: 2_000_000,
    duration: 120,
    bitrate: '2000k',
    streams: [],
  };
}

/** Creates the named entries in a fresh subfolder and returns its path. */
function makeFolder(files: string[]): string {
  const dir = fs.mkdtempSync(path.join(tempDir, 'library-'));
  for (const name of files) fs.writeFileSync(path.join(dir, name), 'stub');
  return dir;
}

/** Invokes the Copilot plan handler with the given request. */
function plan(request: Record<string, unknown>): Promise<CopilotPlan> {
  return getHandlers()[IPC.COPILOT_PLAN]({}, request) as Promise<CopilotPlan>;
}

describe('registerCopilotHandlers', () => {
  let scanDir: string;

  beforeAll(() => {
    scanDir = makeFolder(MEDIA);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // `vi.restoreAllMocks()` in afterEach wipes the factory-set implementations,
    // so re-apply the real builders here before every test.
    buildConversionOptionsMock.mockImplementation((fields: unknown) =>
      conversionOptionsRef.current!.buildConversionOptions(fields as MCPConversionFields),
    );
    readdirSyncMock.mockImplementation(fsRef.readdirSync as never);
    statSyncMock.mockImplementation(fsRef.statSync as never);
    capabilitiesMock.getEncoderCapabilities.mockReturnValue({
      videoEncoders: ['libx264', 'libx265', 'libvpx-vp9'],
      audioEncoders: ['aac', 'libmp3lame', 'opus'],
      hwaccels: ['none', 'vaapi', 'nvenc'],
    });
    providerRegistryMock.resolveLLMOperationRouter.mockReturnValue(null);
    intelligenceMock.buildIntelligenceResults.mockResolvedValue({ actions: [], results: [], skips: [] });
    transcoderFactoryMock.createTranscoder.mockImplementation(() => ({
      getInfo: (input: string) => Promise.resolve(videoInfo(input)),
    }));
    registerCopilotHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the COPILOT_PLAN channel', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.COPILOT_PLAN, expect.any(Function));
  });

  it('plans the media in a folder and maps actions to enqueue-able options', async () => {
    const result = await plan({ goal: 'compress for web', inputs: [scanDir], recursive: true });
    expect(result.actions).toHaveLength(2);
    expect(result.actions.map((a) => a.input).sort()).toEqual([path.join(scanDir, 'one.mp4'), path.join(scanDir, 'two.mkv')]);
    for (const action of result.actions) {
      expect(action.output).toMatch(/_optimized(?:_\d+)?\.(mp4|mkv)$/);
      expect(action.options).toBeTypeOf('object');
      expect(action.confidence).toBeGreaterThanOrEqual(0);
      expect(action.confidence).toBeLessThanOrEqual(1);
    }
    expect(result.plan.valid).toBe(true);
    expect(result.plan.steps).toHaveLength(2);
    expect(result.isEstimated).toBe(true);
    // The decoy matches no extension and must never become an action.
    expect(result.actions.some((a) => a.input.endsWith('readme.txt'))).toBe(false);
  });

  it('rejects when the goal is missing or not a string', async () => {
    for (const request of [{ inputs: [scanDir] }, { goal: '', inputs: [scanDir] }, { goal: 42, inputs: [scanDir] }, undefined]) {
      await expect(getHandlers()[IPC.COPILOT_PLAN]({}, request)).rejects.toMatchObject({ code: ErrorCode.INPUT_NOT_SPECIFIED });
    }
  });

  it('rejects when no inputs are provided', async () => {
    await expect(getHandlers()[IPC.COPILOT_PLAN]({}, { goal: 'compress', inputs: [] })).rejects.toMatchObject({
      code: ErrorCode.INPUT_NOT_SPECIFIED,
    });
  });

  it('rejects when nothing in the inputs is a media file', async () => {
    await expect(
      getHandlers()[IPC.COPILOT_PLAN]({}, { goal: 'compress', inputs: [path.join(scanDir, 'readme.txt')] }),
    ).rejects.toMatchObject({ code: ErrorCode.FILE_NOT_FOUND });
  });

  it('survives a transcoder probe failure by skipping the unreadable file', async () => {
    transcoderFactoryMock.createTranscoder.mockImplementation(() => ({
      getInfo: (input: string) =>
        input.endsWith('two.mkv') ? Promise.reject(new Error('probe failed')) : Promise.resolve(videoInfo(input)),
    }));
    const result = await plan({ goal: 'compress for web', inputs: [scanDir] });
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].input.endsWith('one.mp4')).toBe(true);
  });

  it('rejects with PROBE_FAILED when no file can be read', async () => {
    transcoderFactoryMock.createTranscoder.mockImplementation(() => ({
      getInfo: () => Promise.reject(new Error('probe failed')),
    }));
    await expect(plan({ goal: 'compress', inputs: [scanDir] })).rejects.toMatchObject({ code: ErrorCode.PROBE_FAILED });
  });

  it('fails cleanly when the input path does not exist', async () => {
    await expect(plan({ goal: 'compress', inputs: [path.join(tempDir, 'missing')] })).rejects.toMatchObject({
      code: ErrorCode.FILE_NOT_FOUND,
    });
  });

  it('recurses into subdirectories when the request asks for it', async () => {
    const root = makeFolder([]);
    const nested = fs.mkdtempSync(path.join(root, 'nested-'));
    fs.writeFileSync(path.join(nested, 'deep.mp4'), 'stub');
    const result = await plan({ goal: 'compress for web', inputs: [root], recursive: true });
    expect(result.actions.map((a) => path.basename(a.input))).toContain('deep.mp4');
  });

  it('accepts a media file path directly instead of a folder', async () => {
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'compress', inputs: [file] });
    expect(result.actions[0].input).toBe(file);
  });

  it('routes a forced analyze to read-only results, not actions', async () => {
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'inspect this file', inputs: [file], operation: 'analyze' });
    expect(result.operation).toBe('analyze');
    expect(result.providerId).toBe('rules');
    expect(result.actions).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ operation: 'analyze', input: file });
  });

  it('routes a forced non-convert operation into a queue-able action', async () => {
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'remux to mkv', inputs: [file], operation: 'remux' });
    expect(result.operation).toBe('remux');
    expect(result.providerId).toBe('rules');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ operation: 'remux', input: file });
    expect(result.actions[0].output?.endsWith('.mkv')).toBe(true);
  });

  it('skips a folder that cannot be read instead of failing the plan', async () => {
    readdirSyncMock.mockImplementation(((dir: fs.PathLike) => {
      if (String(dir) === scanDir) throw new Error('EACCES');
      return fsRef.readdirSync!(dir);
    }) as never);
    await expect(plan({ goal: 'compress', inputs: [scanDir] })).rejects.toMatchObject({ code: ErrorCode.FILE_NOT_FOUND });
  });

  it('skips a child entry whose stat fails instead of aborting the scan', async () => {
    const root = makeFolder(['one.mp4', 'two.mkv']);
    statSyncMock.mockImplementation(((p: fs.PathLike) => {
      if (String(p).endsWith('two.mkv')) throw new Error('EACCES');
      return fsRef.statSync!(p);
    }) as never);
    const result = await plan({ goal: 'compress', inputs: [root] });
    expect(result.actions.map((a) => a.input)).toEqual([path.join(root, 'one.mp4')]);
  });

  it('drops an action whose options cannot be built and records it as a skip', async () => {
    buildConversionOptionsMock.mockImplementationOnce(() => {
      throw new Error('bad options');
    });
    const result = await plan({ goal: 'compress for web', inputs: [scanDir] });
    expect(result.actions).toHaveLength(1);
    expect(result.skips.some((s) => s.reason.includes('could not be turned into conversion options'))).toBe(true);
  });

  it('routes through the configured AI provider when a router is available', async () => {
    providerRegistryMock.resolveLLMOperationRouter.mockReturnValue(
      vi.fn().mockResolvedValue({
        operation: 'analyze',
        fields: {},
        rationale: ['chosen by the model'],
        confidence: 0.9,
        providerId: 'openai',
      }),
    );
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'do something vague', inputs: [file] });
    expect(result.operation).toBe('analyze');
    expect(result.providerId).toBe('openai');
    expect(result.results).toHaveLength(1);
  });

  it('falls back to the deterministic router when the provider yields nothing', async () => {
    providerRegistryMock.resolveLLMOperationRouter.mockReturnValue(vi.fn().mockResolvedValue(undefined));
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'remux to mkv', inputs: [file] });
    expect(result.operation).toBe('remux');
    expect(result.providerId).toBe('rules');
  });

  it('forwards an explicit target language and flags intelligence results as read-only', async () => {
    intelligenceMock.buildIntelligenceResults.mockResolvedValue({
      actions: [],
      results: [{ operation: 'translate', input: '/in/one.mp4', title: 'ES subtitles', summary: 'translated', content: {} }],
      skips: [],
    });
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'translate', inputs: [file], operation: 'translate', targetLanguage: 'es' });
    expect(intelligenceMock.buildIntelligenceResults).toHaveBeenCalledWith(
      'translate',
      expect.objectContaining({ targetLanguage: 'es' }),
      expect.anything(),
    );
    expect(result.notes).toContain('Media-intelligence results are read-only and were not added to the queue.');
  });

  it('caps the scanned files at the default maximum', async () => {
    const names = Array.from({ length: 55 }, (_, i) => `clip-${String(i).padStart(3, '0')}.mp4`);
    const big = makeFolder(names);
    const result = await plan({ goal: 'compress for web', inputs: [big] });
    expect(result.actions).toHaveLength(50);
  });

  it('honors a smaller maxFiles bound', async () => {
    const result = await plan({ goal: 'compress for web', inputs: [scanDir], maxFiles: 2 });
    expect(result.actions).toHaveLength(2);
  });

  it('treats a zero or missing maxFiles as the default', async () => {
    for (const maxFiles of [0, undefined]) {
      const result = await plan({ goal: 'compress for web', inputs: [scanDir], maxFiles });
      expect(result.actions).toHaveLength(2);
    }
  });

  it('clamps a negative maxFiles to at least one', async () => {
    const result = await plan({ goal: 'compress for web', inputs: [scanDir], maxFiles: -5 });
    expect(result.actions).toHaveLength(1);
  });

  it('falls back to the default maxFiles when the value is not numeric', async () => {
    const result = await plan({ goal: 'compress for web', inputs: [scanDir], maxFiles: 'not-a-number' });
    expect(result.actions.length).toBeGreaterThanOrEqual(2);
  });

  it('does not recurse into subdirectories unless explicitly asked', async () => {
    const root = makeFolder(['top.mp4']);
    const nested = fs.mkdtempSync(path.join(root, 'nested-'));
    fs.writeFileSync(path.join(nested, 'deep.mp4'), 'stub');
    const result = await plan({ goal: 'compress for web', inputs: [root] });
    const inputs = result.actions.map((a) => path.basename(a.input));
    expect(inputs).toContain('top.mp4');
    expect(inputs).not.toContain('deep.mp4');
  });

  it('treats an explicit "auto" operation as unforced and consults the provider resolver', async () => {
    const file = path.join(scanDir, 'one.mp4');
    const result = await plan({ goal: 'remux to mkv', inputs: [file], operation: 'auto' });
    expect(providerRegistryMock.resolveLLMOperationRouter).toHaveBeenCalled();
    expect(result.operation).toBe('remux');
    expect(result.providerId).toBe('rules');
  });

  it('forwards an explicit search phrase into the intelligence builder', async () => {
    const file = path.join(scanDir, 'one.mp4');
    await plan({ goal: 'find the pricing bit', inputs: [file], operation: 'search_transcript', query: 'pricing' });
    expect(intelligenceMock.buildIntelligenceResults).toHaveBeenCalledWith(
      'search_transcript',
      expect.objectContaining({ query: 'pricing' }),
      expect.anything(),
    );
  });

  it('records the operation-run note and the analyze read-only note', async () => {
    const file = path.join(scanDir, 'one.mp4');
    const analyze = await plan({ goal: 'inspect this file', inputs: [file], operation: 'analyze' });
    expect(analyze.notes).toContain('Ran the "analyze" operation for 1 file(s).');
    expect(analyze.notes).toContain('Analysis results are read-only and were not added to the queue.');

    const remux = await plan({ goal: 'remux to mkv', inputs: [file], operation: 'remux' });
    expect(remux.notes).toContain('Ran the "remux" operation for 1 file(s).');
    expect(remux.notes).toContain('Operation chosen by "rules".');
  });

  it('stamps the provider note and concatenates rationale for a convert plan', async () => {
    const result = await plan({ goal: 'compress for web', inputs: [scanDir] });
    expect(result.operation).toBe('convert');
    expect(result.notes).toContain('Operation chosen by "rules".');
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('falls back to empty capabilities when the encoder probe returns null', async () => {
    capabilitiesMock.getEncoderCapabilities.mockReturnValue(null);
    const result = await plan({ goal: 'compress for web', inputs: [scanDir] });
    expect(result.actions).toHaveLength(2);
  });

  it('accepts an image file for the compress_image operation', async () => {
    const imageDir = makeFolder(['photo.jpg']);
    const result = await plan({
      goal: 'shrink this image',
      inputs: [path.join(imageDir, 'photo.jpg')],
      operation: 'compress_image',
    });
    expect(result.operation).toBe('compress_image');
    expect(result.actions[0].input.endsWith('photo.jpg')).toBe(true);
  });

  it('forwards minSavings to the planning agent when provided', async () => {
    const spy = vi.spyOn(sharedAi, 'planAgent');
    const file = path.join(scanDir, 'one.mp4');
    await plan({ goal: 'compress for web', inputs: [file], minSavings: 0.5 });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ minSavings: 0.5 }) }));
  });

  it('omits minSavings from the agent options when it is not provided', async () => {
    const spy = vi.spyOn(sharedAi, 'planAgent');
    const file = path.join(scanDir, 'one.mp4');
    await plan({ goal: 'compress for web', inputs: [file] });
    const call = spy.mock.calls[0][0] as unknown as { options: Record<string, unknown> };
    expect(call.options).not.toHaveProperty('minSavings');
  });
});
