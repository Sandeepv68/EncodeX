import { describe, it, expect, vi, beforeEach } from 'vitest';

const appMock = vi.hoisted(() => ({
  getGPUFeatureStatus: vi.fn(() => ({ gpu_compositing: 'enabled' })),
}));

vi.mock('electron', () => ({ app: appMock }));

const { detectHardwareAcceleration } = await import('../hardware');

describe('detectHardwareAcceleration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMock.getGPUFeatureStatus.mockReturnValue({ gpu_compositing: 'enabled' });
  });

  it('reports enabled when the GPU compositing stage is on', () => {
    expect(detectHardwareAcceleration()).toBe(true);
  });

  it('reports disabled otherwise', () => {
    appMock.getGPUFeatureStatus.mockReturnValue({ gpu_compositing: 'disabled' });
    expect(detectHardwareAcceleration()).toBe(false);
  });

  it('returns undefined when the platform cannot report a status', () => {
    appMock.getGPUFeatureStatus.mockImplementation(() => {
      throw new Error('gpu boom');
    });
    expect(detectHardwareAcceleration()).toBeUndefined();
  });
});
