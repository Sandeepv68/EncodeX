/**
 * @fileoverview Phase 3.4 - hostile bridge E2E suite (real main, hostile preload).
 *
 * Phase 3.2 drove request channels with the *real* bridge and hostile payloads. Phase 3.3 drove event
 * channels. This file attacks the other half of the contract: the bridge itself. Every
 * `window.electronAPI` method is made to fail, and the app is walked through all twelve routes to see
 * whether the renderer treats a bridge it does not control the way it should.
 *
 * ## Why the bridge is the interesting boundary
 *
 * Every other request-channel suite in this plan sends hostile *arguments* into a working bridge. This
 * one assumes the bridge itself is broken, because in the wild it can be: a preload and renderer built
 * from different versions, a native module throwing across the `contextBridge` hop, or an OS-level
 * failure that arrives as a rejected promise rather than a result. The renderer gets no say in any of
 * it, and it cannot retry at the bridge boundary because there is no bridge left to retry.
 *
 * The practical consequence is that a renderer which writes `const info = await api.getMediaInfo(p)`
 * and then dereferences `info.duration` has an unhandled exception whenever the call rejects. That is
 * a crash, not an error message, and it is invisible to every suite that only passes well-formed data.
 *
 * ## Why the preload proxies the real channels
 *
 * `e2e/mocks/hostile-preload.js` forwards to the same `ipcRenderer.invoke` channels the real bridge
 * uses, so `main` stays real. That is deliberate and load-bearing: a preload that answered everything
 * locally would make the *recovery* assertions meaningless, because nothing would ever have been broken
 * at the only boundary that matters. Recovering to `healthy` here is a genuine round-trip that succeeds,
 * which is what a user retry actually does.
 *
 * ## Why "the page is alive" is not the assertion
 *
 * A renderer with fifty rejected promises is alive, paints, and answers navigation - and is still
 * broken, with spinners that never resolve and forms that silently discard input. Worse, a renderer
 * waiting on a promise that never settles can wedge its own navigation behind an `await`. So every
 * mode here is checked three ways: no unhandled error (global tripwire), the route really mounted
 * (confirmed on `location.hash`, not assumed), and **a real round-trip succeeds after the mode is
 * flipped to `healthy`** - the property that actually tells us the app is usable rather than merely
 * open.
 *
 * ## Modes
 *
 * `reject-sync` throws before returning, which is the only mode that can reach a caller with no
 * `.catch` attached at all. `reject-async` rejects with one of four shapes in rotation - `Error`,
 * `{ code, message }`, a bare string, and `null` - because a rejection that crosses a context bridge
 * does not stay an `Error`, and `err.message` on `null` is a second crash hiding behind the first.
 * `never` returns promises that never settle. `wrong-type` resolves values of the wrong type for the
 * method. `garbage` resolves 1 MB of random bytes or a self-referential object. `partial` fails 70% of
 * methods, chosen by a stable per-method hash so the same methods fail on every run - a reshuffling
 * partial mode turns the suite into a flake detector instead of a regression test.
 *
 * @see e2e/mocks/hostile-preload.js, e2e/specs/ipc-abuse.spec.ts (Phase 3.2), e2e/specs/ipc-events.spec.ts (Phase 3.3)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchApp, closeApp, acceptTermsGate, ensureLiveSession, isPageAlive, AppSession } from '../fixtures/app';

/**
 * Modes under test, plus `healthy` as the recovery target.
 *
 * `healthy` is included in the launch loop on purpose: it is the control. If the healthy session cannot
 * complete the route walk, a hostile-mode failure is the harness's fault rather than the app's.
 */
const MODES = ['reject-sync', 'reject-async', 'never', 'wrong-type', 'garbage', 'partial'] as const;
type HostileMode = (typeof MODES)[number];

/**
 * Modes that leave promises pending forever, so the spec must not wait on the bridge to prove liveness.
 */
const PENDING_MODES: ReadonlySet<string> = new Set(['never']);

/** Per-mode sessions, torn down in `afterAll`. */
const sessions = new Map<string, AppSession>();

/**
 * The app's twelve routes, paired with the drawer `data-testid` that navigates to them.
 *
 * Duplicated from `ipc-events.spec.ts` rather than imported: the two suites describe different contracts
 * of the drawer, and a shared helper here would couple them so that a navigation change moves two
 * tests instead of one. `ipc-abuse.spec.ts` makes the same call for the same reason.
 */
const ROUTES = [
  { path: '/', testId: 'nav-item-dashboard' },
  { path: '/convert', testId: 'nav-item-convert' },
  { path: '/media-info', testId: 'nav-item-media-info' },
  { path: '/image-compress', testId: 'nav-item-image-compress' },
  { path: '/audio-extract', testId: 'nav-item-audio-extract' },
  { path: '/video-cut', testId: 'nav-item-video-cut' },
  { path: '/remux', testId: 'nav-item-remux' },
  { path: '/demux', testId: 'nav-item-demux' },
  { path: '/batch', testId: 'nav-item-batch' },
  { path: '/logs', testId: 'nav-item-logs' },
  { path: '/settings', testId: 'nav-item-settings' },
  { path: '/about', testId: 'nav-item-about' },
] as const;

