import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { ErrorCode, isAppError } from '../../../shared/errors';
import { TRANSCODER_DEFAULTS, KILL_SIGNAL } from '../../../shared/transcoder-constants';

const { ffmpegMock, setFfmpegPathMock, setFfprobePathMock, existsSyncMock, suspendProcessMock, resumeProcessMock, makeCommand } =
  vi.hoisted(() => {
    function makeCommand() {
      const self: Record<string, unknown> = {};
      for (const method of [
        'inputOptions',
        'outputOptions',
        'videoCodec',
        'audioCodec',
        'videoBitrate',
        'audioBitrate',
        'size',
        'videoFilters',
        'setStartTime',
        'seekOutput',
        'duration',
        'output',
        'run',
        'kill',
        'input',
      ]) {
        self[method] = vi.fn(() => self);
      }
      self._currentInput = { options: vi.fn(() => self._currentInput) };
      self.ffprobe = vi.fn();
      self.on = vi.fn(() => self);
      self.ffmpegProc = { pid: 4242 };
      return self;
    }
    return {
      ffmpegMock: vi.fn(),
      setFfmpegPathMock: vi.fn(),
      setFfprobePathMock: vi.fn(),
      existsSyncMock: vi.fn(() => true),
      suspendProcessMock: vi.fn(),
      resumeProcessMock: vi.fn(),
      makeCommand,
    };
  });

vi.mock('fluent-ffmpeg', () => {
  const f = Object.assign(ffmpegMock, { setFfmpegPath: setFfmpegPathMock, setFfprobePath: setFfprobePathMock });
  return { default: f };
});

vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg.exe' }));
vi.mock('ffprobe-static', () => ({ path: 'C:\\ffprobe.exe' }));
vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));
vi.mock('../../process-utils', () => ({ suspendProcess: suspendProcessMock, resumeProcess: resumeProcessMock }));

const { FfmpegCore } = await import('../ffmpeg-core');

type Cmd = {
  on: ReturnType<typeof vi.fn>;
  ffprobe: ReturnType<typeof vi.fn>;
  /** Spied on to assert the per-input `-itsoffset` for additional inputs. */
  _currentInput: { options: ReturnType<typeof vi.fn> };
  [key: string]: unknown;
};

function getCommand(index = -1): Cmd {
  const results = ffmpegMock.mock.results;
  const i = index < 0 ? results.length + index : index;
  return results[i].value as Cmd;
}

function onHandler(cmd: Cmd, event: string): (...args: unknown[]) => void {
  const calls = cmd.on.mock.calls as Array<[string, (...args: unknown[]) => void]>;
  return calls.find(([e]) => e === event)![1];
}

const PROBE_DATA = {
  format: { filename: 'in.mp4', format_name: 'mp4', duration: '10.5', size: '100', bit_rate: '1000' },
  streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 }],
};

