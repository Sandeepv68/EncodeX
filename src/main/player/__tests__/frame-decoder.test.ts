import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { DecodedFrame } from '../frame-decoder';

const { spawnMock, existsSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg\\bin\\ffmpeg.exe' }));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));

const { FrameDecoder } = await import('../frame-decoder');

function createFakeProcess(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; pid: number; kill: ReturnType<typeof vi.fn> } {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 1234;
  proc.kill = vi.fn();
  return proc;
}

describe('FrameDecoder', () => {
  let decoder: InstanceType<typeof FrameDecoder>;

  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => createFakeProcess());
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
    decoder = new FrameDecoder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the bundled ffmpeg static path when it exists', () => {
    existsSyncMock.mockReturnValue(true);
    decoder.open('in.mp4');
    expect(spawnMock).toHaveBeenCalledWith('C:\\ffmpeg\\bin\\ffmpeg.exe', expect.any(Array));
  });

  it('falls back to the system ffmpeg when the bundled binary is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    existsSyncMock.mockReturnValue(false);
    decoder.open('in.mp4');
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', expect.any(Array));
    warnSpy.mockRestore();
  });

  it('spawns ffmpeg with default resolution args', () => {
    decoder.open('in.mp4');
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual(['-re', '-i', 'in.mp4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '640x360', '-an', '-sn', '-dn', '-']);
  });

  it('spawns ffmpeg with the provided resolution', () => {
    decoder.open('in.mp4', 320, 240);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('320x240');
  });

  it('decodes raw frames from stdout in order', () => {
    const frames: Array<{ width: number; height: number; pts: number; buffer: Buffer }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stdout.emit('data', Buffer.alloc(24));
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ width: 2, height: 2, pts: 0 });
    expect(frames[1]).toMatchObject({ width: 2, height: 2, pts: 1 });
    expect(frames[0].buffer).toHaveLength(12);
  });

  it('buffers partial frames across chunks', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stdout.emit('data', Buffer.alloc(6));
    expect(frames).toHaveLength(0);
    proc.stdout.emit('data', Buffer.alloc(6));
    expect(frames).toHaveLength(1);
  });

  it('ignores stdout data after close', () => {
    const frames: unknown[] = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    decoder.close();
    proc.stdout.emit('data', Buffer.alloc(24));
    expect(frames).toHaveLength(0);
  });

  it('emits end when the process closes with code 0', () => {
    const events: string[] = [];
    decoder.on('end', () => events.push('end'));
    decoder.on('error', () => events.push('error'));
    decoder.open('in.mp4');
    const proc = spawnMock.mock.results[0].value;
    proc.emit('close', 0);
    expect(events).toEqual(['end']);
  });

  it('emits error and end when the process exits with a non-zero code', () => {
    const events: string[] = [];
    decoder.on('end', () => events.push('end'));
    decoder.on('error', () => events.push('error'));
    decoder.open('in.mp4');
    const proc = spawnMock.mock.results[0].value;
    proc.emit('close', 2);
    expect(events).toEqual(['error', 'end']);
  });

  it('emits only end when the process closes with a null code', () => {
    const events: string[] = [];
    decoder.on('end', () => events.push('end'));
    decoder.on('error', () => events.push('error'));
    decoder.open('in.mp4');
    const proc = spawnMock.mock.results[0].value;
    proc.emit('close', null);
    expect(events).toEqual(['end']);
  });

  it('forwards process errors', () => {
    const errorListener = vi.fn();
    decoder.on('error', errorListener);
    decoder.open('in.mp4');
    const proc = spawnMock.mock.results[0].value;
    const err = new Error('spawn failed');
    proc.emit('error', err);
    expect(errorListener).toHaveBeenCalledWith(err);
  });

  it('seeks by restarting ffmpeg with -ss and emits seek', () => {
    const seekListener = vi.fn();
    decoder.on('seek', seekListener);
    decoder.open('in.mp4');
    decoder.seek('00:00:05');
    expect(seekListener).toHaveBeenCalledWith('00:00:05');
    expect(spawnMock).toHaveBeenCalledTimes(2);
    const args = spawnMock.mock.calls[1][1] as string[];
    expect(args.slice(0, 2)).toEqual(['-ss', '00:00:05']);
  });

  it('emits seek even when no input is open', () => {
    const seekListener = vi.fn();
    decoder.on('seek', seekListener);
    decoder.seek('00:00:05');
    expect(seekListener).toHaveBeenCalledWith('00:00:05');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('closes by killing the process', () => {
    decoder.open('in.mp4');
    const proc = spawnMock.mock.results[0].value;
    decoder.close();
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    decoder.close();
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });
});
