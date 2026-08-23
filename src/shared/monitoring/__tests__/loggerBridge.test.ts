/**
 * @fileoverview Unit tests for the Logger -> monitoring bridge.
 * Verifies that ERROR-level log records are reported through the active
 * monitoring provider (as exceptions when an `Error` argument is present, as
 * messages otherwise), that they are suppressed before init and while consent
 * is off, and that sink failures never break logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitorProvider } from '../types';

async function loadFresh() {
  vi.resetModules();
  const svc = await import('../MonitoringService');
  const { Logger, registerLoggerErrorSink } = await import('../../logger');
  return { svc, Logger, registerLoggerErrorSink };
}

function createMockProvider(name = 'mock'): MonitorProvider & {
  captureException: ReturnType<typeof vi.fn>;
  captureMessage: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    init: vi.fn(),
    captureException: vi.fn(() => 'event-1'),
    captureMessage: vi.fn(() => 'event-2'),
    captureFeedback: vi.fn(() => 'event-3'),
    setTag: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    setEnabled: vi.fn(),
    isEnabled: vi.fn(() => true),
    flush: vi.fn(async () => true),
    close: vi.fn(async () => true),
  } as unknown as MonitorProvider & {
    captureException: ReturnType<typeof vi.fn>;
    captureMessage: ReturnType<typeof vi.fn>;
  };
}

describe('Logger error bridge', () => {
  let svc: typeof import('../MonitoringService');
  let Logger: typeof import('../../logger').Logger;
  let registerLoggerErrorSink: typeof import('../../logger').registerLoggerErrorSink;

  beforeEach(async () => {
    ({ svc, Logger, registerLoggerErrorSink } = await loadFresh());
    svc.resetMonitoringForTests();
  });

  it('forwards Logger.error to the active provider as a captured exception', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/test').error('something failed:', new Error('boom'));

    expect(provider.captureException).toHaveBeenCalledWith(new Error('boom'), {
      tags: { handler: 'logger-error' },
      extra: { loggerContext: 'main/test' },
    });
    expect(provider.captureMessage).not.toHaveBeenCalled();
  });

  it('reports non-Error records as message events with joined text', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/cli').error('CLI failed: bad input');

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).toHaveBeenCalledWith('main/cli: CLI failed: bad input', 'error', {
      tags: { handler: 'logger-error' },
      extra: { loggerContext: 'main/cli' },
    });
  });

  it('does not report while uninitialized or consent is off', async () => {
    const provider = createMockProvider();

    new Logger('main/test').error('before init');
    expect(provider.captureException).not.toHaveBeenCalled();

    await svc.initMonitoring({ enabled: false }, () => provider);
    new Logger('main/test').error('consent off');
    expect(provider.captureException).not.toHaveBeenCalled();
  });

  it('stops reporting after closeMonitoring', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);
    await svc.closeMonitoring();

    new Logger('main/test').error('after close');
    expect(provider.captureException).not.toHaveBeenCalled();
  });

  it('keeps logging working when the sink throws', async () => {
    registerLoggerErrorSink(() => {
      throw new Error('sink exploded');
    });
    expect(() => new Logger('x').error('still logged')).not.toThrow();
  });
});
