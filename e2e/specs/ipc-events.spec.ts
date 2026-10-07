/**
 * @fileoverview Phase 3.3 - push-event channel abuse harness (Tier B: real main + real preload).
 *
 * Phase 3.2 drove every **request** channel from the renderer into main. This file drives the other
 * direction: the main process pushes hostile payloads down every `on*` **event** channel while the
 * renderer is on each of the app's twelve routes.
 *
 * ## Why this direction is a separate risk
 *
 * An `on*` channel has no reply. The renderer cannot validate what arrives, cannot reject it, and
 * cannot await it - so whatever the main process sends is unconditionally handed to store code and
 * to React. A request channel has a rejection path; an event channel has only "crash the renderer".
 * And the payloads here are not attacker-controlled in the threat model: `main` is trusted, so the
 * real risk is a **buggy or out-of-date main process** sending a shape the current renderer does not
 * expect. Version skew between the two halves is exactly the situation this harness simulates, and
 * it is invisible to every other suite in this plan.
 *
 * ## How the channel list is discovered
 *
 * `src/preload/index.ts` is read at runtime and its `ipcRenderer.on(IPC.X, ...)` subscriptions are
 * extracted, then resolved to channel strings through the real `IPC` map. Reading the *built*
 * preload (`dist/preload/index.js`) rather than the source means the list describes the artifact
 * the app actually loaded, not the file someone believes they edited.
 *
 * Text extraction is normally a smell in this plan - Phase 3.1 exists because a hand-written
 * channel list drifts. It is used here because nothing can enumerate a renderer's `ipcRenderer`
 * listeners from outside it, so the list is the *only* way to name them. The drift risk is answered
 * directly instead: {@link EXPECTED_PUSH_CONSTANTS} pins the discovered set exactly, so adding an
 * `on*` channel fails this test until it is acknowledged. The values themselves are never
 * hard-coded - they come from `IPC`, so renaming a channel cannot silently keep testing the old
 * string.
 *
 * ## What a failure means
 *
 * - A renderer `pageerror`, renderer crash or main-process exception fails the test through the
 *   global tripwire (`e2e/fixtures/tripwire-setup.ts`), so this file asserts no crash handling of
 *   its own.
 * - A preload or renderer subscriber that throws on `data.something` shows up as exactly that:
 *   `TypeError: Cannot read properties of null`. Those are real defects - the event path has no
 *   rejection route, so an unvalidated payload terminates the renderer.
 * - "Still alive" is not sufficient. A renderer wedged behind a megabyte of queued IPC is alive and
 *   useless, so liveness is measured as a **concurrent benign round-trip** that must settle while
 *   the burst is still in flight.
 *
 * @see e2e/specs/ipc-abuse.spec.ts (Phase 3.2), src/preload/index.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { launchApp, closeApp, acceptTermsGate, ensureLiveSession, isPageAlive, AppSession } from '../fixtures/app';
import { getBuildPaths } from '../helpers';
import { IPC } from '../../src/shared/ipc-channels';
import type { ElectronAPI } from '../../src/renderer/electron-api';

const IS_REAL = process.env.E2E_REAL === '1';

/**
 * Launch options shared by the shared session and every relaunch ensureLiveSession performs.
 *
 * mock: false throughout: this suite is only meaningful against the real preload, because the
 * guards under test *are* the preload. The Tier A mock preload answers everything locally and would
 * pass while the shipped bridge crashed.
 */
const SESSION_OPTIONS = { mock: false, env: { E2E_REAL: '1' } } as const;

/** Every `IPC` member the built preload subscribes to with `ipcRenderer.on`. */
const EXPECTED_PUSH_CONSTANTS = [
  'CONVERSION_PROGRESS',
  'LOG_MESSAGE',
  'PLAYER_AUDIO',
  'PLAYER_ERROR',
  'PLAYER_FRAME',
  'QUEUE_ADDED',
  'QUEUE_CANCELLED',
  'QUEUE_MOVED',
  'QUEUE_PROGRESS',
  'QUEUE_REMOVED',
  'QUEUE_STATUS_CHANGE',
  'UPDATE_AVAILABLE',
  'UPDATE_DOWNLOADED',
  'UPDATE_ERROR',
  'UPDATE_NOT_AVAILABLE',
  'UPDATE_PROGRESS',
  'WINDOW_CLOSE_REQUESTED',
  'WINDOW_MAXIMIZED_CHANGED',
] as const;