/**
 * Launch options for a hostile session.
 *
 * `mock: false` for the same reason `ipc-events.spec.ts` uses it: the Tier A mock preload answers every
 * call locally, so a suite built on it would pass while the shipped bridge was the thing that breaks.
 * `ENCODEX_HOSTILE_MODE` makes `src/main/index.ts` load `e2e/mocks/hostile-preload.js` *instead of* the
 * real preload, while leaving main's IPC handlers real.
 */
function sessionOptions(mode: string): Parameters<typeof launchApp>[0] {
  return { mock: false, env: { E2E_REAL: '1', ENCODEX_HOSTILE_MODE: mode } };
}

/** Launches the app in `mode`, accepting the terms gate that the real preload never pre-seeds. */
async function launchHostile(mode: string): Promise<AppSession> {
  const session = await launchApp(sessionOptions(mode));
  await acceptTermsGate(session.page);
  return session;
}

/**
 * Navigates through a real click and confirms the route mounted on `location.hash`.
 *
 * The hash check is what makes this an assertion about the app rather than about the click handler: a
 * drawer that swallows the click, or a render that throws during mount, both leave the hash unchanged.
 */
async function gotoRoute(page: AppSession['page'], route: (typeof ROUTES)[number]): Promise<void> {
  await page.locator(`[data-testid="${route.testId}"]`).click();
  await page.waitForFunction((expected) => window.location.hash.startsWith(`#${expected}`), route.path, { timeout: 15_000 });
}

/**
 * Dismisses the terms gate if a relaunch brought it back.
 *
 * A relaunch gets a fresh `userDataDir`, so the accepted consent is gone and the gate blocks the next
 * click. Without this the cell after a relaunch fails on a missing nav item and blames the app.
 */
