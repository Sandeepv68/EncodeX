/**
 * @fileoverview Phase 3.4 hostile-bridge matrix at the unit tier (known
 * follow-up 7).
 *
 * `e2e/specs/hostile-bridge.spec.ts` proves the renderer survives a preload
 * bridge that fails every call, but it only runs in the one E2E session. This
 * suite reproduces the same matrix against the shared unit tier - every
 * `test:unit` CI pass - by installing {@link createHostileElectronAPI} (the
 * exact behavioural mirror of `e2e/mocks/hostile-preload.js`) over the
 * test-setup stub and rendering all 12 routed pages under each mode.
 *
 * Fidelity notes (what the unit tier cannot reproduce, and how the gap is kept
 * honest):
 *
 *  - **No real main process.** A hostile pass-through resolves a benign per
 *    method default instead of forwarding over IPC. The hostile half - the
 *    half under test - is byte-for-byte the E2E mock's semantics, and the
 *    drift guard below pins the member set to the renderer-contract stub.
 *  - **Module-scope hydration already ran.** Test module imports execute
 *    before the hostile bridge is installed, so boot-time store hydration that
 *    the E2E runs under enemy fire is exercised benignly here. The *mount-time*
 *    effects that render each route run against the hostile bridge, which is
 *    where this suite's value is.
 *
 * Assertion contract of the E2E ("no unhandled error, mounted route each
 * time") maps onto this suite as:
 *
 *  - the crash tripwire fails any `windowError`, `windowRejection`, or
 *    unhandled rejection/console fault caused by a route (declared only for
 *    React's *boundary-caught* render-throw output - see below);
 *  - per route, the container mounts content and the per-route error boundary
 *    (the same `<ErrorBoundary>` `App.tsx` wraps route elements in) never arms;
 *  - the sweep is not vacuous: `getCalls()` shows the hostile bridge was
 *    actually exercised.
 *
 * React logs every render-phase throw through `console.error` even when an
 * error boundary catches it - the real app survives such a throw via its
 * per-route boundary, exactly as in the E2E, so that specific log line is
 * declared here. The line that proves a boundary *armed* is still asserted
 * against per route (the boundary would render its fallback), and anything a
 * boundary does not contain - unhandled rejections, effect throws, genuine
 * console faults - stays fatal.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PAGE_ROUTES, renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { createHostileElectronAPI, bucketOf, HOSTILE_MODES, type HostileBridge } from '../../test-utils/hostile-api';
import { resetCapabilitiesCache } from '../hooks/useCapabilities';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';

/** The real-i18n text the default boundary fallback renders (see ErrorBoundary). */
const BOUNDARY_FALLBACK_TITLE = 'Something went wrong';

/** Every mode the E2E suite sweeps, healthy included. */
const MODES: readonly string[] = ['healthy', ...HOSTILE_MODES];

/** Wraps a page in the per-route boundary the real app provides (`App.tsx`). */
const inBoundary = (children: ReactNode): ReactNode => <ErrorBoundary>{children}</ErrorBoundary>;

