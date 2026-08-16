import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMainMock, getHandleHandlers } = vi.hoisted(() => {
  const handleHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handleHandlers[channel] = fn;
      }),
    },
    getHandleHandlers: () => handleHandlers,
  };
});

const { getEncoderCapabilitiesMock } = vi.hoisted(() => ({
  getEncoderCapabilitiesMock: vi.fn(),
}));

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));
vi.mock('../../capabilities', () => ({ getEncoderCapabilities: getEncoderCapabilitiesMock }));

const { registerCapabilityHandlers } = await import('../capabilities');
import { IPC } from '../../../shared/ipc-channels';

describe('registerCapabilityHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the GET_CAPABILITIES handler', () => {
    registerCapabilityHandlers();
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.GET_CAPABILITIES, expect.any(Function));
  });

  it('returns the probed encoder capabilities', () => {
    const caps = { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: ['dxva2'] };
    getEncoderCapabilitiesMock.mockReturnValue(caps);

    registerCapabilityHandlers();
    expect(getHandleHandlers()[IPC.GET_CAPABILITIES]()).toBe(caps);
  });

  it('returns null when the capability probe failed', () => {
    getEncoderCapabilitiesMock.mockReturnValue(null);

    registerCapabilityHandlers();
    expect(getHandleHandlers()[IPC.GET_CAPABILITIES]()).toBeNull();
  });
});