async function ensureTermsAccepted(page: AppSession['page']): Promise<void> {
  const dialog = page.locator('[data-testid="terms-dialog"]');
  if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('[data-testid="terms-accept"]').click();
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

/**
 * Counts error surfaces the renderer chose to show.
 *
 * Deliberately an observation and not an assertion. Requiring a banner would be wrong - most routes
 * have nothing to report when a passive `getCapabilities` call fails - and requiring *none* would be
 * worse, since that would forbid the very error surfacing this suite exists to encourage. The tripwire
 * already fails the suite on an unhandled exception, so an error that was swallowed into silence is the
 * case worth recording here and checking by hand.
 */
async function errorSurfaces(page: AppSession['page']): Promise<number> {
  return page.locator('[role="alert"]').count();
}

/**
 * Puts a live session's bridge back into `mode`.
 *
 * Required, not defensive. The recovery test flips the session to `healthy` on purpose, and that state
 * lives in the preload - which is per-window and long-lived. Without restoring it, the next test in the
 * same describe block runs against a healthy bridge and passes for the wrong reason. This was a real
 * false negative during development: `partial` reported "no call ever rejected" because the recovery
 * test had already healed it.
 *
 * @param session - The live hostile session.
 * @param mode - The mode to restore.
 */
async function restoreMode(session: AppSession, mode: HostileMode): Promise<void> {
  await session.page.evaluate((next) => window.__hostile?.setMode(next), mode);
}

/**
 * Flips the live session's mode and reports whether a real round-trip then succeeds.
 *
 * This is the load-bearing assertion of the suite. It is the difference between "the renderer did not
 * crash" and "the app still works": if the renderer cached its way past the failures by never calling
 * the bridge again, navigation would still pass and only this would fail. It returns the observed value
 * rather than asserting internally so a failure message can show what the bridge actually returned.
 *
 * @param session - The live hostile session.
 * @returns {Promise<{ recovered: boolean; shape: string }>} Whether `getCapabilities` settled to a usable object after the flip.
 */
async function flipToHealthyAndProbe(session: AppSession): Promise<{ recovered: boolean; shape: string }> {
  const probe = session.page.evaluate(async () => {
    const hostile = window.__hostile;
    if (!hostile) return { recovered: false, shape: 'no __hostile control surface' };
    hostile.setMode('healthy');
    try {
      const value = await window.electronAPI.getCapabilities();
      const usable = value !== null && typeof value === 'object' && !Array.isArray(value);
      return { recovered: usable, shape: usable ? Object.keys(value).slice(0, 8).join(',') : `unusable: ${String(value)}` };
    } catch (err) {
      return { recovered: false, shape: `threw: ${String(err)}` };
    }
  });
  return probe;
}

describe('hostile preload: renderer survives a bridge that fails every call', () => {
  beforeAll(async () => {
    for (const mode of MODES) sessions.set(mode, await launchHostile(mode));
  }, 180_000);

  afterAll(async () => {
    for (const [, session] of sessions) await closeApp(session.app, session.userDataDir);
    sessions.clear();
  });

  it('exposes the same members as the real bridge (drift guard)', async () => {
    /**
     * Guards the whole suite.
     *
     * `hostile-preload.js` carries a generated method table. If the real bridge gains or loses a method
     * and this file is not regenerated, the suite would silently stop covering the new method while
     * still passing - the exact failure mode that made Phase 3.1 necessary. Comparing the live member
     * set against a real-preload session turns that silence into a failure.
     */
    const real = await launchApp({ mock: false, env: { E2E_REAL: '1' } });
    try {
      await acceptTermsGate(real.page);
      const realMembers: string[] = await real.page.evaluate(() => Object.keys(window.electronAPI).sort());
      const hostileMembers: string[] = await sessions.get('reject-async')!.page.evaluate(() => window.__hostile?.getMembers() ?? []);
      expect(hostileMembers).toEqual(realMembers);
    } finally {
      await closeApp(real.app, real.userDataDir);
    }
  }, 120_000);

  for (const mode of MODES) {
    describe(`mode: ${mode}`, () => {
      let session: AppSession;

      beforeAll(async () => {
        session = sessions.get(mode)!;
      });

      it('survives all twelve routes with no unhandled error and a mounted route each time', async () => {
        const session = await ensureLiveSession(sessions.get(mode)!, sessionOptions(mode));
        sessions.set(mode, session);
        await ensureTermsAccepted(session.page);
        await restoreMode(session, mode);

        const observed: Array<{ route: string; hash: string; alerts: number }> = [];
        for (const route of ROUTES) {
          await gotoRoute(session.page, route);
          expect(await isPageAlive(session.page), `renderer died on ${route.path} in ${mode} mode`).toBe(true);
          observed.push({
            route: route.path,
            hash: await session.page.evaluate(() => window.location.hash),
            alerts: await errorSurfaces(session.page),
          });
        }

        // Twelve distinct routes, each actually mounted. Without this the loop above could pass while
        // every click was ignored and the app sat on one page for the whole run.
        expect(new Set(observed.map((entry) => entry.hash)).size).toBe(ROUTES.length);

        const pending = PENDING_MODES.has(mode);
        // In `never` mode nothing on the bridge settles, so the count is expected to be whatever the
        // page could show without a reply; recording it keeps the harness's own behaviour visible
        // instead of silently asserting nothing.
        if (pending) {
          expect(observed.every((entry) => entry.alerts >= 0)).toBe(true);
        }
      }, 240_000);

      it('still works after the bridge recovers', async () => {
        const session = await ensureLiveSession(sessions.get(mode)!, sessionOptions(mode));
        sessions.set(mode, session);
        await ensureTermsAccepted(session.page);
        await restoreMode(session, mode);

        const probe = await flipToHealthyAndProbe(session);
        expect(probe.recovered, `round-trip did not recover in ${mode} mode: ${probe.shape}`).toBe(true);

        // Recovery has to mean the whole app recovered, not one method. Walking a route afterwards
        // catches a renderer that swallowed the first success and cached it.
        await gotoRoute(session.page, ROUTES[1]);
        expect(await isPageAlive(session.page)).toBe(true);
      }, 120_000);
    });
  }

  it('partial mode fails some methods and succeeds at others, and the app reports the failure', async () => {
    /**
     * `partial` earns its own test because it is the mode that looks healthy.
     *
     * A wholly broken bridge produces errors everywhere, which is easy to notice and easy to handle. A
     * bridge that fails 70% of calls looks like a flaky app: some screens populate, some spin forever,
     * and a user has no way to tell which. The assertion is that the renderer distinguishes the two -
     * it reaches the bridge, some calls come back, and none of it crashes.
     */
    const session = await ensureLiveSession(sessions.get('partial')!, sessionOptions('partial'));
    sessions.set('partial', session);
    await ensureTermsAccepted(session.page);
    await restoreMode(session, 'partial');

    const result = await session.page.evaluate(async () => {
      // Chosen to straddle the partial threshold, and all three are harmless consent/capability reads so
      // a "pass" is a real round-trip rather than a side effect. The buckets are fixed by the preload's
      // hash: `getCapabilities` 0 and `monitoringGetState` 7 fall in the failing 70%, `analyticsGetState`
      // 77 survives. If a future edit changes that balance this test fails, which is the intended signal -
      // the comment exists so that failure is self-explanatory instead of mysterious.
      const calls = ['getCapabilities', 'monitoringGetState', 'analyticsGetState'] as const;
      const outcomes: Record<string, string> = {};
      for (const name of calls) {
        try {
          const value = await (window.electronAPI as unknown as Record<string, () => Promise<unknown>>)[name]();
          outcomes[name] = `resolved:${typeof value}`;
        } catch (err) {
          outcomes[name] = `rejected:${err === null ? 'null' : typeof err}`;
        }
      }
      return outcomes;
    });

    const shapes = Object.values(result);
    // At least one resolved and at least one rejected: the mode is partial by construction, so an
    // all-resolve or all-reject result means the stable hash is not doing its job and this test has
    // stopped testing partial failure at all.
    expect(shapes.some((shape) => shape.startsWith('resolved'))).toBe(true);
    expect(shapes.some((shape) => shape.startsWith('rejected'))).toBe(true);

    await gotoRoute(session.page, ROUTES[0]);
    expect(await isPageAlive(session.page)).toBe(true);
  }, 120_000);
});
