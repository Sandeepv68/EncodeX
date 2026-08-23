/**
 * @fileoverview Unit tests for the no-op monitoring provider.
 * Verifies that every capture surface discards its input, that consent
 * bookkeeping works, and that init never throws regardless of configuration.
 */

import { describe, it, expect } from 'vitest';
import { NoopProvider } from '../noopProvider';
import type { MonitorProvider } from '../types';

describe('NoopProvider', () => {
  const baseConfig = {
    enabled: true,
    dsn: 'https://example@sentry.example/1',
    environment: 'test',
    release: 'encodex@test',
    debug: false,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  };

  it('reports itself as the "noop" backend', () => {
    const provider: MonitorProvider = new NoopProvider();
    expect(provider.name).toBe('noop');
  });

  it('starts disabled by default', () => {
    expect(new NoopProvider().isEnabled()).toBe(false);
  });

  it('accepts init without throwing and stays inert', () => {
    const provider = new NoopProvider();
    expect(() => provider.init(baseConfig)).not.toThrow();
    expect(provider.isEnabled()).toBe(false);
  });

  it('discards all capture calls and never yields event ids', () => {
    const provider = new NoopProvider(true);
    expect(provider.captureException(new Error('boom'))).toBeUndefined();
    expect(provider.captureMessage('hello', 'info', { tags: { a: 'b' }, extra: { c: 1 } })).toBeUndefined();
    expect(provider.captureFeedback({ message: 'broken' })).toBeUndefined();
  });

  it('ignores scope mutations', () => {
    const provider = new NoopProvider();
    expect(() => {
      provider.setTag('k', 'v');
      provider.setUser({ id: 'u1' });
      provider.addBreadcrumb({ message: 'step', category: 'ui' });
    }).not.toThrow();
  });

  it('records requested consent while still capturing nothing', () => {
    const provider = new NoopProvider();
    provider.setEnabled(true);
    expect(provider.isEnabled()).toBe(true);
    expect(provider.captureException(new Error('still ignored'))).toBeUndefined();
    provider.setEnabled(false);
    expect(provider.isEnabled()).toBe(false);
  });
});
