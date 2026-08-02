import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { spawnMock, suspendProcessMock, resumeProcessMock, getFfmpegPathMock, getFfprobePathMock, buildFfmpegArgsMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  suspendProcessMock: vi.fn(),
  resumeProcessMock: vi.fn(),
  getFfmpegPathMock: vi.fn(),
  getFfprobePathMock: vi.fn(),
  buildFfmpegArgsMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));
vi.mock('../../process-utils', () => ({ suspendProcess: suspendProcessMock, resumeProcess: resumeProcessMock }));
vi.mock('../ffmpeg-utils', () => ({
  getFfmpegPath: getFfmpegPathMock,
  getFfprobePath: getFfprobePathMock,
  buildFfmpegArgs: buildFfmpegArgsMock,
}));

const { FFToolCore } = await import('../fftool-core');

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

describe('FFToolCore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    spawnMock.mockImplementation(() => createFakeProc());
    getFfmpegPathMock.mockReturnValue('C:\\ffmpeg.exe');
    getFfprobePathMock.mockReturnValue('C:\\ffprobe.exe');
    buildFfmpegArgsMock.mockReturnValue(['-i', 'in.mp4', '-y', 'out.mp4']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns its type', () => {
    expect(new FFToolCore().getType()).toBe('FFTOOL');
  });

  it('getInfo spawns ffprobe and resolves parsed data', async () => {
    const core = new FFToolCore();
    const promise = core.getInfo('in.mp4');
    const proc = getProc();
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ format: { duration: '5', format_name: 'mp4' }, streams: [] })));
    proc.emit('close', 0);
    const info = await promise;
    expect(spawnMock).toHaveBeenCalledWith('C:\\ffprobe.exe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      'in.mp4',
    ]);
    expect(info).toEqual(expect.objectContaining({ format: 'mp4', duration: 5 }));
  });

  it('getInfo rejects when ffprobe spawn fails', async () => {
    const core = new FFToolCore();
    const promise = core.getInfo('in.mp4');
    getProc().emit('error', new Error('spawn failed'));
    await expect(promise).rejects.toThrow('spawn failed');
  });

  it('getInfo rejects when ffprobe exits with a non-zero code', async () => {
    const core = new FFToolCore();
    const promise = core.getInfo('in.mp4');
    getProc().emit('close', 1);
    await expect(promise).rejects.toThrow('ffprobe exited with code 1');
  });

  it('getInfo rejects when ffprobe output is not valid JSON', async () => {
    const core = new FFToolCore();
    const promise = core.getInfo('in.mp4');
    getProc().stdout.emit('data', Buffer.from('not json'));
    getProc().emit('close', 0);
    await expect(promise).rejects.toThrow();
  });

  it('convert emits progress from stderr timestamps and ends on close', async () => {
    const core = new FFToolCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    expect(spawnMock).toHaveBeenCalledWith('C:\\ffmpeg.exe', ['-i', 'in.mp4', '-y', 'out.mp4']);
    const progressListener = vi.fn();
    emitter.on('progress', progressListener);
    getProc().stderr.emit('data', Buffer.from('frame=  10 time=00:00:05.00'));
    await vi.advanceTimersByTimeAsync(500);
    expect(progressListener).toHaveBeenCalledWith(expect.objectContaining({ time: '00:00:05.00', speed: '10.0x' }));
    const endListener = vi.fn();
    emitter.on('end', endListener);
    getProc().emit('close', 0);
    expect(endListener).toHaveBeenCalled();
  });

  it('convert uses empty progress values before any timestamp', async () => {
    const core = new FFToolCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const progressListener = vi.fn();
    emitter.on('progress', progressListener);
    await vi.advanceTimersByTimeAsync(500);
    expect(progressListener).toHaveBeenCalledWith(expect.objectContaining({ time: '00:00:00', speed: '0x', percent: 0 }));
    getProc().emit('close', 0);
  });

  it('convert emits error on process error', () => {
    const core = new FFToolCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    getProc().emit('error', new Error('ffmpeg error'));
    expect(errorListener).toHaveBeenCalledWith(new Error('ffmpeg error'));
  });

  it('convert emits error on non-zero exit', () => {
    const core = new FFToolCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    getProc().emit('close', 1);
    expect(errorListener).toHaveBeenCalledWith(new Error('FFmpeg exited with code 1'));
  });

  it('convert emits a CANCELLED error after cancel', () => {
    const core = new FFToolCore();
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
    const core = new FFToolCore();
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

  it('pause and resume use the child pid', () => {
    const core = new FFToolCore();
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
