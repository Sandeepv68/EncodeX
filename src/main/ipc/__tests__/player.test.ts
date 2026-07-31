import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { IPC } from '../../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../../shared/transcoder-constants';

interface DecoderLike extends EventEmitter {
  open: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
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
      constructor() {
        super();
        this.open = vi.fn();
        this.seek = vi.fn();
        this.close = vi.fn();
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('PLAYER_OPEN opens the decoder at the video stream resolution', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'v.mp4',
      format: 'mp4',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'video', width: 1280, height: 720 }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(decoder.open).toHaveBeenCalledWith('v.mp4', 1280, 720);
  });

  it('PLAYER_OPEN opens at the default resolution when there is no video stream', async () => {
    getInfoMock.mockResolvedValueOnce({
      file: 'a.mp3',
      format: 'mp3',
      size: 1,
      duration: 10,
      bitrate: '1',
      streams: [{ type: 'audio' }],
    });
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'a.mp3');
    expect(decoder.open).toHaveBeenCalledWith('a.mp3');
  });

  it('PLAYER_OPEN falls back to the default resolution on error', async () => {
    getInfoMock.mockRejectedValueOnce(new Error('probe failed'));
    await getHandlers()[IPC.PLAYER_OPEN]({}, 'v.mp4');
    expect(decoder.open).toHaveBeenCalledWith('v.mp4');
  });

  it('PLAYER_SEEK delegates to the decoder', async () => {
    await getHandlers()[IPC.PLAYER_SEEK]({}, '00:00:05');
    expect(decoder.seek).toHaveBeenCalledWith('00:00:05');
  });

  it('PLAYER_CLOSE delegates to the decoder', async () => {
    await getHandlers()[IPC.PLAYER_CLOSE]();
    expect(decoder.close).toHaveBeenCalled();
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
    const frame = { buffer: Buffer.from([1, 2, 3]), width: 2, height: 2, pts: 5 };
    decoder.emit('frame', frame);
    expect(send).toHaveBeenCalledWith(IPC.PLAYER_FRAME, {
      data: frame.buffer.buffer,
      width: 2,
      height: 2,
      pts: 5,
    });
  });
});
