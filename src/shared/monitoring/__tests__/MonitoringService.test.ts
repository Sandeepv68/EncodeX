/**
 * @fileoverview Unit tests for the monitoring facade (MonitoringService).
 * Uses module resets to exercise the singleton's lifecycle: pre-init no-op
 * safety, delegation to the resolved provider, never-throw guarantees, consent
 * toggling with close/re-init semantics, and flush/close plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitorProvider, MonitorContext } from '../types';

async function loadFresh() {
  vi.resetModules();
  return import('../MonitoringService');
}

function createMockProvider(name = 'mock', overrides: Partial<MonitorProvider> = {}): MonitorProvider & { calls: string[] } {
  const provider = {
    name,
    calls: [] as string[],
    init: vi.fn(() => {
      provider.calls.push('init');
    }),
    captureException: vi.fn(() => 'event-1'),
    captureMessage: vi.fn(() => 'event-2'),
    captureFeedback: vi.fn(() => 'event-3'),
    setTag: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    setEnabled: vi.fn(),
    isEnabled: vi.fn(() => true),
    flush: vi.fn(async () => true),
    close: vi.fn(async () => {
      provider.calls.push('close');
      return true;
    }),
  } as unknown as MonitorProvider & { calls: string[] };
  return Object.assign(provider, overrides) as MonitorProvider & { calls: string[] };
}

const ctx: MonitorContext = { tags: { page: 'convert' }, extra: { file: 'a.mp4' } };

describe('MonitoringService facade', () => {
  let svc: typeof import('../MonitoringService');

  beforeEach(async () => {
    svc = await loadFresh();
    svc.resetMonitoringForTests();
  });

  it('is a safe no-op before init (no throws, undefined ids)', async () => {
    expect(svc.isMonitoringInitialized()).toBe(false);
    expect(svc.captureException(new Error('x'))).toBeUndefined();
    expect(svc.captureMessage('m')).toBeUndefined();
    expect(svc.captureUserFeedback({ message: 'f' })).toBeUndefined();
    expect(() => svc.setMonitoringTag('k', 'v')).not.toThrow();
    expect(() => svc.setMonitoringUser({ id: '1' })).not.toThrow();
    expect(() => svc.addMonitoringBreadcrumb({ message: 'b' })).not.toThrow();
    await expect(svc.flushMonitoring()).resolves.toBe(true);
    await expect(svc.closeMonitoring()).resolves.toBe(true);
    expect(svc.isMonitoringEnabled()).toBe(false);
  });

  it('falls back to noop when factory returns undefined', async () => {
    await svc.initMonitoring({ enabled: true }, () => undefined);
    expect(svc.getActiveMonitorProviderForTests().name).toBe('noop');
    expect(svc.isMonitoringInitialized()).toBe(true);
    expect(svc.captureException(new Error('x'))).toBeUndefined();
  });

  it('delegates captures and context to the active provider', async () => {
    const provider = createMockProvider('sentry');
    await svc.initMonitoring({ enabled: true }, () => provider);

    expect(svc.captureException(new Error('boom'), ctx)).toBe('event-1');
    expect(provider.captureException).toHaveBeenCalledWith(expect.any(Error), ctx);

    expect(svc.captureMessage('hello', 'warning', ctx)).toBe('event-2');
    expect(provider.captureMessage).toHaveBeenCalledWith('hello', 'warning', ctx);

    expect(svc.captureUserFeedback({ message: 'broken' }, ctx)).toBe('event-3');
    svc.setMonitoringTag('os', 'win');
    svc.setMonitoringUser({ id: 'u1' });
    svc.addMonitoringBreadcrumb({ message: 'step' });
    expect(provider.setTag).toHaveBeenCalledWith('os', 'win');
    expect(provider.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(provider.addBreadcrumb).toHaveBeenCalledWith({ message: 'step' });
  });

  it('never throws when the provider throws', async () => {
    const provider = createMockProvider('throwing', {
      captureException: () => {
        throw new Error('sdk exploded');
      },
      captureMessage: () => {
        throw new Error('sdk exploded');
      },
      captureFeedback: () => {
        throw new Error('sdk exploded');
      },
      setTag: () => {
        throw new Error('sdk exploded');
      },
      setUser: () => {
        throw new Error('sdk exploded');
      },
      addBreadcrumb: () => {
        throw new Error('sdk exploded');
      },
    });
    await svc.initMonitoring({ enabled: true }, () => provider);

    expect(svc.captureException(new Error('e'))).toBeUndefined();
    expect(svc.captureMessage('m')).toBeUndefined();
    expect(svc.captureUserFeedback({ message: 'f' })).toBeUndefined();
    expect(() => svc.setMonitoringTag('k', 'v')).not.toThrow();
    expect(() => svc.setMonitoringUser(null)).not.toThrow();
    expect(() => svc.addMonitoringBreadcrumb({})).not.toThrow();
  });

  it('survives a throwing provider factory by falling back to noop', async () => {
    await svc.initMonitoring({ enabled: true }, () => {
      throw new Error('factory failed');
    });
    expect(svc.getActiveMonitorProviderForTests().name).toBe('noop');
    expect(svc.captureException(new Error('x'))).toBeUndefined();
  });

  it('skips backend entirely when consent is disabled', async () => {
    const provider = createMockProvider('sentry');
    await svc.initMonitoring({ enabled: false }, () => provider);
    expect(provider.init).not.toHaveBeenCalled();
    expect(svc.getActiveMonitorProviderForTests().name).toBe('noop');
    expect(svc.isMonitoringEnabled()).toBe(false);
  });

  it('setEnabled(false) closes the backend and stops captures; re-enable re-inits via stored factory', async () => {
    const provider = createMockProvider('sentry');
    const factory = vi.fn(() => provider);
    await svc.initMonitoring({ enabled: true, dsn: 'https://k@sentry.io/1' }, factory);

    await svc.setMonitoringEnabled(false);
    expect(provider.close).toHaveBeenCalled();
    expect(svc.isMonitoringEnabled()).toBe(false);

    // Captures while disabled are absorbed.
    expect(svc.captureException(new Error('quiet'))).toBeUndefined();

    await svc.setMonitoringEnabled(true);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(provider.init).toHaveBeenCalledTimes(2);
    expect(svc.getActiveMonitorProviderForTests()).toBe(provider);
    expect(svc.captureException(new Error('seen'), ctx)).toBe('event-1');
  });

  it('setEnabled(true) without prior config degrades to noop-enabled', async () => {
    await svc.setMonitoringEnabled(true);
    expect(svc.getActiveMonitorProviderForTests().name).toBe('noop');
    expect(svc.captureException(new Error('x'))).toBeUndefined();
  });

  it('flush delegates to provider flush', async () => {
    const provider = createMockProvider('sentry', { flush: vi.fn(async () => true) });
    await svc.initMonitoring({ enabled: true }, () => provider);
    await expect(svc.flushMonitoring(1234)).resolves.toBe(true);
    expect(provider.flush).toHaveBeenCalledWith(1234);
  });

  it('close swaps back to disabled noop and reports provider result', async () => {
    const provider = createMockProvider('sentry');
    await svc.initMonitoring({ enabled: true }, () => provider);
    await expect(svc.closeMonitoring(500)).resolves.toBe(true);
    expect(provider.close).toHaveBeenCalledWith(500);
    expect(svc.getActiveMonitorProviderForTests().name).toBe('noop');
    expect(svc.isMonitoringInitialized()).toBe(false);
  });
});