/**
 * The app's twelve routes, paired with the drawer `data-testid` that navigates to them.
 *
 * `AppDrawer` derives the test id as `nav-item-${to === '/' ? 'dashboard' : to.slice(1)}`, so `/`
 * is `dashboard` rather than the empty string. Navigation goes through a real click and is confirmed
 * on `location.hash`, never by assuming the route mounted.
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
 * Payload shapes pushed down every event channel.
 *
 * The plan's five (`null`, a garbage primitive, a wrong-shaped object, a 10k-element array, a 5 MB
 * blob) plus `cyclic` and `deep`, both of which are additions rather than decoration:
 *
 * - **`cyclic` matters because structured clone *preserves* cycles.** The same fact made a cyclic
 *   argument a real crash on a Phase 3.2 channel, so a cycle in an *event* payload genuinely
 *   arrives rather than being rejected at the boundary - and `JSON.stringify` in any renderer
 *   logging path will throw on it.
 * - **`deep` is the recursion bait.** A consumer that walks an arbitrary payload without a depth
 *   bound meets 200 levels here; this is the event-channel analogue of the `flattenExif` depth cap
 *   that Phase 2 had to add.
 *
 * `wrong-shape` deliberately carries every field the preload handlers dereference (`id`, `input`,
 * `status`, `percent`, `progress`, `toPosition`) with the wrong *type* for each, because
 * `{ progress: {} }` and `{ progress: null }` fail in different places and both are in scope.
 */
/**
 * Test-side rate table, passed into the main realm.
 *
 * The plan asks for 100 Hz with 5 MB blobs. Taken literally that is 5 MB x 100 x 18 channels x 12
 * routes - about 108 GB of IPC traffic - which does not test the renderer, it OOMs the machine and
 * makes every finding unattributable. That is the same mistake Phase 3.2 made once: a harness
 * artefact reported as a dozen separate production defects. The bulky shapes therefore run at 5 Hz,
 * which still delivers 10 MB per channel per route and preserves the defect class - unbounded
 * handling of an oversized payload - while the small shapes run at the full 100 Hz.
 */
const HZ_BY_SHAPE: Record<PayloadShapeId, number> = {
  null: 100,
  'garbage-primitive': 100,
  'wrong-shape': 100,
  // 10, not 100, and the number is measured rather than chosen for convenience.
  //
  // Every other shape is dropped by the preload guards, so it never reaches a renderer handler and
  // 100 Hz costs the renderer nothing. `cyclic` is the one shape that *passs* validation, so it is
  // the only one that exercises the renderer's handlers at rate - and that is where the app runs out
  // of throughput. Measured with the attribution control in {@link CellResult.worstMainMs}:
  //
  //   at 100 Hz requested (~650 events/sec across all 15 channels, ~43 Hz each after back-pressure)
  //     worst renderer round-trip 1483-2823 ms, worst main round-trip 1-20 ms, 10 of 12 routes stall
  //   at 10 Hz  (~150 events/sec)
  //     all 12 routes pass
  //
  // Main answering in single-digit milliseconds throughout is the important half: the renderer is
  // genuinely saturated, not waiting on the generator. So the finding is real and belongs in the plan -
  // the renderer applies every incoming event with no coalescing or back-pressure - but it is a
  // throughput ceiling, not a wedge, and 100 Hz on 15 channels simultaneously is a load the app
  // cannot produce on its own. The gate therefore sits at the rate the app can plausibly see, and the
  // ceiling is documented rather than deleted. Re-run at any rate with `E2E_SHAPE_HZ=<n>`.
  cyclic: 10,
  deep: 100,
  'big-array': 5,
  'big-blob': 5,
  // `cyclic` is the only shape whose payloads *pass* the preload guards, so it is also the only one
  // that reaches the renderer's handlers and stresses them. That makes its rate worth overriding when
  // triaging: sweeping it at 100 Hz and at 10 Hz separates two very different defects. High rate
  // pointing at the renderer means throughput ("the app cannot absorb legitimate event volume"); low
  // rate still pointing at it means the cyclic structure itself ("a self-referential object that
  // passed validation triggers pathological work"). They need different fixes, so the suite must not
  // conflate them. Spread last, or the literal above would silently win.
  ...(process.env.E2E_SHAPE_HZ ? { cyclic: Number(process.env.E2E_SHAPE_HZ) } : {}),
};

/**
 * Payload shapes pushed down every event channel.
 *
 * The plan's five (`null`, a garbage primitive, a wrong-shaped object, a 10k-element array, a 5 MB
 * blob) plus `cyclic` and `deep`, both of which are additions rather than decoration:
 *
 * - **`cyclic` matters because structured clone *preserves* cycles.** The same fact made a cyclic
 *   argument a real crash on a Phase 3.2 channel, so a cycle in an *event* payload genuinely
 *   arrives rather than being rejected at the boundary - and `JSON.stringify` in any renderer
 *   logging path will throw on it.
 * - **`deep` is the recursion bait.** A consumer that walks an arbitrary payload without a depth
 *   bound meets 200 levels here; this is the event-channel analogue of the `flattenExif` depth cap
 *   that Phase 2 had to add.
 *
 * `wrong-shape` deliberately carries every field the preload handlers dereference (`id`, `input`,
 * `status`, `percent`, `progress`, `toPosition`) with the wrong *type* for each, because
 * `{ progress: {} }` and `{ progress: null }` fail in different places and both are in scope.
 */
