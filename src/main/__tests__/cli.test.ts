import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { CommandMock, createTranscoderMock, getAction, outputHelpMock, parseAsyncMock } = vi.hoisted(() => {
  let actionHandler: ((input?: string, output?: string, opts?: Record<string, unknown>) => Promise<void>) | undefined;
  const outputHelpMock = vi.fn();
  const parseAsyncMock = vi.fn();
  class Command {
    name = vi.fn(() => this);
    description = vi.fn(() => this);
    argument = vi.fn(() => this);
    option = vi.fn(() => this);
    action = vi.fn((fn: typeof actionHandler) => {
      actionHandler = fn;
      return this;
    });
    outputHelp = outputHelpMock;
    parseAsync = parseAsyncMock;
  }
  return {
    CommandMock: Command,
    createTranscoderMock: vi.fn(),
    getAction: () => actionHandler,
    outputHelpMock,
    parseAsyncMock,
  };
});

vi.mock('commander', () => ({ Command: CommandMock }));
vi.mock('../transcoders/factory', () => ({ createTranscoder: createTranscoderMock }));

const { runCli } = await import('../cli');

interface FakeTranscoder {
  emitter: EventEmitter;
  getInfo: ReturnType<typeof vi.fn>;
  convert: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
}

function makeTranscoder(): FakeTranscoder {
  const emitter = new EventEmitter();
  return {
    emitter,
    getInfo: vi.fn().mockResolvedValue({ file: 'in', format: 'mp4', size: 1, duration: 10, bitrate: '1', streams: [] }),
    convert: vi.fn(() => emitter),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
}

const ORIGINAL_ARGV = process.argv;

describe('runCli', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let transcoder: FakeTranscoder;
  let clearLineSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    parseAsyncMock.mockResolvedValue(undefined);
    transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdout = process.stdout as unknown as { clearLine: () => boolean; cursorTo: () => boolean; write: (s: string) => boolean };
    if (typeof stdout.clearLine !== 'function') {
      stdout.clearLine = vi.fn(() => true);
    }
    if (typeof stdout.cursorTo !== 'function') {
      stdout.cursorTo = vi.fn(() => true);
    }
    clearLineSpy = vi.mocked(stdout.clearLine);
    vi.spyOn(stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.argv = ORIGINAL_ARGV;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows help and skips parsing when --help is passed', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--help'];
    await runCli();
    expect(outputHelpMock).toHaveBeenCalled();
    expect(parseAsyncMock).not.toHaveBeenCalled();
  });

  it('parses positional args after the script path', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    expect(parseAsyncMock).toHaveBeenCalledWith(['in.mp4', 'out.mp4'], { from: 'user' });
  });

  it('strips the --cli flag before parsing', async () => {
    process.argv = ['node', 'x.js', '--cli', 'in.mp4', 'out.mp4'];
    await runCli();
    expect(parseAsyncMock).toHaveBeenCalledWith(['in.mp4', 'out.mp4'], { from: 'user' });
  });

  it('rejects when --info is used without an input file', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--info'];
    await runCli();
    const action = getAction()!;
    await expect(action(undefined, undefined, { info: true, transcoder: 'FFMPEG' })).rejects.toThrow('Missing input file');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --info requires an input file');
  });

  it('prints media info when --info is used with an input', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--info', 'in.mp4'];
    await runCli();
    const action = getAction()!;
    await action('in.mp4', undefined, { info: true, transcoder: 'FFMPEG' });
    expect(transcoder.getInfo).toHaveBeenCalledWith('in.mp4');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"format"'));
  });

  it('converts with mapped options and resolves on end', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', {
      transcoder: 'FFMPEG',
      copy: true,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      bitrateVideo: '1000k',
      bitrateAudio: '128k',
      pixFmt: 'yuv420p',
      scale: '1280x720',
      startTime: '00:00:01',
      endTime: '00:00:10',
      duration: '5',
    });
    transcoder.emitter.emit('end');
    await promise;
    expect(transcoder.convert).toHaveBeenCalledWith('in.mp4', 'out.mp4', {
      copy: true,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '1000k',
      audioBitrate: '128k',
      pixelFormat: 'yuv420p',
      scale: '1280x720',
      startTime: '00:00:01',
      endTime: '00:00:10',
      duration: '5',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith('\nConversion completed successfully!');
  });

  it('maps the --no-audio flag to audio: false', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', { transcoder: 'FFMPEG', copy: true, audio: false });
    transcoder.emitter.emit('end');
    await promise;
    expect(transcoder.convert).toHaveBeenCalledWith('in.mp4', 'out.mp4', { copy: true, audio: false });
  });

  it('prints progress updates to stdout', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', { transcoder: 'FFMPEG' });
    transcoder.emitter.emit('progress', { percent: 50, time: '00:00:05', speed: '2x', eta: '10' });
    transcoder.emitter.emit('end');
    await promise;
    expect(process.stdout.write).toHaveBeenCalledWith('Progress: 00:00:05 | Speed: 2x | ETA: 10s');
  });

  it('tolerates a non-TTY stdout', async () => {
    clearLineSpy.mockImplementation(() => {
      throw new Error('no tty');
    });
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', { transcoder: 'FFMPEG' });
    transcoder.emitter.emit('progress', { percent: 10, time: '00:00:01', speed: '1x', eta: '9' });
    transcoder.emitter.emit('end');
    await promise;
  });

  it('rejects and logs when the conversion errors', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', { transcoder: 'FFMPEG' });
    transcoder.emitter.emit('error', new Error('failed'));
    await expect(promise).rejects.toThrow('failed');
    expect(consoleErrorSpy).toHaveBeenCalledWith('\nConversion failed:', 'failed');
  });

  it('cancels and rejects when the conversion times out', async () => {
    vi.useFakeTimers();
    process.argv = ['node', 'C:\\project\\index.js', 'in.mp4', 'out.mp4'];
    await runCli();
    const action = getAction()!;
    const promise = action('in.mp4', 'out.mp4', { transcoder: 'FFMPEG' });
    const expectation = expect(promise).rejects.toThrow('Conversion timed out');
    await vi.advanceTimersByTimeAsync(300000);
    expect(transcoder.cancel).toHaveBeenCalled();
    await expectation;
  });
});
