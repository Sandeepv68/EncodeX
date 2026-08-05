import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { IPC } from '../../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../../shared/transcoder-constants';

interface DecoderLike extends EventEmitter {
  open: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getGeneration: ReturnType<typeof vi.fn>;
}

const { ipcMainMock, getHandlers, frameDecoderInstances, FfmpegCoreMock, getInfoMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const frameDecoderInstances: DecoderLike[] = [];
  const getInfoMock = vi.fn();
  function FfmpegCoreMock() {
    return { getInfo: getInfoMock };
  }
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
      on: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    frameDecoderInstances,
    FfmpegCoreMock,
    getInfoMock,
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));

vi.mock('../../player/frame-decoder', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  return {
    FrameDecoder: class extends EventEmitter {
      open: ReturnType<typeof vi.fn>;
      seek: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      getGeneration: ReturnType<typeof vi.fn>;
      constructor() {
        super();
        this.open = vi.fn();
        this.seek = vi.fn();
        this.close = vi.fn();
        this.getGeneration = vi.fn(() => 7);
        frameDecoderInstances.push(this);
      }
    },
  };
});

vi.mock('../../transcoders/ffmpeg-core', () => ({ FfmpegCore: FfmpegCoreMock }));

const { registerPlayerHandlers } = await import('../player');

describe('registerPlayerHandlers', () => {
  const send = vi.fn();
  let decoder: DecoderLike;

  beforeEach(() => {
    vi.clearAllMocks();
    frameDecoderInstances.length = 0;
    vi.useRealTimers();
    registerPlayerHandlers({} as never, send);
    decoder = frameDecoderInstances[0];
  });

  const PLAYER_OPTIONS = { realtime: true, audioOnly: false, fpsCap: TRANSCODER_DEFAULTS.PLAYER_FPS_CAP };
  const AUDIO_OPTIONS = { realtime: true, audioOnly: true, fpsCap: 0 };

  const videoDecoder = (): DecoderLike => frameDecoderInstances[0];
  const audioDecoder = (): DecoderLike => frameDecoderInstances[1];

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('PLAYER_OPEN opens the video decoder at the video stream resolution', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 640, height: 360 }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4', 640, 360, undefined, PLAYER_OPTIONS);
  });

  it('PLAYER_OPEN caps the decode resolution to keep playback smooth', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 3840, height: 2160 }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4', 640, 360, undefined, PLAYER_OPTIONS);
  });

  it('PLAYER_OPEN keeps sub-cap resolutions unchanged', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 320, height: 240 }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4', 320, 240, undefined, PLAYER_OPTIONS);
  });

  it('PLAYER_OPEN opens a separate realtime audio-only decoder when an audio stream is present', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [
        { type: 'video', width: 640, height: 360 },
        { type: 'audio', sampleRate: 44100, channels: 2 },
      ],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4', 640, 360, undefined, PLAYER_OPTIONS);
    expect(audioDecoder().open).toHaveBeenCalledWith('v.mp4', undefined, undefined, { sampleRate: 44100, channels: 2 }, AUDIO_OPTIONS);
  });

  it('PLAYER_OPEN does not open the audio decoder when there is no audio stream', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 320, height: 240 }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4', 320, 240, undefined, PLAYER_OPTIONS);
    expect(audioDecoder().open).not.toHaveBeenCalled();
  });

  it('PLAYER_OPEN opens the audio decoder for audio-only files', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'a.mp3',
      format: 'mp3',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'audio' }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'a.mp3');
    expect(videoDecoder().open).toHaveBeenCalledWith('a.mp3');
    expect(audioDecoder().open).toHaveBeenCalledWith('a.mp3', undefined, undefined, { sampleRate: 48000, channels: 2 }, AUDIO_OPTIONS);
  });

  it('PLAYER_OPEN falls back to the default resolution on error', async () => {
    getInfoMock.mockRejectedValueOnce(new Error('probe failed'));
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(videoDecoder().open).toHaveBeenCalledWith('v.mp4');
  });

  it('PLAYER_SEEK delegates to both decoders', async () => {
    await getHandlers()[IPC.PLAYER_SEEK]({}, '00:00:05');
    expect(videoDecoder().seek).toHaveBeenCalledWith('00:00:05');
    expect(audioDecoder().seek).toHaveBeenCalledWith('00:00:05');
  });

  it('PLAYER_OPEN returns the playback generation', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 1280, height: 720 }],
    });
    const result = await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(result).toBe(1);
  });

  it('PLAYER_SEEK returns a new playback generation', async () => {
    const result = await getHandlers()[IPC.PLAYER_SEEK]({}, '00:00:05');
    expect(result).toBe(1);
  });

  it('PLAYER_CLOSE delegates to both decoders', async () => {
    await getHandlers()[IPC.PLAYER_CLOSE]();
    expect(videoDecoder().close).toHaveBeenCalled();
    expect(audioDecoder().close).toHaveBeenCalled();
  });

  it('PLAYER_GET_FRAME resolves with the next decoded frame', async () => {
    const frame = { buffer: Buffer.from([1, 2, 3]), width: 1, height: 1, pts: 7 };
    const promise = getHandlers()[IPC.PLAYER_GET_FRAME]() as Promise<unknown>;
    decoder.emit('frame', frame);
    expect(await promise).toBe(frame);
  });

  it('PLAYER_GET_FRAME resolves with null after the timeout', async () => {
    vi.useFakeTimers();
    const promise = getHandlers()[IPC.PLAYER_GET_FRAME]() as Promise<unknown>;
    await vi.advanceTimersByTimeAsync(TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS);
    expect(await promise).toBeNull();
  });

  it('forwards decoded frames to the renderer', () => {
    const frame = { buffer: Buffer.from([1, 2, 3]), width: 2, height: 2, pts: 5, generation: 2 };
    decoder.emit('frame', frame);
    expect(send).toHaveBeenCalledWith(IPC.PLAYER_FRAME, {
      data: frame.buffer.buffer,
      width: 2,
      height: 2,
      pts: 5,
      generation: 0,
    });
  });

  it('forwards decoded audio chunks to the renderer', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [
        { type: 'video', width: 2, height: 2 },
        { type: 'audio', sampleRate: 48000, channels: 2 },
      ],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    send.mockClear();
    const chunk = { buffer: Buffer.from([1, 2, 3, 4]), sampleRate: 48000, channels: 2, generation: 3 };
    audioDecoder().emit('audio', chunk);
    expect(send).toHaveBeenCalledWith(IPC.PLAYER_AUDIO, {
      data: chunk.buffer.buffer,
      sampleRate: 48000,
      channels: 2,
      generation: 1,
    });
  });

  it('forwards decoder errors to the renderer', () => {
    const err = new Error('decoder crashed');
    videoDecoder().emit('error', err);
    expect(send).toHaveBeenCalledWith(IPC.PLAYER_ERROR, 'decoder crashed');
  });
});
