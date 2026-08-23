/**
 * @fileoverview Unit tests for the Logger -> monitoring bridge.
 * Verifies that DEBUG, WARN and ERROR log records are reported through the
 * active monitoring provider (ERROR records as exceptions when an `Error`
 * argument is present, everything else as messages with mapped severities),
 * that INFO stays console-only, that records are suppressed before init and
 * while consent is off, that bridged records bypass the local console level
 * filter, and that sink failures never break logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitorProvider } from '../types';

async function loadFresh() {
  vi.resetModules();
  const svc = await import('../MonitoringService');
  const { Logger, registerLoggerSink } = await import('../../logger');
  return { svc, Logger, registerLoggerSink };
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

describe('Logger monitoring bridge', () => {
  let svc: typeof import('../MonitoringService');
  let Logger: typeof import('../../logger').Logger;
  let registerLoggerSink: typeof import('../../logger').registerLoggerSink;

  beforeEach(async () => {
    ({ svc, Logger, registerLoggerSink } = await loadFresh());
    svc.resetMonitoringForTests();
  });

  it('forwards Logger.error with an Error argument as a captured exception', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/test').error('something failed:', new Error('boom'));

    expect(provider.captureException).toHaveBeenCalledWith(new Error('boom'), {
      tags: { handler: 'logger-bridge' },
      extra: { loggerContext: 'main/test' },
    });
    expect(provider.captureMessage).not.toHaveBeenCalled();
  });

  it('reports non-Error error records as message events with joined text', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/cli').error('CLI failed: bad input');

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).toHaveBeenCalledWith('main/cli: CLI failed: bad input', 'error', {
      tags: { handler: 'logger-bridge' },
      extra: { loggerContext: 'main/cli' },
    });
  });

  it('forwards Logger.warn as a warning message event', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/queue').warn('queue backlog:', 42);

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).toHaveBeenCalledWith('main/queue: queue backlog: 42', 'warning', {
      tags: { handler: 'logger-bridge' },
      extra: { loggerContext: 'main/queue' },
    });
  });

  it('forwards warn records carrying an Error argument as messages, not exceptions', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/io').warn('retrying after:', new Error('timeout'));

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).toHaveBeenCalledWith('main/io: retrying after: Error: timeout', 'warning', {
      tags: { handler: 'logger-bridge' },
      extra: { loggerContext: 'main/io' },
    });
  });

  it('forwards Logger.debug as a debug message event', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('renderer/app').debug('state snapshot', { ready: true });

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).toHaveBeenCalledWith('renderer/app: state snapshot [object Object]', 'debug', {
      tags: { handler: 'logger-bridge' },
      extra: { loggerContext: 'renderer/app' },
    });
  });

  it('does not forward INFO records', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);

    new Logger('main/index').info('app started');

    expect(provider.captureException).not.toHaveBeenCalled();
    expect(provider.captureMessage).not.toHaveBeenCalled();
  });

  it('bridges suppressed records even when LOG_LEVEL hides their console output', async () => {
    vi.resetModules();
    process.env.LOG_LEVEL = 'ERROR';
    try {
      const freshSvc = await import('../MonitoringService');
      const { Logger: FreshLogger } = await import('../../logger');
      freshSvc.resetMonitoringForTests();

      const provider = createMockProvider();
      await freshSvc.initMonitoring({ enabled: true }, () => provider);

      new FreshLogger('main/hot-path').debug('quiet locally');

      expect(provider.captureMessage).toHaveBeenCalledWith(
        'main/hot-path: quiet locally',
        'debug',
        expect.objectContaining({ extra: { loggerContext: 'main/hot-path' } }),
      );
    } finally {
      delete process.env.LOG_LEVEL;
    }
  });

  it('does not report while uninitialized or consent is off', async () => {
    const provider = createMockProvider();

    new Logger('main/test').error('before init');
    expect(provider.captureException).not.toHaveBeenCalled();

    await svc.initMonitoring({ enabled: false }, () => provider);
    new Logger('main/test').warn('consent off');
    expect(provider.captureMessage).not.toHaveBeenCalled();
  });

  it('stops reporting after closeMonitoring', async () => {
    const provider = createMockProvider();
    await svc.initMonitoring({ enabled: true }, () => provider);
    await svc.closeMonitoring();

    new Logger('main/test').debug('after close');
    expect(provider.captureMessage).not.toHaveBeenCalled();
  });

  it('keeps logging working when the sink throws', async () => {
    registerLoggerSink(() => {
      throw new Error('sink exploded');
    });
    expect(() => new Logger('x').debug('still logged')).not.toThrow();
    expect(() => new Logger('x').warn('still logged')).not.toThrow();
    expect(() => new Logger('x').error('still logged')).not.toThrow();
  });
});
