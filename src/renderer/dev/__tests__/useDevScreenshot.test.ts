import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { toastSuccessSpy, toastErrorSpy } = vi.hoisted(() => ({
  toastSuccessSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('../../stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      success: toastSuccessSpy,
      error: toastErrorSpy,
    }),
  },
}));

vi.stubEnv('DEV', true);

import { useDevScreenshot } from '../useDevScreenshot';

describe('useDevScreenshot', () => {
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    keydownHandler = null;
    vi.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: EventListener) => {
      if (event === 'keydown') keydownHandler = handler as unknown as (event: KeyboardEvent) => void;
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
    (window.electronAPI as Record<string, unknown>).captureDevScreenshot = vi.fn().mockResolvedValue('/screenshots/dev/test.png');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderScreenshotHook() {
    return renderHook(() => useDevScreenshot());
  }

  it('registers and removes a keydown listener on mount/unmount', () => {
    const { unmount } = renderScreenshotHook();
    expect(keydownHandler).not.toBeNull();
    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('captures screenshot on Ctrl+Alt+S chord', async () => {
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(window.electronAPI.captureDevScreenshot).toHaveBeenCalledOnce();
    expect(toastSuccessSpy).toHaveBeenCalledWith('Dev screenshot saved', '/screenshots/dev/test.png');
  });

  it('ignores repeated keydown events', async () => {
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
        repeat: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(window.electronAPI.captureDevScreenshot).not.toHaveBeenCalled();
  });

  it('does not capture on wrong chord', async () => {
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(window.electronAPI.captureDevScreenshot).not.toHaveBeenCalled();
  });

  it('shows error toast when captureDevScreenshot throws', async () => {
    (window.electronAPI.captureDevScreenshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('capture failed'));
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(toastErrorSpy).toHaveBeenCalledWith('Dev screenshot failed', 'capture failed');
  });

  it('shows error when captureDevScreenshot API is unavailable', async () => {
    (window.electronAPI as Record<string, unknown>).captureDevScreenshot = undefined;
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(toastErrorSpy).toHaveBeenCalledWith('Dev screenshot failed', 'captureDevScreenshot API unavailable');
  });

  it('shows error when non-Error is thrown', async () => {
    (window.electronAPI.captureDevScreenshot as ReturnType<typeof vi.fn>).mockRejectedValue('string error');
    renderScreenshotHook();

    await act(async () => {
      keydownHandler!({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
    });

    expect(toastErrorSpy).toHaveBeenCalledWith('Dev screenshot failed', 'string error');
  });
});
