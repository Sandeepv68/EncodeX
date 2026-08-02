import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { spawnMock, execSyncMock, suspendProcessMock, resumeProcessMock, buildFfmpegArgsMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  execSyncMock: vi.fn(),
  suspendProcessMock: vi.fn(),
  resumeProcessMock: vi.fn(),
  buildFfmpegArgsMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  execSync: execSyncMock,
  ChildProcess: class {},
  default: { spawn: spawnMock, execSync: execSyncMock },
}));
vi.mock('../../process-utils', () => ({ suspendProcess: suspendProcessMock, resumeProcess: resumeProcessMock }));
vi.mock('../ffmpeg-utils', () => ({ buildFfmpegArgs: buildFfmpegArgsMock }));

const { BmfCore } = await import('../bmf-core');

type FakeProc = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; pid: number; kill: ReturnType<typeof vi.fn> };

function getProc(): FakeProc {
  return spawnMock.mock.results[spawnMock.mock.results.length - 1].value as FakeProc;
}

function createFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 1234;
  proc.kill = vi.fn();
  return proc;
}

describe('BmfCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockImplementation(() => createFakeProc());
    buildFfmpegArgsMock.mockReturnValue(['-i', 'in.mp4', '-y', 'out.mp4']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns its type', () => {
    expect(new BmfCore().getType()).toBe('BMF');
  });

  it('getInfo runs bmf_ffprobe and resolves parsed data', async () => {
    execSyncMock.mockReturnValue(JSON.stringify({ format: { duration: '5', format_name: 'mp4' }, streams: [] }));
    const core = new BmfCore();
    const info = await core.getInfo('in.mp4');
    expect(execSyncMock).toHaveBeenCalledWith(expect.stringContaining('bmf_ffprobe'), expect.objectContaining({ timeout: 30000 }));
    expect(execSyncMock).toHaveBeenCalledWith(expect.stringContaining('in.mp4'), expect.any(Object));
    expect(info).toEqual(expect.objectContaining({ format: 'mp4', duration: 5 }));
  });

  it('getInfo rejects when bmf_ffprobe fails', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('command not found');
    });
    const core = new BmfCore();
    await expect(core.getInfo('in.mp4')).rejects.toThrow('BMF not available. Please ensure BMF CLI tools are installed.');
  });

  it('convert spawns bmf_ffmpeg and emits progress from stderr', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    expect(spawnMock).toHaveBeenCalledWith('bmf_ffmpeg', ['-i', 'in.mp4', '-y', 'out.mp4']);
    const progressListener = vi.fn();
    emitter.on('progress', progressListener);
    getProc().stderr.emit('data', Buffer.from('frame=  1 time=00:00:03.00'));
    expect(progressListener).toHaveBeenCalledWith(expect.objectContaining({ time: '00:00:03.00' }));
  });

  it('convert emits end on a zero exit code', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const endListener = vi.fn();
    emitter.on('end', endListener);
    getProc().emit('close', 0);
    expect(endListener).toHaveBeenCalled();
  });

  it('convert emits error on a non-zero exit code', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    getProc().stderr.emit('data', Buffer.from('some failure detail'));
    getProc().emit('close', 1);
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('BMF exited with code 1') }));
  });

  it('convert emits error on a process error', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    getProc().emit('error', new Error('bmf error'));
    expect(errorListener).toHaveBeenCalledWith(new Error('bmf error'));
  });

  it('convert emits a CANCELLED error after cancel', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);
    core.cancel();
    expect(getProc().kill).toHaveBeenCalledWith('SIGKILL');
    getProc().emit('error', new Error('killed'));
    expect(endListener).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCELLED' }));
  });

  it('convert emits a CANCELLED error when a cancelled process closes', () => {
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);
    core.cancel();
    getProc().emit('close', 1);
    expect(endListener).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCELLED' }));
  });

  it('convert reports a spawn failure on the emitter', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn boom');
    });
    const core = new BmfCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    await new Promise((resolve) => process.nextTick(resolve));
    expect(errorListener).toHaveBeenCalledWith(new Error('spawn boom'));
  });

  it('pause and resume use the child pid', () => {
    const core = new BmfCore();
    core.convert('in.mp4', 'out.mp4', {});
    core.pause();
    expect(suspendProcessMock).toHaveBeenCalledWith(1234);
    core.resume();
    expect(resumeProcessMock).toHaveBeenCalledWith(1234);
    core.cancel();
    suspendProcessMock.mockClear();
    core.pause();
    expect(suspendProcessMock).not.toHaveBeenCalled();
  });
});