/** Lets mount effects (async store loads, bridge calls) settle before asserting. */
async function settleMountEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('hostile preload: unit-tier bridge matrix (mirror of e2e/specs/hostile-bridge.spec.ts)', () => {
  let bridge: HostileBridge;
  /** The renderer-contract stub from test-setup, restored after the matrix. */
  const originalBridge: typeof window.electronAPI = window.electronAPI;
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    bridge = createHostileElectronAPI();
    // Install the hostile bridge as the renderer's `window.electronAPI` for
    // the whole matrix. Consumers read the property at call time, so flipping
    // `control.setMode` on the same object below retargets every future call
    // from already-imported modules - the same mutable-mode contract the E2E
    // mock's `__hostile` surface provides.
    window.electronAPI = bridge.api as unknown as typeof window.electronAPI;
    // jsdom implements no `Element.prototype.scrollIntoView`, and Logs's
    // follow-tail effect calls it as soon as it mounts - a harness fact, not a
    // defect. Same stub the axe and big-list suites install.
    restoreScrollIntoView = stubScrollIntoView();
    // React reports boundary-caught render throws via console.error even
    // though the boundary handles them - the shipped app's per-route boundary
    // behaves identically. The per-route "boundary never armed" assertion
    // below is what proves the page actually mounted, so this declaration
    // narrows the tripwire without weakening it.
    expectCrash('consoleError', /using the error boundary you provided/);
  });

  afterAll(() => {
    window.electronAPI = originalBridge;
    restoreScrollIntoView?.();
  });

  it('covers the declared axes (guard against a narrowing matrix)', () => {
    expect(PAGE_ROUTES).toHaveLength(12);
    expect(MODES).toEqual(['healthy', 'reject-sync', 'reject-async', 'never', 'wrong-type', 'garbage', 'partial']);
    expect(HOSTILE_MODES).toEqual(['reject-sync', 'reject-async', 'never', 'wrong-type', 'garbage', 'partial']);
  });

  it('drift guard: the hostile bridge exposes the same members as the renderer-contract stub', () => {
    const hostileMembers = bridge.control.getMembers();
    const contractMembers = Object.keys(window.electronAPI).sort();
    expect(hostileMembers, 'hostile bridge drifted from the renderer bridge contract').toEqual(contractMembers);
  });

  for (const mode of MODES) {
    it(`mode ${mode}: all twelve routes mount with no unhandled error and no armed boundary`, async () => {
      bridge.control.setMode(mode);
      bridge.control.setFailures(null);
      // Capabilities are cached at module scope (useCapabilities.ts); a prior
      // scenario's hostile or resolved probe must not leak into this one.
      resetCapabilitiesCache();

      // The app *reports* failing bridge calls (the E2E's "app reports the
      // failure" contract) as fire-and-forget `console.warn` sinks and logger
      // warnings - that reporting is what the sweep wants to observe, not fail
      // on. Unhandled errors stay entirely fatal.
      expectCrash('consoleWarn', /Bridge call "/);
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

      const observed: string[] = [];
      for (const route of PAGE_ROUTES) {
        const result = renderPage(route.name, { wrap: inBoundary });
        observed.push(`${route.path}:${window.location.hash || '<none>'}`);
        expect(result.container.textContent?.trim().length, `${mode}/${route.name} mounted nothing before effects`).toBeGreaterThan(0);
        expect(result.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);

        await settleMountEffects();

        expect(result.container.textContent?.trim().length, `${mode}/${route.name} unmounted its content after effects`).toBeGreaterThan(0);
        expect(result.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);
        result.unmount();
      }

      // Twelve distinct routes each navigated; without this the loop could
      // pass while every render was ignored and the suite sat on one page.
      expect(new Set(observed).size).toBe(PAGE_ROUTES.length);

      // The bridge must have been exercised; a sweep that never called a
      // hostile method is a sweep that proves nothing.
      expect(bridge.control.getCalls().length, `${mode} made no bridge calls at all`).toBeGreaterThan(0);
    });
  }

  it('partial mode fails some methods and succeeds at others (both branches exercised)', async () => {
    bridge.control.setMode('partial');
    bridge.control.setFailures(null);

    const members = bridge.control.getMembers();
    const checks = members.map(async (name) => {
      let succeeded = false;
      try {
        const out = bridge.api[name]();
        if (out && typeof (out as PromiseLike<unknown>).then === 'function') {
          await (out as PromiseLike<unknown>).then(
            () => {
              succeeded = true;
            },
            () => {
              succeeded = false;
            },
          );
        } else {
          succeeded = true;
        }
      } catch {
        succeeded = false;
      }
      return { name, succeeded };
    });

    const results = await Promise.all(checks);
    const failed = results.filter((entry) => !entry.succeeded);
    const passed = results.filter((entry) => entry.succeeded);

    // Deterministic 70%-bucket failures; if the mode ever failed everything or
    // nothing, the sweep would silently stop covering real partial failure.
    expect(failed.length, `only ${failed.length}/${members.length} methods failed in partial mode`).toBeGreaterThan(0);
    expect(passed.length, `only ${passed.length}/${members.length} methods passed in partial mode`).toBeGreaterThan(0);
    expect(
      failed.length,
      `partial mode failed a wrong number of methods; expected ~70% of ${members.length}, got ${failed.length}`,
    ).toBeGreaterThan(Math.floor(members.length * 0.4));
    expect(failed.length).toBeLessThanOrEqual(Math.ceil(members.length * 0.9));
  });

  it('still works after the bridge recovers', async () => {
    bridge.control.setMode('reject-async');
    bridge.control.setFailures(null);
    resetCapabilitiesCache();

    const hostileRender = renderPage('Convert', { wrap: inBoundary });
    expect(hostileRender.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);
    await settleMountEffects();
    expect(hostileRender.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);
    hostileRender.unmount();

    // Flip the same installed bridge back to healthy: a genuine round-trip to
    // a now-working bridge must succeed, as in the E2E recovery assertion.
    bridge.control.setMode('healthy');
    const recovered = renderPage('Dashboard', { wrap: inBoundary });
    expect(recovered.container.textContent?.trim().length).toBeGreaterThan(0);
    expect(recovered.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);
    await settleMountEffects();
    expect(recovered.container.textContent).not.toContain(BOUNDARY_FALLBACK_TITLE);
    recovered.unmount();

    const capability = await bridge.api.getCapabilities();
    expect(capability).toBeNull();
  });

  it('bucketOf is stable so partial failures bisect to the same calls every run', () => {
    const first = Object.keys(window.electronAPI).map((name) => bucketOf(name));
    const second = Object.keys(window.electronAPI).map((name) => bucketOf(name));
    expect(second).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(1);
  });
});
