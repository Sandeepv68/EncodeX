import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { IPC } from '../../../shared/ipc-channels';

const { ipcMainMock, getHandlers, createTranscoderMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    createTranscoderMock: vi.fn(),
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));
vi.mock('../../transcoders/factory', () => ({ createTranscoder: createTranscoderMock }));

const { registerConversionHandlers } = await import('../conversion');

interface FakeTranscoder {
  emitter: EventEmitter;
  getInfo: ReturnType<typeof vi.fn>;
  convert: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
}

function makeTranscoder(): FakeTranscoder {
  const emitter = new EventEmitter();
  return {
    emitter,
    getInfo: vi.fn().mockResolvedValue({
      file: 'in.mp4',
      format: 'mp4',
      size: 100,
      duration: 10,
      bitrate: '1000k',
      streams: [],
    }),
    convert: vi.fn(() => emitter),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
  };
}

describe('registerConversionHandlers', () => {
  const send = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    registerConversionHandlers({} as never, send);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET_MEDIA_INFO returns media info', async () => {
    const transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    const result = await getHandlers()[IPC.GET_MEDIA_INFO]({}, 'in.mp4', 'FFMPEG');
    expect(createTranscoderMock).toHaveBeenCalledWith('FFMPEG');
    expect(transcoder.getInfo).toHaveBeenCalledWith('in.mp4');
    expect(result).toEqual(expect.objectContaining({ format: 'mp4', duration: 10 }));
  });

  it('GET_MEDIA_INFO rethrows a formatted error', async () => {
    const transcoder = makeTranscoder();
    transcoder.getInfo.mockRejectedValue(new Error('could not read probe'));
    createTranscoderMock.mockReturnValue(transcoder);
    await expect(getHandlers()[IPC.GET_MEDIA_INFO]({}, 'in.mp4', 'FFMPEG')).rejects.toMatchObject({
      code: 'PROBE_FAILED',
    });
  });

  it('CONVERT_FILE forwards progress and resolves on end', async () => {
    const transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    const progress = { percent: 50, time: '00:00:01', speed: '1x', eta: '10' };
    const promise = getHandlers()[IPC.CONVERT_FILE]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG') as Promise<void>;
    transcoder.emitter.emit('progress', progress);
    expect(send).toHaveBeenCalledWith(IPC.CONVERSION_PROGRESS, { input: 'in.mp4', output: 'out.mp4', progress });
    transcoder.emitter.emit('end');
    await expect(promise).resolves.toBeUndefined();
  });

  it('CONVERT_FILE rejects with a formatted error', async () => {
    const transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    const promise = getHandlers()[IPC.CONVERT_FILE]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG') as Promise<void>;
    transcoder.emitter.emit('error', new Error('conversion failed'));
    await expect(promise).rejects.toMatchObject({ code: 'CONVERSION_FAILED' });
  });

  it('CONVERT_FILE rejects when convert throws synchronously', async () => {
    const transcoder = makeTranscoder();
    transcoder.convert.mockImplementation(() => {
      throw new Error('boom');
    });
    createTranscoderMock.mockReturnValue(transcoder);
    await expect(getHandlers()[IPC.CONVERT_FILE]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG')).rejects.toMatchObject({
      detail: 'boom',
    });
  });

  it('PAUSE, RESUME and CANCEL act on the current transcoder', async () => {
    const transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    const promise = getHandlers()[IPC.CONVERT_FILE]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG') as Promise<void>;
    await Promise.resolve();
    await getHandlers()[IPC.PAUSE_CONVERSION]();
    expect(transcoder.pause).toHaveBeenCalled();
    await getHandlers()[IPC.RESUME_CONVERSION]();
    expect(transcoder.resume).toHaveBeenCalled();
    await getHandlers()[IPC.CANCEL_CONVERSION]();
    expect(transcoder.cancel).toHaveBeenCalled();
    await getHandlers()[IPC.CANCEL_CONVERSION]();
    expect(transcoder.cancel).toHaveBeenCalledTimes(1);
    transcoder.emitter.emit('end');
    await promise;
  });

  it('PAUSE and RESUME are no-ops without a current transcoder', async () => {
    const transcoder = makeTranscoder();
    createTranscoderMock.mockReturnValue(transcoder);
    await getHandlers()[IPC.PAUSE_CONVERSION]();
    await getHandlers()[IPC.RESUME_CONVERSION]();
    expect(transcoder.pause).not.toHaveBeenCalled();
    expect(transcoder.resume).not.toHaveBeenCalled();
  });
});
