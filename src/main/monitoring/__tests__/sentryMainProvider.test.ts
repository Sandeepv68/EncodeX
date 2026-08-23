/**
 * @fileoverview Unit tests for the Sentry main-process adapter.
 * `@sentry/electron/main` and `@sentry/profiling-node` are replaced with spies
 * so the adapter's option assembly, capture delegation, consent transitions,
 * and shutdown semantics can be verified without a real backend.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sentryMainMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(() => 'exception-id'),
  captureMessage: vi.fn(() => 'message-id'),
  captureFeedback: vi.fn(() => 'feedback-id'),
  setTag: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  anrIntegration: undefined as never, // not part of the Electron SDK surface in v7
  rendererEventLoopBlockIntegration: vi.fn(() => ({ name: 'RendererEventLoopBlock' })),
  flush: vi.fn(async () => true),
  close: vi.fn(async () => true),
}));

vi.mock('@sentry/electron/main', () => sentryMainMock);
vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: () => ({ name: 'NodeProfiler' }),
}));

import { SentryMainProvider } from '../sentryMainProvider';
import type { MonitoringConfig } from '../../../shared/monitoring/types';

const baseConfig = (overrides: Partial<MonitoringConfig> = {}): MonitoringConfig => ({
  enabled: true,
  dsn: 'https://public@sentry.example/42',
  environment: 'test',
  release: 'encodex@1.0.0',
  debug: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  ...overrides,
});

describe('SentryMainProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects initialization without a DSN', async () => {
    const provider = new SentryMainProvider();
    await expect(provider.init(baseConfig({ dsn: undefined }))).rejects.toThrow(/DSN/);
    expect(sentryMainMock.init).not.toHaveBeenCalled();
    expect(provider.isEnabled()).toBe(false);
  });

  it('assembles full-feature init options and activates capturing', async () => {
    const provider = new SentryMainProvider();
    await provider.init(baseConfig({ tracesSampleRate: 0.5 }));

    expect(provider.isEnabled()).toBe(true);
    expect(sentryMainMock.init).toHaveBeenCalledTimes(1);

    const options = sentryMainMock.init.mock.calls[0][0] as Record<string, unknown>;
    expect(options.dsn).toBe('https://public@sentry.example/42');
    expect(options.environment).toBe('test');
    expect(options.release).toBe('encodex@1.0.0');
    expect(options.tracesSampleRate).toBe(0.5);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.attachScreenshot).toBe(true);
    expect(options.enableRendererProfiling).toBe(true);
    // Profiling rate present because the mocked native integration loads.
    expect(options.profilesSampleRate).toBe(1.0);

    // The integrations hook appends renderer ANR detection and the CPU profiler.
    const integrations = options.integrations as (defaults: unknown[]) => unknown[];
    expect(integrations([])).toHaveLength(2);
    expect(sentryMainMock.rendererEventLoopBlockIntegration).toHaveBeenCalledWith({ captureNativeStacktrace: true });
  });

  it('falls back to tracing-only when the profiler binding is unavailable', async () => {
    vi.doMock('@sentry/profiling-node', () => {
      throw new Error('native binding missing');
    });
    try {
      const provider = new SentryMainProvider();
      await provider.init(baseConfig());
      const options = sentryMainMock.init.mock.calls[0][0] as Record<string, unknown>;
      expect(options.profilesSampleRate).toBeUndefined();
      const integrations = options.integrations as (defaults: unknown[]) => unknown[];
      expect(integrations([])).toHaveLength(1);
    } finally {
      vi.doUnmock('@sentry/profiling-node');
    }
  });

  it('returns undefined for all captures while inactive', async () => {
    const provider = new SentryMainProvider();
    expect(provider.captureException(new Error('x'))).toBeUndefined();
    expect(provider.captureMessage('m')).toBeUndefined();
    expect(provider.captureFeedback({ message: 'f' })).toBeUndefined();
    expect(provider.setTag('k', 'v')).toBeUndefined();
    expect(await provider.flush()).toBe(true);
    expect(sentryMainMock.captureException).not.toHaveBeenCalled();
  });

  it('delegates captures with mapped context after init', async () => {
    const provider = new SentryMainProvider();
    await provider.init(baseConfig());

    const id = provider.captureException(new Error('boom'), {
      tags: { page: 'settings' },
      extra: { attempts: 2 },
      user: { id: 'u1', email: 'u@example.com' },
    });
    expect(id).toBe('exception-id');
    expect(sentryMainMock.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { page: 'settings' },
      extra: { attempts: 2 },
      user: { id: 'u1', email: 'u@example.com' },
    });

    expect(provider.captureMessage('hello', 'info')).toBe('message-id');
    expect(sentryMainMock.captureMessage).toHaveBeenCalledWith('hello', 'info', undefined);

    expect(provider.captureFeedback({ message: 'broken', name: 'Ann' })).toBe('feedback-id');
    expect(sentryMainMock.captureFeedback).toHaveBeenCalledWith({ message: 'broken', name: 'Ann', email: undefined }, undefined);
  });

  it('defaults missing message level to error', async () => {
    const provider = new SentryMainProvider();
    await provider.init(baseConfig());
    provider.captureMessage('no level');
    expect(sentryMainMock.captureMessage).toHaveBeenCalledWith('no level', 'error', undefined);
  });

  it('maps scope mutations to the SDK', async () => {
    const provider = new SentryMainProvider();
    await provider.init(baseConfig());

    provider.setTag('release-channel', 'beta');
    expect(sentryMainMock.setTag).toHaveBeenCalledWith('release-channel', 'beta');

    provider.setUser({ id: 'u9' });
    expect(sentryMainMock.setUser).toHaveBeenCalledWith({ id: 'u9' });
    provider.setUser(null);
    expect(sentryMainMock.setUser).toHaveBeenLastCalledWith(null);

    provider.addBreadcrumb({ message: 'step', category: 'ui', level: 'info', data: { n: 1 } });
    expect(sentryMainMock.addBreadcrumb).toHaveBeenCalledWith({
      message: 'step',
      category: 'ui',
      level: 'info',
      data: { n: 1 },
    });
  });

  it('flushes with the given timeout while active', async () => {
    const provider = new SentryMainProvider();
    await provider.init(baseConfig());
    await expect(provider.flush(1234)).resolves.toBe(true);
    expect(sentryMainMock.flush).toHaveBeenCalledWith(1234);
  });

  it('setEnabled(false) closes the client; re-enable re-initializes from stored config', async () => {
    const provider = new SentryMainProvider();
    const config = baseConfig();
    await provider.init(config);

    await provider.setEnabled(false);
    expect(sentryMainMock.close).toHaveBeenCalledTimes(1);
    expect(provider.isEnabled()).toBe(false);
    expect(provider.captureException(new Error('ignored'))).toBeUndefined();

    await provider.setEnabled(false); // no-op transition
    expect(sentryMainMock.close).toHaveBeenCalledTimes(1);

    await provider.setEnabled(true);
    expect(sentryMainMock.init).toHaveBeenCalledTimes(2);
    expect(sentryMainMock.init).toHaveBeenLastCalledWith(expect.objectContaining({ dsn: config.dsn }));
    expect(provider.isEnabled()).toBe(true);
  });

  it('reports false when the backend fails to close cleanly', async () => {
    sentryMainMock.close.mockResolvedValueOnce(false);
    const provider = new SentryMainProvider();
    await provider.init(baseConfig());
    await expect(provider.close()).resolves.toBe(false);
    expect(provider.isEnabled()).toBe(false);
  });
});
