import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { DecodedFrame, DecodedAudio } from '../frame-decoder';

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

function createFakeProcess(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdio: Array<null | EventEmitter>;
  pid: number;
  kill: ReturnType<typeof vi.fn>;
} {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const audio = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdio: Array<null | EventEmitter>;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.stdio = [null, stdout, stderr, audio];
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
    expect(args).toEqual([
      '-copyts',
      '-re',
      '-i',
      'in.mp4',
      '-vf',
      'showinfo',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      '640x360',
      '-an',
      '-sn',
      '-dn',
      '-',
    ]);
  });

  it('spawns ffmpeg with the provided resolution', () => {
    decoder.open('in.mp4', 320, 240);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('320x240');
  });

  it('paces decoding in realtime by default', () => {
    decoder.open('in.mp4');
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('-re');
  });

  it('omits -re when realtime pacing is disabled', () => {
    decoder.open('in.mp4', 320, 240, undefined, { realtime: false });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain('-re');
  });

  it('caps the output frame rate via the fps filter when fpsCap is set', () => {
    decoder.open('in.mp4', 640, 360, undefined, { fpsCap: 30 });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('-vf');
    expect(args[args.indexOf('-vf') + 1]).toBe('fps=30,showinfo');
  });

  it('keeps the plain showinfo filter when fpsCap is disabled', () => {
    decoder.open('in.mp4');
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args[args.indexOf('-vf') + 1]).toBe('showinfo');
  });

  it('estimates a bounded monotonic pts when showinfo lags so frames never wedge playback', () => {
    vi.useFakeTimers();
    const pts: number[] = [];
    decoder.on('frame', (f: DecodedFrame) => pts.push(f.pts));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:1.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(pts).toEqual([1]);
    vi.advanceTimersByTime(250);
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(pts).toHaveLength(2);
    expect(pts[1]).toBeGreaterThanOrEqual(1);
    expect(pts[1]).toBeLessThan(5);
  });

  it('spawns ffmpeg with audio output args when audio config is provided', () => {
    decoder.open('in.mp4', 640, 360, { sampleRate: 44100, channels: 2 });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('pipe:1');
    expect(args).toContain('pipe:3');
    expect(args).toContain('-map');
    expect(args).toContain('0:a:0');
    expect(args).toContain('s16le');
    expect(args).toContain('44100');
    const options = spawnMock.mock.calls[0][2] as { stdio: string[] };
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe', 'pipe']);
  });

  it('paces the audio-only decoder in realtime to avoid flooding the pipe', () => {
    decoder.open('in.mp4', 640, 360, { sampleRate: 44100, channels: 2 }, { realtime: true, audioOnly: true });
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args.slice(0, 4)).toEqual(['-copyts', '-re', '-i', 'in.mp4']);
    expect(args).not.toContain('rawvideo');
    expect(args).toContain('pipe:3');
  });

  it('emits audio chunks decoded on the third pipe', () => {
    const audioChunks: Array<{ buffer: Buffer; sampleRate: number; channels: number }> = [];
    decoder.on('audio', (a: { buffer: Buffer; sampleRate: number; channels: number }) => audioChunks.push(a));
    decoder.open('in.mp4', 2, 2, { sampleRate: 48000, channels: 2 });
    const proc = spawnMock.mock.results[0].value;
    (proc.stdio[3] as EventEmitter).emit('data', Buffer.alloc(16));
    expect(audioChunks).toHaveLength(1);
    expect(audioChunks[0]).toMatchObject({ sampleRate: 48000, channels: 2 });
    expect(audioChunks[0].buffer).toHaveLength(16);
  });

  it('tags audio chunks with the current generation', () => {
    const audioChunks: DecodedAudio[] = [];
    decoder.on('audio', (a: DecodedAudio) => audioChunks.push(a));
    decoder.open('in.mp4', 2, 2, { sampleRate: 48000, channels: 2 });
    const proc = spawnMock.mock.results[0].value;
    (proc.stdio[3] as EventEmitter).emit('data', Buffer.alloc(16));
    expect(audioChunks[0].generation).toBe(1);
    expect(decoder.getGeneration()).toBe(1);
  });

  it('ignores audio data after close', () => {
    const audioChunks: unknown[] = [];
    decoder.on('audio', (a: unknown) => audioChunks.push(a));
    decoder.open('in.mp4', 2, 2, { sampleRate: 48000, channels: 2 });
    const proc = spawnMock.mock.results[0].value;
    decoder.close();
    (proc.stdio[3] as EventEmitter).emit('data', Buffer.alloc(16));
    expect(audioChunks).toHaveLength(0);
  });

  it('reopens with audio output args after a seek', () => {
    decoder.open('in.mp4', 2, 2, { sampleRate: 48000, channels: 2 });
    decoder.seek('00:00:01');
    const args = spawnMock.mock.calls[1][1] as string[];
    expect(args).toContain('0:a:0');
    expect(args).toContain('pipe:3');
  });

  it('decodes raw frames from stdout in order with real pts from showinfo', () => {
    const frames: Array<{ width: number; height: number; pts: number; buffer: Buffer }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit(
      'data',
      Buffer.from(
        '[Parsed_showinfo_0 @ 0x1] n:   0 pts: 30000 pts_time:1.000000 ...\n[Parsed_showinfo_0 @ 0x1] n:   1 pts: 60000 pts_time:2.000000 ...\n',
      ),
    );
    proc.stdout.emit('data', Buffer.alloc(24));
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ width: 2, height: 2, pts: 1 });
    expect(frames[1]).toMatchObject({ width: 2, height: 2, pts: 2 });
    expect(frames[0].buffer).toHaveLength(12);
  });

  it('parses pts_time values split across stderr chunks', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 30000 pts_ti'));
    proc.stderr.emit('data', Buffer.from('me:1.500000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ pts: 1.5 });
  });

  it('pairs frames with pts regardless of stream arrival order', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames).toHaveLength(0);
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 30000 pts_time:1.500000 ...\n'));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ pts: 1.5 });
  });

  it('does not re-parse pts from previously consumed stderr chunks', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:1.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames).toHaveLength(1);
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   1 pts: 1 pts_time:2.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames).toHaveLength(2);
    expect(frames[0].pts).toBe(1);
    expect(frames[1].pts).toBe(2);
  });

  it('holds a frame back until its showinfo line arrives', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:0.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(24));
    expect(frames).toHaveLength(1);
    expect(frames[0].pts).toBe(0);
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   1 pts: 1 pts_time:1.000000 ...\n'));
    expect(frames).toHaveLength(2);
    expect(frames[1].pts).toBe(1);
  });

  it('tags frames with a generation that increments on open and seek', () => {
    const frames: Array<{ generation: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    let proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:0.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames[0].generation).toBe(1);
    expect(decoder.getGeneration()).toBe(1);

    decoder.seek('00:00:01');
    expect(decoder.getGeneration()).toBe(2);
    proc = spawnMock.mock.results[1].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:1.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(12));
    expect(frames[1].generation).toBe(2);
  });

  it('buffers partial frames across chunks', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:0.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(6));
    expect(frames).toHaveLength(0);
    proc.stdout.emit('data', Buffer.alloc(6));
    expect(frames).toHaveLength(1);
  });

  it('assembles multiple frames from a single stdout chunk without quadratic copying', () => {
    const frames: Array<{ pts: number }> = [];
    decoder.on('frame', (f: DecodedFrame) => frames.push(f));
    decoder.open('in.mp4', 2, 2);
    const proc = spawnMock.mock.results[0].value;
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   0 pts: 0 pts_time:0.000000 ...\n'));
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   1 pts: 1 pts_time:1.000000 ...\n'));
    proc.stderr.emit('data', Buffer.from('[Parsed_showinfo_0 @ 0x1] n:   2 pts: 2 pts_time:2.000000 ...\n'));
    proc.stdout.emit('data', Buffer.alloc(30));
    expect(frames).toHaveLength(2);
    proc.stdout.emit('data', Buffer.alloc(6));
    expect(frames).toHaveLength(3);
    expect(frames[0].pts).toBe(0);
    expect(frames[1].pts).toBe(1);
    expect(frames[2].pts).toBe(2);
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
    expect(args).toContain('-copyts');
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