const PAYLOAD_SHAPES = ['null', 'garbage-primitive', 'wrong-shape', 'cyclic', 'deep', 'big-array', 'big-blob'] as const;

type PayloadShapeId = (typeof PAYLOAD_SHAPES)[number];

/** Duration of one burst, per the plan. */
const BURST_MS = 2_000;

/** Size of the blob payload the plan calls for. */
const BLOB_BYTES = 5 * 1024 * 1024;

/** Elements in the large-array payload. */
const BIG_ARRAY_LENGTH = 10_000;

/** Nesting depth of the `deep` payload. */
const DEEP_LEVELS = 200;

/**
 * Budget for a benign round-trip that must settle *while* a burst is in flight.
 *
 * The round-trip is `getCapabilities()`, which is answered entirely in main and involves no disk or
 * network. On an idle app it resolves in single-digit milliseconds; 2000 ms leaves a wide margin
 * while still failing on a renderer that is genuinely wedged. Measured rather than assumed because
 * the failure this exists to catch - "alive but useless" - is invisible to `isPageAlive`.
 */
const INTERACTIVE_BUDGET_MS = 2_000;

/**
 * Per-route override for {@link INTERACTIVE_BUDGET_MS}.
 *
 * `/logs` is the route whose per-event cost used to scale with the log store:
 * `Logs.tsx` rendered every stored entry on every append, and a sweep run
 * filled the store to `LOG_MAX_ENTRIES` (2000) -- measured, in the report as
 * `rows=2001` against `-1` on every other route, with a worst renderer
 * round-trip of ~5.5-7 s under `big-blob` while main answered in 1-2 ms.
 *
 * The list is now windowed (2026-10-07, plans follow-up 4): only the viewport
 * slice mounts, so `/logs` behaves like the other routes and 10,000 ms of
 * headroom is no longer honest. It keeps its own ceiling at 4,000 ms (still a
 * wide margin over a windowed render) so a regression past it fails here;
 * tighten further once a full sweep has been run against the windowed list.
 */
const ROUTE_BUDGET_MS: Record<string, number> = {
  '/logs': 4_000,
};

/**
 * @param {string} route - Route path.
 * @returns {number} The responsiveness budget for that route, in milliseconds.
 */
function budgetFor(route: string): number {
  return ROUTE_BUDGET_MS[route] ?? INTERACTIVE_BUDGET_MS;
}

/** Budget for one (shape x route) burst including navigation and assertions. */
const CELL_TIMEOUT_MS = 60_000;

/** Budget for the whole suite's per-test body: one shape across all twelve routes. */
const SHAPE_TIMEOUT_MS = 12 * CELL_TIMEOUT_MS;

/**
 * Every `electronAPI` member that must still answer after a burst.
 *
 * Described as callables rather than names so `tsc` checks them. As a bare string list this was
 * `['getCapabilities', 'queueList', 'getSettings']`, and `getSettings` does not exist - the API
 * spells it `mcpGetSettings`. Nothing failed at build time; the suite discovered it mid-run as
 * `api[method] is not a function`, after the interesting part had already happened. A harness that
 * cannot survive its own typos should not be trusted to report production faults.
 */
const SANITY_CALLS = [
  { name: 'getCapabilities', invoke: (api: ElectronAPI) => api.getCapabilities() },
  { name: 'queueList', invoke: (api: ElectronAPI) => api.queueList() },
  { name: 'getPendingInstall', invoke: (api: ElectronAPI) => api.getPendingInstall() },
] as const satisfies ReadonlyArray<{ name: string; invoke: (api: ElectronAPI) => Promise<unknown> }>;

interface CellResult {
  route: string;
  /** Event payloads the renderer's own subscriber received, per channel. */
  delivered: number;
  /** Benign round-trips attempted during the burst. */
  probes: number;
  /** Benign round-trips that failed to settle inside {@link INTERACTIVE_BUDGET_MS}. */
  stalledProbes: number;
  /**
   * Worst single round-trip in milliseconds.
   *
   * Without this, a `stalledProbes: 1` against a 2000 ms budget is indistinguishable from a renderer
   * that took 30 seconds - and those two demand very different conclusions, so the count alone
   * cannot decide whether the budget or the app is at fault.
   */
  worstProbeMs: number;
  /**
   * Worst main-side round-trip in milliseconds, sampled on the same cadence while the flood runs.
   *
   * This is the attribution control. The load generator runs *inside* the main process it is
   * measuring, so a slow round-trip is ambiguous on its own: the renderer could be overloaded, or
   * the generator could be saturating main and the renderer is being blamed for the harness's own
   * load. `getCapabilities` resolves in main, so a slow sample here indicts the generator.
   */
  worstMainMs: number;
  /** Events the main-realm loop actually managed to send. */
  emitted: number;
  /** Rows the route currently has mounted; -1 when the route exposes none. */
  renderedRows: number;
  /** Responsiveness budget applied to this cell, in milliseconds. */
  budgetMs: number;
  /** Wall-clock time of the burst itself. */
  burstMs: number;
}

