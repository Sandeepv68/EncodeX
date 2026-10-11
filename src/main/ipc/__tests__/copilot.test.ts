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

const { ipcMainMock, transcoderFactoryMock, capabilitiesMock, getHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
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
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));
vi.mock('../../transcoders/factory', () => transcoderFactoryMock);
vi.mock('../../capabilities', () => capabilitiesMock);

const { registerCopilotHandlers } = await import('../copilot');
import { IPC } from '../../../shared/ipc-channels';
import { ErrorCode } from '../../../shared/errors';

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
    capabilitiesMock.getEncoderCapabilities.mockReturnValue({
      videoEncoders: ['libx264', 'libx265', 'libvpx-vp9'],
      audioEncoders: ['aac', 'libmp3lame', 'opus'],
      hwaccels: ['none', 'vaapi', 'nvenc'],
    });
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
});
