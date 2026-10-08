import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CONTENT_SECURITY_POLICY, DEV_CONTENT_SECURITY_POLICY } from '../../../shared/csp';
import { CSP_HEADER_NAME, installContentSecurityPolicy } from '../csp';

/**
 * Captures the `onHeadersReceived` handler registered on a fake session so tests can drive it like
 * Electron does, with `(details, callback)`.
 */
function openSession(options?: { dev?: boolean }) {
  let handler: ((details: { responseHeaders?: Record<string, string[]> }, callback: (input?: unknown) => void) => void) | undefined;
  const onHeadersReceived = vi.fn((listener: typeof handler) => {
    handler = listener as typeof handler;
  });
  const cleanup = installContentSecurityPolicy(
    {
      webRequest: { onHeadersReceived },
    } as never,
    options,
  );
  return {
    onHeadersReceived,
    fire: (details: { responseHeaders?: Record<string, string[]> }) => {
      expect(handler, 'a listener must be registered').toBeDefined();
      const callback = vi.fn();
      handler!(details, callback);
      return callback;
    },
    cleanup,
  };
}

describe('installContentSecurityPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers an onHeadersReceived hook on the given session', () => {
    const { onHeadersReceived } = openSession();
    expect(onHeadersReceived).toHaveBeenCalledTimes(1);
  });

  it('injects the shared Content-Security-Policy onto every response', () => {
    const { fire } = openSession();
    const callback = fire({});
    expect(callback).toHaveBeenCalledWith({
      responseHeaders: { [CSP_HEADER_NAME]: [CONTENT_SECURITY_POLICY] },
    });
  });

  it('preserves pre-existing response headers alongside the injected policy', () => {
    const { fire } = openSession();
    const callback = fire({ responseHeaders: { 'Set-Cookie': ['a=1'] } });
    expect(callback).toHaveBeenCalledWith({
      responseHeaders: { 'Set-Cookie': ['a=1'], [CSP_HEADER_NAME]: [CONTENT_SECURITY_POLICY] },
    });
  });

  it('overrides a response that already carries a Content-Security-Policy header', () => {
    const { fire } = openSession();
    const callback = fire({ responseHeaders: { [CSP_HEADER_NAME]: ["default-src 'none'"] } });
    expect(callback).toHaveBeenCalledWith({
      responseHeaders: { [CSP_HEADER_NAME]: [CONTENT_SECURITY_POLICY] },
    });
  });

  it('returns a cleanup that detaches the hook', () => {
    const { onHeadersReceived, cleanup } = openSession();
    cleanup();
    expect(onHeadersReceived).toHaveBeenLastCalledWith(null);
  });

  it('serves the strict policy when the dev flag is absent', () => {
    const { fire } = openSession();
    expect(fire({}).mock.calls[0][0]).toEqual({
      responseHeaders: { [CSP_HEADER_NAME]: [CONTENT_SECURITY_POLICY] },
    });
    const scriptSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self'");
  });

  it('serves the dev policy when dev is true so Vite can inject its inline preamble', () => {
    const { fire } = openSession({ dev: true });
    const callback = fire({});
    expect(callback).toHaveBeenCalledWith({
      responseHeaders: { [CSP_HEADER_NAME]: [DEV_CONTENT_SECURITY_POLICY] },
    });
    expect(DEV_CONTENT_SECURITY_POLICY).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('keeps every non-script directive identical between dev and production policies', () => {
    const stripScriptSrc = (csp: string) =>
      csp
        .split(';')
        .map((part) => part.trim())
        .filter((part) => !part.startsWith('script-src'));
    expect(stripScriptSrc(DEV_CONTENT_SECURITY_POLICY)).toEqual(stripScriptSrc(CONTENT_SECURITY_POLICY));
  });
});