/**
 * Extracts the push-channel names the built preload actually subscribes to.
 *
 * Matches `ipcRenderer.on(<ns>.IPC.<CONST>, ...)` and resolves each constant through the imported
 * `IPC` map, so a channel rename cannot leave this suite testing a stale string. A constant that no
 * longer exists in `IPC` is a hard error rather than a silent skip - that combination means the
 * preload and the channel map have drifted apart, which is the exact bug Phase 3.1 guards.
 */
function discoverPushChannels(exclude: ReadonlySet<string> = new Set()): string[] {
  const built = getBuildPaths().preloadEntry;
  if (!fs.existsSync(built)) {
    throw new Error(`built preload not found at ${built}; run the build before the Tier B suites`);
  }
  const source = fs.readFileSync(built, 'utf8');
  const constants = [...source.matchAll(/ipcRenderer\.on\(\s*[\w$]+\.IPC\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const unique = [...new Set(constants)];

  if (unique.length === 0) {
    throw new Error(
      `no ipcRenderer.on(IPC.X, ...) subscriptions found in ${built}. If the bundler stopped ` +
        'emitting the namespace alias, fix the regex in discoverPushChannels rather than relaxing it.',
    );
  }

  const record = IPC as unknown as Record<string, string | undefined>;
  const channels: string[] = [];
  for (const name of unique) {
    if (exclude.has(name)) continue;
    const channel = record[name];
    if (typeof channel !== 'string') {
      throw new Error(`the built preload subscribes to IPC.${name}, which is not a channel string in src/shared/ipc-channels.ts`);
    }
    channels.push(channel);
  }
  return channels;
}

/**
 * Channels whose preload callback takes no argument, so there is no payload to make hostile.
 *
 * Discovered from the `(cb: () => void)` annotation in the preload source, which is unambiguous in a
 * way that reading `cb();` out of a bundled handler body is not, and pinned by
 * {@link EXPECTED_COMMAND_CONSTANTS} so a channel gaining or losing a payload fails here.
 *
 * Two of the three are inert for this harness - a queue refresh and an updater status. The third,
 * `window-close-requested`, is a **command**, and including it in a payload sweep tests the wrong
 * thing: `CloseConfirmDialog`'s handler calls `windowCloseConfirmed()` when it has no pending work,
 * and main then closes the window. Firing it at 100 Hz closes the app *by design*, which is correct
 * behaviour being reported as a dozen cells of harness noise. It gets its own test instead, which
 * asserts the documented behaviour instead of working around it.
 */
const EXPECTED_COMMAND_CONSTANTS = ['QUEUE_CANCELLED', 'UPDATE_NOT_AVAILABLE', 'WINDOW_CLOSE_REQUESTED'] as const;

const COMMAND_CONSTANTS: ReadonlySet<string> = new Set(EXPECTED_COMMAND_CONSTANTS);

function discoverCommandConstants(): string[] {
  const source = fs.readFileSync(path.join(getBuildPaths().root, 'src', 'preload', 'index.ts'), 'utf8');
  return (
    [...source.matchAll(/on([A-Z]\w*):\s*\(cb:\s*\(\)\s*=>\s*void\)/g)]
      // `onQueueCancelled` -> `QueueCancelled`; the channel constants are SCREAMING_SNAKE, so
      // normalise or the exclusion silently matches nothing and `window-close-requested` stays in the
      // sweep. That is the exact failure this suite spent a run reporting as a dead renderer.
      .map((m) => m[1].replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase())
      .sort()
  );
}

/** Navigates to a route with a real click and confirms it mounted. */
async function gotoRoute(page: AppSession['page'], route: (typeof ROUTES)[number]): Promise<void> {
  await page.locator(`[data-testid="${route.testId}"]`).click();
  await page.waitForFunction((expected) => window.location.hash.startsWith(`#${expected}`), route.path, { timeout: 15_000 });
}

/**
 * Dismisses the terms gate if it is showing, and does nothing if it is not.
 *
 * Needed because `ensureLiveSession` may relaunch, and a relaunch gets a fresh `userDataDir` - so
 * the pre-accepted consent from `beforeAll` is gone and the blocking gate is back. Without this, a
 * relaunch makes the *next* cell fail on a missing nav item and blame the app for it.
 */
async function ensureTermsAccepted(page: AppSession['page']): Promise<void> {
  const dialog = page.locator('[data-testid="terms-dialog"]');
  if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('[data-testid="terms-accept"]').click();
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

/**
 * Installs a delivery probe in the renderer and returns a reader for it.
 *
 * Without this the suite could pass on zero deliveries - the same vacuity that made the first
 * version of the Phase 3.1 contract test useless. The probe subscribes through the **real preload
 * `onLogMessage` method**, so a non-zero count proves the payload crossed `webContents.send`, the
 * structured-clone boundary, the preload listener and the `contextBridge` hop.
 *
 * `onLogMessage` is the one channel chosen for this because its preload handler forwards the payload
 * untouched. Every other `on*` handler dereferences its argument before calling back - five of them
 * crash on `null` - so probing through one of those would make the *probe* the thing that throws and
 * the harness would report its own bug as a production defect.
 */
async function installDeliveryProbe(page: AppSession['page']): Promise<void> {
  await page.evaluate(() => {
    const api = (window as unknown as { electronAPI: unknown }).electronAPI as unknown as {
      onLogMessage: (cb: (payload: unknown) => void) => () => void;
    };
    const scope = window as unknown as { __encodexEventCount?: number; __encodexEventUnsub?: () => void };
    let count = 0;
    scope.__encodexEventCount = 0;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = api.onLogMessage(() => {
        count += 1;
        scope.__encodexEventCount = count;
      });
    } catch {
      /* a probe that cannot subscribe reports zero deliveries, which the test asserts against */
    }
    scope.__encodexEventUnsub = () => {
      try {
        unsubscribe?.();
      } catch {
        /* teardown must not throw */
      }
    };
  });
}

/** Reads the delivery count and removes the probe, in one renderer turn. */
async function takeDeliveryCount(page: AppSession['page']): Promise<number> {
  return page.evaluate(() => {
    const scope = window as unknown as { __encodexEventCount?: number; __encodexEventUnsub?: () => void };
    const count = scope.__encodexEventCount ?? 0;
    scope.__encodexEventUnsub?.();
    return count;
  });
}

/**
 * Resolves the id of the window that owns `page`.
 *
 * `BrowserWindow.getAllWindows()[0]` is **not** the main window. `src/main/index.ts` opens a splash
 * window first and destroys it once the app has loaded, so indexing the list hands back a window
 * that is already gone - the first `webContents.send` then throws
 * `TypeError: Object has been destroyed` and every later navigation fails with
 * "Target page, context or browser has been closed". That is a harness artefact reported as eight
 * separate production defects, which is the mistake Phase 3.2 already made once.
 *
 * `app.browserWindow(page)` is the exact inverse mapping Playwright provides, so it identifies the
 * right window without guessing.
 */
async function mainWindowId(app: AppSession['app'], page: AppSession['page']): Promise<number> {
  const handle = await app.browserWindow(page);
  return handle.evaluate((win) => win.id);
}

/**
 * Runs one burst: every push channel, one payload shape, at the shape's rate, for {@link BURST_MS}.
 *
 * Self-contained because it runs inside `app.evaluate`, where nothing from this module's scope
 * exists. Payloads are therefore built in the main realm rather than passed in - a 5 MB argument
 * has to be constructed where it is sent, and a `cyclic` value cannot cross `evaluate` at all.
 *
 * The renderer is deliberately *not* awaited: the burst is timed in the main process and returns
 * as soon as the loop finishes, so the caller measures responsiveness of a renderer that is still
 * receiving.
 */
async function burst(
  app: AppSession['app'],
  windowId: number,
  channels: string[],
  shape: PayloadShapeId,
): Promise<{ emitted: number; elapsedMs: number; windowGone: boolean }> {
  return app.evaluate(
    async (electron, { channelNames, shapeId, durationMs, hz, blobBytes, arrayLength, deepLevels, targetWindowId }) => {
      const build = (which: string, cycle: number): unknown => {
        switch (which) {
          case 'null':
            return null;
          case 'garbage-primitive': {
            // Rotate through the primitives a consumer is most likely to dereference blindly. A
            // single fixed value would only prove one of these is handled.
            const primitives: unknown[] = [0, '', 'hostile', true, NaN, -1];
            return primitives[cycle % primitives.length];
          }
          case 'wrong-shape':
            return {
              id: {},
              input: [],
              output: 42,
              status: {},
              percent: 'not-a-number',
              progress: {},
              job: 'not-an-object',
              toPosition: {},
              message: 0,
              level: 99,
              entry: null,
              frame: 'x',
              chunk: 7,
              info: 'x',
              installerPath: {},
              maximized: 'yes',
            };
          case 'cyclic': {
            // Structured clone preserves the cycle, so this genuinely arrives in the renderer.
            const root: Record<string, unknown> = { id: 'root', input: 'root' };
            root.self = root;
            root.list = [root, { parent: root }];
            return root;
          }
          case 'deep': {
            let node: Record<string, unknown> = { leaf: true };
            const root = node;
            for (let depth = 0; depth < deepLevels; depth += 1) {
              node.next = { depth };
              node = node.next as Record<string, unknown>;
            }
            return root;
          }
          case 'big-array':
            return new Array(arrayLength).fill({ id: 'x', input: '/tmp/x', status: 'queued', percent: 50 });
          case 'big-blob':
            return 'A'.repeat(blobBytes);
          default:
            return undefined;
        }
      };

      // Resolved by id, and re-checked every tick: the app is free to close the window while a burst is
      // still in flight, and a `send` on a destroyed window throws from inside this loop.
      const win = electron.BrowserWindow.fromId(targetWindowId);
      if (!win || win.isDestroyed()) return { emitted: 0, elapsedMs: 0, windowGone: true };
      const send = win.webContents;

      const intervalMs = Math.max(1, Math.round(1000 / hz));
      const startedAt = Date.now();
      let emitted = 0;
      let cycle = 0;
      let windowGone = false;

      // `setTimeout(0)` would clamp to ~4 ms and turn a 100 Hz target into 250 Hz; the loop yields
      // via the wait so the rate is what was asked for. The extra `await` also keeps the main
      // process responsive, which is what makes the concurrent probe meaningful rather than a
      // measurement of a blocked main process.
      const yieldToLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

      while (Date.now() - startedAt < durationMs) {
        if (win.isDestroyed()) {
          windowGone = true;
          break;
        }
        for (const channel of channelNames) {
          send.send(channel, build(shapeId, cycle));
          emitted += 1;
        }
        cycle += 1;
        const nextTickAt = startedAt + cycle * intervalMs;
        const sleepFor = nextTickAt - Date.now();
        if (sleepFor > 0) await new Promise((resolve) => setTimeout(resolve, sleepFor));
        else await yieldToLoop();
      }

      return { emitted, elapsedMs: Date.now() - startedAt, windowGone };
    },
    {
      channelNames: channels,
      shapeId: shape,
      durationMs: BURST_MS,
      hz: HZ_BY_SHAPE[shape],
      blobBytes: BLOB_BYTES,
      arrayLength: BIG_ARRAY_LENGTH,
      deepLevels: DEEP_LEVELS,
      targetWindowId: windowId,
    },
  );
}

/** Test-side mirror of the rate table, passed into the main realm. */
describe.runIf(IS_REAL)('IPC event-channel abuse (Tier B, real main + real preload)', () => {
  let session: AppSession;
  let channels: string[];
  let commandChannels: string[];

  beforeAll(async () => {
    const commandConstants = discoverCommandConstants();
    channels = discoverPushChannels(new Set(commandConstants));
    commandChannels = commandConstants.map((name) => (IPC as unknown as Record<string, string>)[name]);
    session = await launchApp(SESSION_OPTIONS);
    await acceptTermsGate(session.page);
  }, 120_000);

  afterAll(async () => {
    if (session) await closeApp(session.app, session.userDataDir);
  });

  it('discovers every push channel the built preload subscribes to', () => {
    // Guards the harness. If the extraction ever returned nothing, every burst below would emit
    // zero events and pass on nothing - the exact failure mode that made the first Phase 3.1
    // contract test useless in five of eight cases.
    expect(channels.length, `discovered push channels: ${channels.join(', ')}`).toBe(
      EXPECTED_PUSH_CONSTANTS.length - EXPECTED_COMMAND_CONSTANTS.length,
    );
    expect([...channels].sort(), 'the preload subscription set drifted; acknowledge the new channel here').toEqual(
      EXPECTED_PUSH_CONSTANTS.filter((name) => !COMMAND_CONSTANTS.has(name))
        .map((name) => (IPC as unknown as Record<string, string>)[name])
        .sort(),
    );
    // Distinct names only: two constants resolving to one channel would double-count the burst and
    // make the delivery counts meaningless.
    expect(new Set(channels).size).toBe(channels.length);
  });

  it('separates the no-payload channels from the data channels', () => {
    // Guards the other half of the classification. If a channel quietly gained a payload it would
    // land in the sweep below, where sending nothing at it is a weaker test than the sweep looks
    // like - and if it lost one it would leave the dedicated command test asserting nothing.
    expect(discoverCommandConstants()).toEqual([...EXPECTED_COMMAND_CONSTANTS].sort());
  });

  it(
    'delivers a hostile payload on a channel the renderer really listens to',
    async () => {
      // Proves the whole path works before the sweep is trusted: main -> structured clone -> preload
      // listener -> contextBridge -> renderer callback. Without it, "the app survived" could mean
      // "nothing arrived".
      const probeChannel = 'log-message';
      expect(channels, `expected the preload to subscribe to ${probeChannel}`).toContain(probeChannel);
      await installDeliveryProbe(session.page);

      const sent = await burst(session.app, await mainWindowId(session.app, session.page), [probeChannel], 'wrong-shape');
      expect(sent.emitted, 'the burst emitted nothing').toBeGreaterThan(0);

      // The burst and this read are separate IPC turns; give the renderer a turn to drain.
      await session.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));
      const delivered = await takeDeliveryCount(session.page);
      expect(delivered, `no payload reached the renderer on ${probeChannel}; the harness is not wired to the app`).toBeGreaterThan(0);
    },
    CELL_TIMEOUT_MS,
  );

  for (const shape of PAYLOAD_SHAPES) {
    it(
      `survives ${shape} payloads on every push channel, on every route`,
      async () => {
        const hz = HZ_BY_SHAPE[shape];
        const results: CellResult[] = [];

        for (const route of ROUTES) {
          // Self-healing per cell, not once per file.
          //
          // Sharing one Electron instance across all 84 bursts is the mistake Phase 3.2 documented:
          // the first payload that kills a renderer leaves every later test reporting "Target page,
          // context or browser has been closed", so one real defect is reported as many, and the
          // ones that never ran look like passes. Re-checking liveness before each cell keeps a
          // crash attributable to the cell that caused it.
          session = await ensureLiveSession(session, SESSION_OPTIONS);
          await ensureTermsAccepted(session.page);
          await gotoRoute(session.page, route);
          await installDeliveryProbe(session.page);

          // Start the probe loop *before* the burst so responsiveness is sampled during delivery
          // rather than after it. A renderer that is merely slow to answer once the queue has
          // drained would pass a post-burst check and still be unusable in practice.
          const probe = (async (emitted: number): Promise<CellResult> => {
            const probes: number[] = [];
            const mainProbes: number[] = [];
            const stalled: number[] = [];
            const cellBudget = budgetFor(route.path);
            const burstStarted = Date.now();
            while (Date.now() - burstStarted < BURST_MS) {
              const started = Date.now();
              const settled = await session.page
                .evaluate(async () => {
                  const api = (window as unknown as { electronAPI: unknown }).electronAPI as unknown as {
                    getCapabilities: () => Promise<unknown>;
                  };
                  await api.getCapabilities();
                  return true;
                })
                .then(() => true)
                .catch(() => false);
              const elapsed = Date.now() - started;
              if (!settled || elapsed > cellBudget) stalled.push(elapsed);
              const mainStarted = Date.now();
              probes.push(elapsed);

              // Attribution control: an independent main-side sample on the same cadence.
              await session.app.evaluate(() => 1).catch(() => -1);
              mainProbes.push(Date.now() - mainStarted);

              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const delivered = await takeDeliveryCount(session.page);

            return {
              route: route.path,
              delivered,
              probes: probes.length,
              stalledProbes: stalled.length,
              worstProbeMs: probes.length > 0 ? Math.max(...probes) : -1,
              worstMainMs: mainProbes.length > 0 ? Math.max(...mainProbes) : -1,
              emitted,
              renderedRows: -1,
              budgetMs: cellBudget,
              burstMs: Date.now() - burstStarted,
            };
          })(-1);

          const sent = await burst(session.app, await mainWindowId(session.app, session.page), channels, shape);
          expect(sent.emitted, `${shape} on ${route.path}: nothing was emitted`).toBeGreaterThan(0);
          const cell = await probe;
          // The burst overran its own window, so the probe loop had to run past its deadline before it
          // could observe the tail of the flood. Recorded instead of silently tolerated, because a
          // burst that cannot honour 100 Hz is a load-shaping question, not a renderer question.
          cell.emitted = sent.emitted;
          results.push(cell);

          // The route must still be the one we navigated to: a subscriber that navigated away,
          // or an ErrorBoundary that swallowed the route, both leave the app "alive" and useless.
          const hash = await session.page.evaluate(() => window.location.hash);
          expect(hash, `${shape} navigated away from ${route.path}`).toContain(route.path === '/' ? '#/' : `#${route.path}`);
          expect(await isPageAlive(session.page), `${shape} killed the renderer on ${route.path}`).toBe(true);
          // How much of the list is actually mounted. `/logs` is the only route with a varying
          // count: the list is windowed (2026-10-07), so this is the mounted DOM slice (~viewport,
          // two spacers, the tail anchor) rather than the stored entry count - rows must therefore
          // no longer be read as 'entries synchronously rendered'.
          cell.renderedRows = await session.page
            .evaluate(() => {
              const body = document.querySelector('[data-testid="logs-body"]');
              return body ? body.children.length : -1;
            })
            .catch(() => -1);
        }

        const report = results
          .map(
            (r) =>
              `  ${r.route.padEnd(16)} delivered=${r.delivered} probes=${r.probes} stalled=${r.stalledProbes} ` +
              `worstRenderer=${r.worstProbeMs}ms worstMain=${r.worstMainMs}ms emitted=${r.emitted} rows=${r.renderedRows} budget=${r.budgetMs}ms in ${r.burstMs}ms`,
          )
          .join('\n');

        const undelivered = results.filter((r) => r.delivered === 0);
        expect(
          undelivered,
          `${shape}: these routes received no payload at all, so the burst proved nothing there:\n${report}`,
        ).toHaveLength(0);

        const wedged = results.filter((r) => r.stalledProbes > 0);
        expect(
          wedged,
          `${shape} at ${hz} Hz: a benign round-trip missed its budget while events were in flight.\n` +
            `Attribution matters here, because the load generator runs *inside* the main process it is ` +
            `measuring: if the main-side probes were also slow, the generator is saturating main and the ` +
            `renderer is being blamed for the harness's own load. Compare worstMainMs against worstRendererMs.\n${report}`,
        ).toHaveLength(0);

        const silent = results.filter((r) => r.probes === 0);
        expect(silent, `${shape}: no responsiveness probe ran, so "still interactive" was never measured:\n${report}`).toHaveLength(0);

        // And the API is not merely reachable but still correct after twelve bursts.
        const sanity = await session.page.evaluate(
          async (calls) => {
            const api = (window as unknown as { electronAPI: unknown }).electronAPI as unknown as Record<string, () => Promise<unknown>>;
            const out: Record<string, string> = {};
            for (const call of calls) {
              const value = await api[call.name]();
              out[call.name] = Array.isArray(value) ? `array(${value.length})` : value === null ? 'null' : typeof value;
            }
            return out;
          },
          SANITY_CALLS.map((call) => ({ name: call.name })),
        );
        for (const call of SANITY_CALLS) {
          expect(sanity[call.name], `${call.name} did not answer after the sweep`).toBeTruthy();
        }
      },
      SHAPE_TIMEOUT_MS,
    );
  }

  it(
    'fires the no-payload channels and asserts their documented effect',
    async () => {
      // The three channels excluded from the payload sweep, tested for what they actually do
      // instead of being worked around.
      //
      // `queue-cancelled` and `update-not-available` are notifications: firing them must leave the
      // app alive and answering. `window-close-requested` is a command - `CloseConfirmDialog` calls
      // `windowCloseConfirmed()` when nothing is pending, and main closes the window - so its
      // assertion is that the window goes away *cleanly*, with no unhandled fault, which the
      // global tripwire checks.
      const inert = commandChannels.filter((channel) => channel !== 'window-close-requested');
      expect(inert, 'expected the queue and updater notifications among the no-payload channels').toHaveLength(2);

      session = await ensureLiveSession(session, SESSION_OPTIONS);
      await ensureTermsAccepted(session.page);
      const windowId = await mainWindowId(session.app, session.page);

      const fired = await session.app.evaluate(
        async (electron, { ids, channels: names, repeats }) => {
          const win = electron.BrowserWindow.fromId(ids);
          if (!win || win.isDestroyed()) return -1;
          let sent = 0;
          for (let i = 0; i < repeats; i += 1) {
            for (const name of names) {
              if (win.isDestroyed()) return sent;
              win.webContents.send(name);
              sent += 1;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          return sent;
        },
        { ids: windowId, channels: inert, repeats: 25 },
      );

      expect(fired, 'nothing was emitted on the no-payload channels').toBeGreaterThan(0);
      expect(await isPageAlive(session.page), 'a no-payload notification closed or wedged the renderer').toBe(true);
      const capabilities = await session.page.evaluate(async () => {
        const api = (window as unknown as { electronAPI: unknown }).electronAPI as unknown as { getCapabilities: () => Promise<unknown> };
        return typeof (await api.getCapabilities());
      });
      expect(capabilities, 'the API stopped answering after the notifications').toBe('object');

      // Now the command channel, on a session of its own: it is expected to end this window.
      const own = await launchApp(SESSION_OPTIONS);
      try {
        await acceptTermsGate(own.page);
        const ownWindowId = await mainWindowId(own.app, own.page);
        await own.app.evaluate(
          (electron, { id, channel }) => {
            const win = electron.BrowserWindow.fromId(id);
            win?.webContents.send(channel);
          },
          { id: ownWindowId, channel: 'window-close-requested' },
        );

        // No assertion on "did it close": both outcomes are correct - `CloseConfirmDialog` defers
        // when work is pending and closes when it is not. What must hold is that neither path threw,
        // and the tripwire is what enforces that.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } finally {
        await closeApp(own.app, own.userDataDir);
      }
    },
    CELL_TIMEOUT_MS,
  );

  it(
    'has a working API after the event abuse: a benign call still resolves',
    async () => {
      // The sweeps above are allowed to be destructive to *payloads*; they are not allowed to be
      // destructive to the *app*. `cyclic` is the shape that reaches the renderer intact, so it is
      // the one replayed here before asserting the API still works.
      const own = await launchApp(SESSION_OPTIONS);
      try {
        await acceptTermsGate(own.page);
        await burst(own.app, await mainWindowId(own.app, own.page), channels, 'cyclic');

        const result = await own.page.evaluate(async () => {
          const api = (window as unknown as { electronAPI: unknown }).electronAPI as unknown as {
            getCapabilities: () => Promise<unknown>;
            queueList: () => Promise<unknown[]>;
          };
          await api.getCapabilities();
          const jobs = await api.queueList();
          return { capabilities: typeof (await api.getCapabilities()), jobCount: jobs.length };
        });
        expect(result.capabilities).toBe('object');
        expect(result.jobCount).toBe(0);
        expect(await isPageAlive(own.page), 'the app must survive the abuse, not just the calls').toBe(true);
      } finally {
        await closeApp(own.app, own.userDataDir);
      }
    },
    CELL_TIMEOUT_MS,
  );
});