describe('FfmpegCore', () => {
  beforeEach(() => {
    ffmpegMock.mockClear();
    ffmpegMock.mockImplementation(() => makeCommand());
    existsSyncMock.mockReturnValue(true);
    suspendProcessMock.mockClear();
    resumeProcessMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures bundled ffmpeg and ffprobe paths at load time', () => {
    expect(setFfmpegPathMock).toHaveBeenCalledWith('C:\\ffmpeg.exe');
    expect(setFfprobePathMock).toHaveBeenCalledWith('C:\\ffprobe.exe');
  });

  it('returns its type', () => {
    expect(new FfmpegCore().getType()).toBe('FFMPEG');
  });

  it('getInfo resolves mapped ffprobe data', async () => {
    const core = new FfmpegCore();
    const promise = core.getInfo('in.mp4');
    const cmd = getCommand(0);
    cmd.ffprobe.mock.calls[0][0](null, PROBE_DATA);
    const info = await promise;
    expect(cmd.ffprobe).toHaveBeenCalled();
    expect(info).toEqual(expect.objectContaining({ format: 'mp4', duration: 10.5 }));
  });

  it('getInfo rejects when ffprobe fails', async () => {
    const core = new FfmpegCore();
    const promise = core.getInfo('in.mp4');
    const cmd = getCommand(0);
    cmd.ffprobe.mock.calls[0][0](new Error('probe boom'));
    await expect(promise).rejects.toThrow('probe boom');
  });

  // The other getInfo specs all invoke the ffprobe callback. Only this one
  // exercises the case fluent-ffmpeg never reports, so without it a removed
  // watchdog would leave this promise pending forever.
  it('getInfo kills a wedged ffprobe and rejects with OPERATION_TIMED_OUT', async () => {
    expectAppLog('error', 'main/spawn-timeout');
    vi.useFakeTimers();
    try {
      const core = new FfmpegCore();
      const pending = core.getInfo('in.mp4').then(
        () => ({ ok: true, error: undefined }),
        (error: unknown) => ({ ok: false, error }),
      );
      const cmd = getCommand(0);

      await vi.advanceTimersByTimeAsync(TRANSCODER_DEFAULTS.FFPROBE_TIMEOUT_MS - 1);
      expect(cmd.kill).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      const outcome = await pending;
      expect(outcome.ok).toBe(false);
      expect(isAppError(outcome.error) && outcome.error.code).toBe(ErrorCode.OPERATION_TIMED_OUT);
      expect(cmd.kill).toHaveBeenCalledWith(KILL_SIGNAL);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses stream copy mode when copy is enabled', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { copy: true });
    const cmd = getCommand();
    expect(cmd.outputOptions).toHaveBeenCalledWith('-c', 'copy');
    expect(cmd.videoCodec).not.toHaveBeenCalled();
    expect(cmd.inputOptions).not.toHaveBeenCalled();
  });

  it('adds the no-audio output option when audio is disabled', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { copy: true, audio: false });
    const cmd = getCommand();
    expect(cmd.outputOptions).toHaveBeenCalledWith('-an');
  });

  it('does not add the no-audio output option when audio is enabled or unspecified', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { copy: true });
    core.convert('in.mp4', 'out.mp4', { copy: true, audio: true });
    const last = getCommand();
    const first = getCommand(0);
    expect(first.outputOptions).not.toHaveBeenCalledWith('-an');
    expect(last.outputOptions).not.toHaveBeenCalledWith('-an');
  });

  it('applies hardware acceleration input options for hardware video codecs', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc' });
    const cmd = getCommand();
    expect(cmd.inputOptions).toHaveBeenCalledWith(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
    expect(cmd.videoCodec).toHaveBeenCalledWith('h264_nvenc');
  });

  it('does not apply hardware acceleration input options for software codecs', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoCodec: 'libx265' });
    const cmd = getCommand();
    expect(cmd.inputOptions).not.toHaveBeenCalled();
  });

  it('does not apply hardware acceleration input options when hardware acceleration is disabled', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc', hardwareAcceleration: false });
    const cmd = getCommand();
    expect(cmd.inputOptions).not.toHaveBeenCalled();
  });

  it('does not apply hardware acceleration input options in encode-only mode', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc', hardwareAcceleration: true, hwaccelMode: 'encode' });
    const cmd = getCommand();
    expect(cmd.inputOptions).not.toHaveBeenCalled();
    expect(cmd.videoCodec).toHaveBeenCalledWith('h264_nvenc');
  });

  it('applies all codec, bitrate, and filter options', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '1000k',
      audioBitrate: '128k',
      qscale: 23,
      scale: '1280x720',
      pixelFormat: 'yuv420p',
      startTime: '00:00:01',
      endTime: '00:00:05',
      duration: '4',
    });
    const cmd = getCommand();
    expect(cmd.videoCodec).toHaveBeenCalledWith('libx264');
    expect(cmd.audioCodec).toHaveBeenCalledWith('aac');
    expect(cmd.videoBitrate).toHaveBeenCalledWith('1000k');
    expect(cmd.audioBitrate).toHaveBeenCalledWith('128k');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-qscale:v 23');
    expect(cmd.size).toHaveBeenCalledWith('1280x720');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-pix_fmt yuv420p');
    expect(cmd.setStartTime).toHaveBeenCalledWith('00:00:01');
    expect(cmd.inputOptions).toHaveBeenCalledWith('-to', '00:00:05');
    expect(cmd.duration).toHaveBeenCalledWith('4');
    expect(cmd.output).toHaveBeenCalledWith('out.mp4');
    expect(cmd.run).toHaveBeenCalled();
  });

  it('forces full-range color for MJPEG output', () => {
    const core = new FfmpegCore();
    core.convert('in.png', 'out.jpg', { videoCodec: 'mjpeg', qscale: 23, pixelFormat: 'yuv420p' });
    const cmd = getCommand();
    expect(cmd.videoCodec).toHaveBeenCalledWith('mjpeg');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-pix_fmt yuv420p');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-color_range', 'full');
  });

  it('does not force color range for non-MJPEG codecs', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoCodec: 'libx264', pixelFormat: 'yuv420p' });
    const cmd = getCommand();
    expect(cmd.outputOptions).not.toHaveBeenCalledWith('-color_range', 'full');
  });

  it('uses the scale filter when keepAspectRatio is enabled', () => {
    const core = new FfmpegCore();
    core.convert('in.png', 'out.png', { scale: '1280x720', keepAspectRatio: true });
    const cmd = getCommand();
    expect(cmd.size).not.toHaveBeenCalled();
    expect(cmd.videoFilters).toHaveBeenCalledWith('scale=1280:-2');
  });

  it('uses exact dimensions when keepAspectRatio is disabled', () => {
    const core = new FfmpegCore();
    core.convert('in.png', 'out.png', { scale: '1280x720', keepAspectRatio: false });
    const cmd = getCommand();
    expect(cmd.size).toHaveBeenCalledWith('1280x720');
    expect(cmd.videoFilters).not.toHaveBeenCalled();
  });

  it('uses exact dimensions by default when keepAspectRatio is unset', () => {
    const core = new FfmpegCore();
    core.convert('in.png', 'out.png', { scale: '1280x720' });
    const cmd = getCommand();
    expect(cmd.size).toHaveBeenCalledWith('1280x720');
    expect(cmd.videoFilters).not.toHaveBeenCalled();
  });

  it('merges scale and rotation into one video filter chain', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { scale: '1280x720', rotate: '90' });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('scale=1280x720,transpose=1');
    expect(cmd.size).not.toHaveBeenCalled();
  });

  it('applies rotation filters without scale', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { rotate: '270', flipH: true });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('transpose=2,hflip');
    expect(cmd.size).not.toHaveBeenCalled();
  });

  it('keeps aspect ratio in the combined chain when requested', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { scale: '1280x720', rotate: '180', keepAspectRatio: true });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('scale=1280:-2,transpose=2,transpose=2');
  });

  it('appends user video filters after scale and rotation in one chain', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', {
      scale: '1280x720',
      rotate: '90',
      videoFilters: ['fps=30', 'eq=brightness=0.1'],
    });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('scale=1280x720,transpose=1,fps=30,eq=brightness=0.1');
    expect(cmd.size).not.toHaveBeenCalled();
  });

  it('emits a video filter chain for user filters only', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoFilters: ['yadif=1', 'hqdn3d=4'] });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('yadif=1,hqdn3d=4');
  });

  it('keeps scale-only on the native size fast path', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { scale: '1280x720' });
    const cmd = getCommand();
    expect(cmd.size).toHaveBeenCalledWith('1280x720');
    expect(cmd.videoFilters).not.toHaveBeenCalled();
  });

  it('drops invalid filter entries and keeps valid ones', () => {
    expectAppLog('warn', 'main/transcoders/ffmpeg-core');

    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { videoFilters: ['fps=30', 'fps=30;rm -rf /'] });
    const cmd = getCommand();
    expect(cmd.videoFilters).toHaveBeenCalledWith('fps=30');
  });

  it('writes rotation metadata in copy mode for supported containers', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', { copy: true, rotate: '90' });
    const cmd = getCommand();
    expect(cmd.outputOptions).toHaveBeenCalledWith('-c', 'copy');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-metadata:s:v', 'rotate=90');
  });

  it('does not write rotation metadata for unsupported containers', () => {
    expectAppLog('warn', 'main/transcoders/ffmpeg-core');

    const core = new FfmpegCore();
    core.convert('in.webm', 'out.webm', { copy: true, rotate: '90' });
    const cmd = getCommand();
    expect(cmd.outputOptions).not.toHaveBeenCalledWith('-metadata:s:v', 'rotate=90');
  });

  it('adds additional inputs and applies -itsoffset to the correct input', () => {
    const core = new FfmpegCore();
    core.convert('in.mkv', 'out.mkv', {
      copy: true,
      additionalInputs: [{ path: 'newsong.m4a', map: ['1:0'], codec: 'copy', syncOffsetSeconds: 2 }],
    });
    const cmd = getCommand();
    expect(cmd.input).toHaveBeenCalledWith('newsong.m4a');
    expect((cmd as Cmd)._currentInput.options).toHaveBeenCalledWith('-itsoffset', '2');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map', '1:0');
  });

  it('emits maps, -c:s, -map_chapters, and cover disposition in copy mode', () => {
    const core = new FfmpegCore();
    core.convert('in.mp4', 'out.mp4', {
      copy: true,
      map: ['0:v:0', '0:a:0'],
      subtitleCodec: 'mov_text',
      additionalInputs: [
        { path: 'cover.jpg', map: ['1:0'], disposition: 'attached_pic' },
        { path: 'subs.srt', map: ['2:0'], codec: 'mov_text' },
      ],
    });
    const cmd = getCommand();
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map', '0:v:0');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map', '1:0');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map', '2:0');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-c:s', 'mov_text');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-c:s', 'mov_text');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-disposition:v:1', 'attached_pic');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map_chapters', '0');
    expect(cmd.input).toHaveBeenCalledWith('cover.jpg');
    expect(cmd.input).toHaveBeenCalledWith('subs.srt');
  });

  it('emits -c:s in re-encode mode for demux subtitle conversions', () => {
    const core = new FfmpegCore();
    core.convert('in.mkv', 'out.srt', {
      copy: false,
      map: ['0:s:0'],
      subtitleCodec: 'srt',
      video: false,
      audio: false,
    });
    const cmd = getCommand();
    expect(cmd.outputOptions).toHaveBeenCalledWith('-map', '0:s:0');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-c:s', 'srt');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-vn');
    expect(cmd.outputOptions).toHaveBeenCalledWith('-an');
  });

  it('does not add -map_chapters when copyChapters is false', () => {
    const core = new FfmpegCore();
    core.convert('in.mkv', 'out.mkv', { copy: true, copyChapters: false });
    const cmd = getCommand();
    expect(cmd.outputOptions).not.toHaveBeenCalledWith('-map_chapters', '0');
  });

  it('emits progress with percent when provided', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const listener = vi.fn();
    emitter.on('progress', listener);
    onHandler(cmd, 'progress')({ percent: 50, timemark: '00:00:10', currentFps: 24, speed: '2x', currentKbps: 1000 });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 50, time: '00:00:10', fps: 24, speed: '2x', bitrate: '1000kbps' }),
    );
  });

  it('derives progress percent from the source duration', async () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const infoCmd = getCommand(0);
    infoCmd.ffprobe.mock.calls[0][0](null, { format: { duration: '100' } });
    const cmd = getCommand();
    const listener = vi.fn();
    emitter.on('progress', listener);
    // `getInfo` is wrapped in the spawn watchdog, so `sourceDuration` lands one
    // microtask hop *after* the probe callback fires. Wait for the effect
    // instead of assuming a fixed number of ticks — a hardcoded
    // `await Promise.resolve()` here silently started passing for the wrong
    // reason the moment the wrapper was introduced.
    await vi.waitFor(() => {
      expect((core as unknown as { sourceDuration: number }).sourceDuration).toBe(100);
    });
    onHandler(cmd, 'progress')({ timemark: '00:01:00' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ percent: 60 }));
  });

  it('uses zero percent when the source duration is unknown', async () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const infoCmd = getCommand(0);
    infoCmd.ffprobe.mock.calls[0][0](new Error('probe fail'));
    const cmd = getCommand();
    const listener = vi.fn();
    emitter.on('progress', listener);
    await vi.waitFor(() => {
      expect((core as unknown as { sourceDuration: number }).sourceDuration).toBe(0);
    });
    onHandler(cmd, 'progress')({ timemark: '00:01:00' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ percent: 0 }));
  });

  it('forwards start and codecData events and captures the process pid', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const startListener = vi.fn();
    const codecDataListener = vi.fn();
    emitter.on('start', startListener);
    emitter.on('codecData', codecDataListener);
    onHandler(cmd, 'start')('ffmpeg -i in.mp4 out.mp4');
    onHandler(cmd, 'codecData')({ audio: { codec: 'aac' } });
    expect(startListener).toHaveBeenCalledWith('ffmpeg -i in.mp4 out.mp4');
    expect(codecDataListener).toHaveBeenCalledWith({ audio: { codec: 'aac' } });
    core.pause();
    expect(suspendProcessMock).toHaveBeenCalledWith(4242);
    core.resume();
    expect(resumeProcessMock).toHaveBeenCalledWith(4242);
  });

  it('emits error events from ffmpeg', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const errorListener = vi.fn();
    emitter.on('error', errorListener);
    onHandler(cmd, 'error')(new Error('ffmpeg fail'));
    expect(errorListener).toHaveBeenCalledWith(new Error('ffmpeg fail'));
  });

  it('emits end when ffmpeg finishes', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const endListener = vi.fn();
    emitter.on('end', endListener);
    onHandler(cmd, 'end')();
    expect(endListener).toHaveBeenCalled();
  });

  it('emits a CANCELLED error when the process was cancelled', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);
    core.cancel();
    expect(cmd.kill).toHaveBeenCalledWith('SIGKILL');
    onHandler(cmd, 'error')(new Error('killed'));
    expect(endListener).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCELLED' }));
  });

  it('a cancel issued before the process spawns is honoured once it spawns', () => {
    // fluent-ffmpeg spawns asynchronously: `run()` first performs capability
    // checks and argument building inside `_prepare`, and only then assigns
    // `ffmpegProc`. Until that assignment `proto.kill` finds nothing to signal
    // and merely logs a warning, so a cancel issued in that window used to be
    // silently lost - the conversion ran to completion and wrote an output
    // file the user had already abandoned.
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const proc = { pid: 99, kill: vi.fn(() => true) };
    (cmd as { ffmpegProc?: unknown }).ffmpegProc = undefined;
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);

    core.cancel();
    expect(proc.kill).not.toHaveBeenCalled(); // nothing to signal yet

    (cmd as { ffmpegProc?: unknown }).ffmpegProc = proc;
    onHandler(cmd, 'start')('ffmpeg -i in.mp4 out.mp4');
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');

    onHandler(cmd, 'end')();
    expect(endListener).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCELLED' }));
  });

  it('an end event that races a cancel reports a cancelled error, not success', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);

    core.cancel();
    onHandler(cmd, 'end')();

    expect(endListener).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCELLED' }));
  });

  it('delivers exactly one terminal event per run', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const endListener = vi.fn();
    const errorListener = vi.fn();
    emitter.on('end', endListener);
    emitter.on('error', errorListener);

    onHandler(cmd, 'error')(new Error('boom'));
    onHandler(cmd, 'end')();
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(endListener).not.toHaveBeenCalled();
  });

  it('normalises non-finite and out-of-range progress before emitting it', () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const cmd = getCommand();
    const progress: Array<Record<string, unknown>> = [];
    emitter.on('progress', (p: Record<string, unknown>) => progress.push(p));

    onHandler(cmd, 'progress')({ percent: NaN, timemark: '00:00:01', currentFps: NaN, currentKbps: NaN });
    onHandler(cmd, 'progress')({ percent: 150, timemark: '00:00:02', currentFps: 30, currentKbps: 1000 });
    onHandler(cmd, 'progress')({ percent: -20, timemark: '00:00:03', currentFps: -5, currentKbps: 500 });

    for (const p of progress) {
      expect(Number.isFinite(p.percent as number)).toBe(true);
      expect(p.percent as number).toBeGreaterThanOrEqual(0);
      expect(p.percent as number).toBeLessThanOrEqual(100);
      expect(Number.isFinite(p.fps as number)).toBe(true);
      expect(typeof p.eta).toBe('string');
      expect(typeof p.time).toBe('string');
      expect(typeof p.speed).toBe('string');
    }
    expect(progress[0].percent).toBe(0);
    expect(progress[0].bitrate).toBe(''); // non-finite kbps must not become 'NaNkbps'
    expect(progress[1].percent).toBe(100);
    expect(progress[1].bitrate).toBe('1000kbps');
    expect(progress[2].percent).toBe(0);
    expect(progress[2].fps).toBe(0);
  });

  it('pause and resume are no-ops without a process', () => {
    const core = new FfmpegCore();
    core.pause();
    core.resume();
    expect(suspendProcessMock).not.toHaveBeenCalled();
    expect(resumeProcessMock).not.toHaveBeenCalled();
  });
});
