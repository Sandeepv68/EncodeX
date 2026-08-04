import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
      ]) {
        self[method] = vi.fn(() => self);
      }
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
    await Promise.resolve();
    const cmd = getCommand();
    const listener = vi.fn();
    emitter.on('progress', listener);
    onHandler(cmd, 'progress')({ timemark: '00:01:00' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ percent: 60 }));
  });

  it('uses zero percent when the source duration is unknown', async () => {
    const core = new FfmpegCore();
    const emitter = core.convert('in.mp4', 'out.mp4', {});
    const infoCmd = getCommand(0);
    infoCmd.ffprobe.mock.calls[0][0](new Error('probe fail'));
    await Promise.resolve();
    const cmd = getCommand();
    const listener = vi.fn();
    emitter.on('progress', listener);
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

  it('pause and resume are no-ops without a process', () => {
    const core = new FfmpegCore();
    core.pause();
    core.resume();
    expect(suspendProcessMock).not.toHaveBeenCalled();
    expect(resumeProcessMock).not.toHaveBeenCalled();
  });
});
