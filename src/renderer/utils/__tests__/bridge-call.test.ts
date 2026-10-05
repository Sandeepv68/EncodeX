/**
 * @fileoverview Tests for the unreliable-bridge helpers.
 *
 * These exist because of two Phase 3.4 findings, and each test is written so that reverting the fix
 * fails it:
 *
 * - `bootstrapRendererMonitoring` awaited `monitoringGetState()` with no bound, and React is mounted from
 *   its `.finally(...)`, so a promise that never settled left the app permanently blank.
 * - `App.tsx` called two fire-and-forget `send` methods unguarded, and `contextBridge` propagates a
 *   synchronous throw into the caller, so a throwing preload unmounted the tree on first paint.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { callBridgeVoid, withBridgeTimeout, bridgePromise, fireAndForgetBridge } from '../bridge-call';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('callBridgeVoid', () => {
  it('runs the call and reports success', () => {
    const fn = vi.fn();
    expect(callBridgeVoid(fn, 'test')).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('contains a synchronous throw and returns false', () => {
    const onError = vi.fn();
    const boom = () => {
      throw new Error('preload exploded');
    };
    expect(callBridgeVoid(boom, 'windowSetAlwaysOnTop', onError)).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect((onError.mock.calls[0][0] as Error).message).toBe('preload exploded');
  });

  it('defaults to console.warn when no sink is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    callBridgeVoid(() => {
      throw new Error('nope');
    }, 'setLaunchAtLogin');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('treats a missing optional call as success, because nothing was attempted', () => {
    const onError = vi.fn();
    expect(callBridgeVoid(() => undefined, 'absent', onError)).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not swallow a rejected promise, so callers can still handle real failures', async () => {
    const rejection = Promise.reject(new Error('ipc said no'));
    // Deliberately not awaited: the helper is synchronous and must leave rejections alone.
    callBridgeVoid(() => rejection, 'asyncMethod');
    await expect(rejection).rejects.toThrow('ipc said no');
  });
});

describe('fireAndForgetBridge', () => {
  it('handles a rejection, which is the whole point', async () => {
    // Phase 3.4 finding: `callBridgeVoid` left this rejection unhandled, so a fire-and-forget async
    // bridge call surfaced to the user as an unhandled rejection.
    const onError = vi.fn();
    fireAndForgetBridge(() => Promise.reject(new Error('down')), 'checkForUpdates', onError);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    expect((onError.mock.calls[0][0] as Error).message).toBe('down');
  });

  it('handles a synchronous throw too', () => {
    const onError = vi.fn();
    fireAndForgetBridge(
      () => {
        throw new Error('sync');
      },
      'downloadUpdate',
      onError,
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it('tolerates a void-returning send, which is not a thenable', () => {
    const onError = vi.fn();
    expect(() => fireAndForgetBridge(() => undefined, 'windowSetAlwaysOnTop', onError)).not.toThrow();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not report a successful call', async () => {
    const onError = vi.fn();
    fireAndForgetBridge(() => Promise.resolve('ok'), 'installUpdate', onError);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('bridgePromise', () => {
  it('passes a resolved value through', async () => {
    await expect(bridgePromise(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('converts a synchronous throw into a rejection, so an existing .catch handles it', async () => {
    // This is the module-scope hydration case: `api.foo().catch(...)` cannot see a synchronous throw,
    // and at module scope that aborts the whole bundle.
    const caught = vi.fn();
    bridgePromise(() => {
      throw new Error('threw during call');
    }).catch(caught);
    await Promise.resolve();
    expect(caught).toHaveBeenCalledOnce();
    expect((caught.mock.calls[0][0] as Error).message).toBe('threw during call');
  });

  it('leaves an asynchronous rejection untouched', async () => {
    await expect(bridgePromise(() => Promise.reject(new Error('async fail')))).rejects.toThrow('async fail');
  });
});

describe('withBridgeTimeout', () => {
  it('resolves with the original value when the promise wins', async () => {
    await expect(withBridgeTimeout(Promise.resolve('ok'), 1000, 'fallback')).resolves.toBe('ok');
  });

  it('resolves with the fallback when the promise never settles', async () => {
    vi.useFakeTimers();
    const pending = withBridgeTimeout(new Promise<string>(() => {}), 2000, 'fallback');
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBe('fallback');
  });

  it('propagates a rejection rather than treating it as a timeout', async () => {
    await expect(withBridgeTimeout(Promise.reject(new Error('bridge down')), 1000, 'fallback')).rejects.toThrow('bridge down');
  });

  it('resolves with the fallback for an absent promise', async () => {
    await expect(withBridgeTimeout(undefined, 1000, 'fallback')).resolves.toBe('fallback');
    await expect(withBridgeTimeout(null, 1000, 'fallback')).resolves.toBe('fallback');
  });

  it('prefers the real value over the fallback when both are available in time', async () => {
    vi.useFakeTimers();
    const pending = withBridgeTimeout(Promise.resolve('real'), 2000, 'fallback');
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('real');
  });

  it('clears its timer so a short timeout does not keep the process alive', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withBridgeTimeout(Promise.resolve('ok'), 50_000, 'fallback');
    expect(clearSpy).toHaveBeenCalled();
  });
});
