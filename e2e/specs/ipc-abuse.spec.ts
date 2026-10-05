/**
 * @fileoverview Phase 3.2 - IPC handler abuse harness (Tier B: real main + real preload).
 *
 * Launches the app with `mock: false`, so the **real** preload and the **real** main process are
 * in play, then calls every request method on `window.electronAPI` with hostile values and
 * asserts the app survives each one.
 *
 * ## Why the sweep runs from the renderer rather than through `ipcMain`
 *
 * The plan sketched this as `app.evaluate(() => require('electron').ipcMain)`, but `ipcMain` has
 * no public "invoke this channel" entry point - `ipcMain.handle` only *registers* a handler, and
 * the handler registry it uses is private. Driving the handlers from the renderer through the
 * real preload is both what an attacker or a buggy component actually has, and strictly more
 * faithful: the hostile value is put through the real `contextBridge` + structured-clone
 * boundary, so a value that cannot be cloned is rejected *at the bridge* instead of silently
 * arriving as something friendlier.
 *
 * The one thing that boundary does hide is a value that never crosses a process edge. `Phase 3.1`
 * (`src/main/ipc/__tests__/channel-contract.test.ts`) already proves that every handler is
 * reachable from the preload, so nothing is left uncovered by not calling handlers in-process.
 *
 * ## The stubs, and why they exist
 *
 * Nine of the request methods have side effects an automated test cannot undo or observe:
 * seven open a **native modal dialog** that nothing in the harness can dismiss, and two
 * (`installUpdate`, `scheduleInstallOnRestart`) **terminate or relaunch the process**. Calling
 * them for real would hang the run at best and destroy the session at worst.
 *
 * Rather than exclude them - which would leave the handlers that are *most* likely to be
 * under-validated untested - the harness replaces only the **outermost side-effecting call**
 * inside the real main process (`dialog.*`, `shell.*`, `app.quit/relaunch/exit`,
 * `app.setLoginItemSettings`, `BrowserWindow#close`) and leaves every handler real. A stub that
 * records its arguments and returns a benign sentinel does two useful things: the handler is
 * still exercised end to end, and the recorded arguments become evidence of whether the handler
 * *sanitised* before crossing the OS boundary. That is checked by
 * "every value a handler handed to the OS boundary is a plain JSON-ish value".
 *
 * The stubs are installed in the main process, not by mocking a module, so a handler that
 * captured `dialog` or `shell` at import time still reaches the stub.
 *
 * ## What a failure means
 *
 * - Any `mainException` / `pageerror` / renderer `crash` fails the test via the global tripwire
 *   (`e2e/fixtures/tripwire-setup.ts`), so this file contains no hand-rolled crash assertion.
 * - A rejection whose message matches {@link RAW_CRASH_SIGNATURES} is a real defect: the handler
 *   dereferenced an unvalidated argument instead of rejecting with a formatted `AppError`.
 * - A resolved call is not automatically a pass - see the "still works afterwards" test.
 *
 * @see e2e/fixtures/tripwire.ts, e2e/fixtures/app.ts
 * @see src/main/ipc/__tests__/channel-contract.test.ts (Phase 3.1)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchApp, closeApp, acceptTermsGate, isPageAlive, AppSession } from '../fixtures/app';
import { formatError } from '../../src/shared/errors';

const IS_REAL = process.env.E2E_REAL === '1';

/**
 * Per-call budget for a single `ipcRenderer.invoke`.
 *
 * This must sit *above* the slowest timeout the app implements on purpose, or the harness races
 * the app and reports a documented, correct behaviour as a defect. `playerGetFrame` resolves `null`
 * after `PLAYER_FRAME_TIMEOUT_MS` (5s) when no player is open, so a 5s budget lost that race on
 * every single input and failed 16 of 17 sweeps for no reason. 15s leaves room for the app's own
 * timer plus IPC overhead while still catching a genuine hang.
 */
const PER_CALL_TIMEOUT_MS = 15_000;

/**
 * Methods that block by design when a precondition is unmet, and so legitimately hit the
 * per-call budget when called bare.
 *
 * Listed explicitly rather than tolerated by a blanket rule, so that if one of these stops
 * settling at all - a genuine hang - the separate assertion below still catches it.
 */
const BLOCKING_BY_DESIGN = new Set<string>([
  // Resolves `null` after `PLAYER_FRAME_TIMEOUT_MS` (5s) when no player is open.
  'playerGetFrame',
  // Reaches the real network. Without connectivity it can sit on a socket far longer than any
  // in-process work, and that is not a defect - the harness is asserting on argument validation,
  // not on GitHub's uptime.
  'checkForUpdates',
]);

/**
 * Budget for one whole sweep, independent of how many methods are left.
 *
 * This exists because a per-call cap multiplied by the method count is not a bound. The first
 * version of this spec had a 5-second per-call cap and a 120-second test timeout, and five
 * separate inputs blew the *test* timeout: one pathological method (`expandPaths`, which walked
 * the working directory once per character of a string) ate the entire allowance and the run
 * reported "Test timed out" with no indication of which method was responsible. A sweep now
 * stops on its own deadline and records the rest as `skipped`, which the test asserts is empty -
 * so the budget cannot quietly become a way to test less.
 */
const SWEEP_BUDGET_MS = 90_000;

/** Budget for one full hostile-input sweep across every request method. */
const SWEEP_TIMEOUT_MS = 150_000;

/** Budget for the classify step, which invokes every method exactly once. */
const CLASSIFY_TIMEOUT_MS = 120000;

/**
 * Signatures of a handler that crashed on its own argument instead of validating it.
 *
 * Each is a JavaScript engine error that can only appear if code reached into a value it never
 * checked, which is exactly the defect class this harness exists to find. `TypeError: Cannot read
 * properties of undefined` is the canonical one named in the plan.
 */
const RAW_CRASH_SIGNATURES: RegExp[] = [
  /Cannot read propert(?:y|ies) of (?:undefined|null)/i,
  /Cannot convert undefined or null to object/i,
  /Cannot destructure propert/i,
  /\bis not a function\b/i,
  /\bis not iterable\b/i,
  /Object prototype may only be an Object or null/i,
  /Converting circular structure to JSON/i,
  /Maximum call stack size exceeded/i,
  /Cannot assign to read only property/i,
  /Proxy trap|proxy trap/i,
];

/** Outcome kinds recorded for a single method call. */
type CallStatus = 'resolved' | 'rejected' | 'threw-sync' | 'timeout' | 'non-promise' | 'missing' | 'blocked-at-bridge' | 'skipped';

interface CallOutcome {
  /** The `electronAPI` method that was called. */
  name: string;
  /** How the call ended. */
  status: CallStatus;
  /** Error name, when the call failed. */
  errorName?: string;
  /** Error message, truncated, when the call failed. */
  errorMessage?: string;
  /** Round-trip time in milliseconds. */
  ms: number;
}

interface StubCall {
  /** Which stubbed boundary was reached. */
  boundary: string;
  /** The types of the arguments it received, e.g. `['string']`. */
  argTypes: string[];
  /**
   * The length of the longest argument, measured before any truncation.
   *
   * This exists because the obvious check - "is the recorded preview long?" - measures nothing.
   * `preview` is deliberately capped for readable failure messages, so a perfectly legitimate 1 KB
   * options object and a 1 MB hostile string are indistinguishable once recorded, and an
   * assertion on it flags the app's own filter lists instead of the attacker.
   */
  maxArgLength: number;
  /** A bounded JSON rendering of the arguments, for the failure message. */
  preview: string;
}

interface Classification {
  /** Every key on `window.electronAPI`. */
  all: string[];
  /** Methods that returned a promise - i.e. backed by an `ipcMain.handle` channel. */
  requests: string[];
  /** Methods that returned nothing - i.e. fire-and-forget `ipcMain.on` channels. */
  sends: string[];
  /** Methods that returned an unsubscribe function - i.e. push-event subscriptions. */
  subscriptions: string[];
}

/**
 * The hostile input catalogue.
 *
 * Every value is constructed **inside the renderer**, because a `Proxy` that throws on every
 * `get`, a `Symbol` and a function are not structured-cloneable: passing them in as an
 * `evaluate` argument would fail in the test process, before the bridge ever saw them. Each entry
 * is referenced by id from the renderer-side `buildInput` switch.
 *
 * The plan's thirteen are all present, plus four additions that matter here: `cyclic` (structured
 * clone *preserves* cycles, so this one really does reach the handler), `bigint`, `symbol` and
 * `function` (all three are rejected at the bridge, which is the correct outcome and is asserted
 * rather than assumed).
 */
const HOSTILE_INPUT_IDS = [
  'no-args',
  'undefined',
  'null',
  'zero',
  'empty-string',
  'nan',
  'traversal',
  'big-string',
  'big-array',
  'wide-object',
  'proto-keys',
  'frozen',
  'cyclic',
  'proxy-throws',
  'bigint',
  'symbol',
  'function',
] as const;

type HostileInputId = (typeof HOSTILE_INPUT_IDS)[number];

/**
 * `getPathForFile` is the one `electronAPI` member with no channel behind it.
 *
 * It is `webUtils.getPathForFile(file)` in the preload - a synchronous Electron web API that
 * needs a real `File` produced by the OS file picker, and throws without one. `Phase 3.1` skips
 * it for the same reason. Listing it here rather than filtering it out silently keeps the
 * exclusion greppable, which is the convention the tripwire allowlist also follows.
 */
const NON_IPC_METHODS = new Set(['getPathForFile']);

/**
 * Replaces the side-effecting boundaries in the real main process.
 *
 * Runs inside `app.evaluate`, so it must be entirely self-contained: Playwright serialises the
 * function source, and a reference to anything in this module's scope would be undefined in the
 * main process. The `electron` module arrives as the callback's first parameter - Playwright
 * injects it - because `require` is *not* defined in the evaluation context, which is the first
 * thing this got wrong.
 *
 * The `__encodexAbuseStubs` guard makes a relaunch re-install cleanly (a fresh process carries no
 * marker) while keeping a second call in the same process idempotent.
 */
async function installSideEffectStubs(app: AppSession['app']): Promise<void> {
  await app.evaluate((electron) => {
    const scope = globalThis as unknown as Record<string, unknown>;
    if (scope.__encodexAbuseStubs) return;
    scope.__encodexAbuseStubs = true;

    const calls: unknown[] = [];
    scope.__encodexAbuseCalls = calls;

    const CAP = 500;
    const typeOf = (value: unknown): string => {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    };
    const record = (boundary: string, args: unknown[]): void => {
      if (calls.length >= CAP) return;
      let preview: string;
      try {
        preview = JSON.stringify(
          args.map((a) => (typeof a === 'string' ? `${a.slice(0, 120)}` : a)),
          (_key, value) => (typeof value === 'bigint' ? `${value}n` : value),
        );
      } catch {
        preview = '[unserialisable]';
      }
      // Measured here, on the untouched argument, rather than inferred from the truncated preview.
      let maxArgLength = 0;
      for (const a of args) {
        let length = 0;
        if (typeof a === 'string') {
          length = a.length;
        } else if (a !== null && a !== undefined) {
          try {
            length = JSON.stringify(a)?.length ?? 0;
          } catch {
            length = String(a).length;
          }
        }
        if (length > maxArgLength) maxArgLength = length;
      }
      calls.push({ boundary, argTypes: args.map(typeOf), maxArgLength, preview: (preview ?? '[undefined]').slice(0, 400) });
    };

    electron.dialog.showOpenDialog = (async (...args: unknown[]) => {
      // The first argument is the parent window; only the caller's payload is interesting.
      record('dialog.showOpenDialog', args.slice(1));
      return { canceled: true, filePaths: [] };
    }) as unknown as typeof electron.dialog.showOpenDialog;
    electron.dialog.showSaveDialog = (async (...args: unknown[]) => {
      record('dialog.showSaveDialog', args.slice(1));
      return { canceled: true, filePath: '' };
    }) as unknown as typeof electron.dialog.showSaveDialog;

    electron.shell.openExternal = (async (url: string) => {
      record('shell.openExternal', [url]);
    }) as typeof electron.shell.openExternal;
    electron.shell.openPath = (async (target: string) => {
      record('shell.openPath', [target]);
      return '';
    }) as typeof electron.shell.openPath;
    electron.shell.showItemInFolder = ((target: string) => {
      record('shell.showItemInFolder', [target]);
    }) as typeof electron.shell.showItemInFolder;

    electron.app.setLoginItemSettings = ((settings: unknown) => {
      record('app.setLoginItemSettings', [settings]);
    }) as typeof electron.app.setLoginItemSettings;
    electron.app.quit = (() => {
      record('app.quit', []);
    }) as typeof electron.app.quit;
    electron.app.relaunch = ((...args: unknown[]) => {
      record('app.relaunch', args);
    }) as typeof electron.app.relaunch;
    electron.app.exit = ((code: number) => {
      record('app.exit', [code]);
    }) as typeof electron.app.exit;

    // The handlers captured their `win` reference at registration, so an own-property stub on
    // each live window shadows the prototype method for those captured references too.
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.close = (() => {
        record('win.close', []);
      }) as typeof win.close;
    }
  });
}

/**
 * Calls every `electronAPI` method once with no arguments and sorts them by return shape.
 *
 * Classification by behaviour rather than by name or by a hard-coded list, because the three
 * shapes have genuinely different risk profiles: a `send` cannot be observed by the caller at
 * all, and a subscription is not a handler. The `on*` subscription returned by this step is
 * immediately invoked, so 12 subscriptions do not become 12 leaked `ipcRenderer` listeners.
 */
async function classifyApi(page: AppSession['page']): Promise<Classification> {
  return page.evaluate(
    async ({ perCallMs }) => {
      const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => unknown> }).electronAPI;
      const all = Object.keys(api).sort();
      const requests: string[] = [];
      const sends: string[] = [];
      const subscriptions: string[] = [];

      const settle = (value: Promise<unknown>): Promise<string> =>
        Promise.race([
          value.then(
            () => 'resolved',
            () => 'rejected',
          ),
          new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), perCallMs)),
        ]);

      for (const name of all) {
        const fn = api[name];
        if (typeof fn !== 'function') {
          sends.push(name);
          continue;
        }
        let returned: unknown;
        try {
          returned = fn();
        } catch {
          // Threw before returning anything - still a request-shaped call.
          requests.push(name);
          continue;
        }
        if (typeof returned === 'function') {
          try {
            (returned as () => void)();
          } catch {
            /* unsubscribing must not break classification */
          }
          subscriptions.push(name);
          continue;
        }
        if (returned && typeof (returned as Promise<unknown>).then === 'function') {
          await settle(returned as Promise<unknown>);
          requests.push(name);
          continue;
        }
        sends.push(name);
      }
      return { all, requests, sends, subscriptions };
    },
    { perCallMs: PER_CALL_TIMEOUT_MS },
  );
}

/**
 * Calls every named method with one hostile value and reports how each call ended.
 *
 * Self-contained for the same reason as {@link installSideEffectStubs}: the value has to be built
 * in the page, so the builder switch lives inside this function rather than in module scope.
 */
async function sweepWithInput(page: AppSession['page'], inputId: HostileInputId, methods: string[]): Promise<CallOutcome[]> {
  return page.evaluate(
    async ({ id, names, perCallMs, sweepBudgetMs }) => {
      const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => unknown> }).electronAPI;

      const build = (which: string): unknown => {
        switch (which) {
          case 'undefined':
            return undefined;
          case 'null':
            return null;
          case 'zero':
            return 0;
          case 'empty-string':
            return '';
          case 'nan':
            return NaN;
          case 'traversal':
            return '../../../../etc/passwd';
          case 'big-string':
            return 'x'.repeat(1024 * 1024);
          case 'big-array':
            return new Array(10000).fill(0);
          case 'wide-object': {
            const wide: Record<string, number> = {};
            for (let i = 0; i < 200; i += 1) wide[`key${i}`] = i;
            return wide;
          }
          case 'proto-keys': {
            const hostile: Record<string, unknown> = { innocent: true };
            // `__proto__` in an object literal sets the prototype instead of creating an own key,
            // and `constructor`/`prototype` are inherited members, so all three have to be defined
            // explicitly or the payload reaches the handler already sanitised.
            Object.defineProperty(hostile, '__proto__', {
              value: { polluted: true },
              enumerable: true,
              writable: true,
              configurable: true,
            });
            Object.defineProperty(hostile, 'constructor', { value: { polluted: true }, enumerable: true, configurable: true });
            Object.defineProperty(hostile, 'prototype', { value: { polluted: true }, enumerable: true, configurable: true });
            return hostile;
          }
          case 'frozen':
            return Object.freeze({ path: '/etc/passwd', width: 1, height: 1 });
          case 'cyclic': {
            const root: Record<string, unknown> = { name: 'root' };
            root.self = root;
            root.list = [root];
            return root;
          }
          case 'proxy-throws':
            return new Proxy(
              {},
              {
                get() {
                  throw new Error('hostile proxy trap fired');
                },
                ownKeys() {
                  throw new Error('hostile proxy ownKeys fired');
                },
              },
            );
          case 'bigint':
            return 10n ** 30n;
          case 'symbol':
            return Symbol('hostile');
          case 'function':
            return function hostileFunction(): void {};
          default:
            return undefined;
        }
      };

      const describe = (err: unknown): { name: string; message: string } => {
        if (err instanceof Error) return { name: err.name, message: String(err.message).slice(0, 600) };
        if (typeof err === 'object' && err !== null) {
          const maybe = err as { name?: unknown; message?: unknown };
          return {
            name: typeof maybe.name === 'string' ? maybe.name : 'Object',
            message: String(maybe.message ?? '[no message property]').slice(0, 600),
          };
        }
        return { name: typeof err, message: String(err).slice(0, 600) };
      };

      const isBridgeRejection = (message: string): boolean =>
        /could not be cloned|DataCloneError|#<Object>|An object could not be cloned/i.test(message);

      const args = id === 'no-args' ? [] : [build(id)];
      const results: CallOutcome[] = [];
      const sweepStartedAt = performance.now();

      for (let index = 0; index < names.length; index += 1) {
        const name = names[index];
        const fn = api[name];
        const startedAt = performance.now();
        const elapsed = (): number => Math.round(performance.now() - startedAt);

        // Enforce the sweep's own budget here rather than relying on the test timeout. Without
        // this a single pathological method consumes the whole allowance, Vitest reports
        // "Test timed out in 120000ms", and every finding from the other 60 methods is lost.
        if (performance.now() - sweepStartedAt > sweepBudgetMs) {
          for (const remaining of names.slice(index)) {
            results.push({ name: remaining, status: 'skipped', ms: 0 });
          }
          break;
        }

        if (typeof fn !== 'function') {
          results.push({ name, status: 'missing', ms: elapsed() });
          continue;
        }

        let returned: unknown;
        try {
          returned = args.length === 0 ? fn() : fn(...args);
        } catch (err) {
          const { name: errorName, message } = describe(err);
          results.push({
            name,
            status: isBridgeRejection(message) ? 'blocked-at-bridge' : 'threw-sync',
            errorName,
            errorMessage: message,
            ms: elapsed(),
          });
          continue;
        }

        if (!returned || typeof (returned as Promise<unknown>).then !== 'function') {
          results.push({ name, status: 'non-promise', ms: elapsed() });
          continue;
        }

        const outcome = await Promise.race([
          (returned as Promise<unknown>).then(
            () => ({ kind: 'resolved' as const, errorName: '', errorMessage: '' }),
            (err: unknown) => {
              const described = describe(err);
              return { kind: 'rejected' as const, errorName: described.name, errorMessage: described.message };
            },
          ),
          new Promise<{ kind: 'timeout'; errorName: string; errorMessage: string }>((resolve) =>
            setTimeout(() => resolve({ kind: 'timeout', errorName: '', errorMessage: '' }), perCallMs),
          ),
        ]);

        if (outcome.kind === 'resolved' || outcome.kind === 'timeout') {
          results.push({ name, status: outcome.kind, ms: elapsed() });
          continue;
        }
        results.push({
          name,
          status: isBridgeRejection(outcome.errorMessage) ? 'blocked-at-bridge' : 'rejected',
          errorName: outcome.errorName,
          errorMessage: outcome.errorMessage,
          ms: elapsed(),
        });
      }
      return results;
    },
    { id: inputId, names: methods, perCallMs: PER_CALL_TIMEOUT_MS, sweepBudgetMs: SWEEP_BUDGET_MS },
  );
}

/** Reads and clears the main-process stub audit log. */
async function takeStubCalls(app: AppSession['app']): Promise<StubCall[]> {
  return app.evaluate(() => {
    const scope = globalThis as unknown as { __encodexAbuseCalls?: StubCall[] };
    const calls = scope.__encodexAbuseCalls ?? [];
    return calls.splice(0, calls.length);
  });
}

/** Builds a Vitest failure message out of a set of bad outcomes. */
function describeBadOutcomes(label: string, outcomes: CallOutcome[]): string {
  return `${label}:\n${outcomes
    .map((o) => `  ${o.name} -> ${o.status}${o.errorName ? ` ${o.errorName}` : ''}: ${String(o.errorMessage).slice(0, 300)}`)
    .join('\n')}`;
}

/**
 * The slowest calls in a sweep, for the failure message.
 *
 * A sweep that only trips the budget tells you *that* something is slow, not *what*. Sorting by
 * duration means the budget failure names the culprit instead of the sixty innocent handlers that
 * never got their turn.
 */
function describeSlowest(outcomes: CallOutcome[], count = 5): string {
  const slowest = [...outcomes]
    .filter((o) => o.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, count);
  if (slowest.length === 0) return '  (no completed calls)';
  return slowest.map((o) => `  ${o.name} ${o.ms}ms -> ${o.status}`).join('\n');
}

/**
 * Argument types each OS-facing boundary is documented to accept.
 *
 * The first version of this test rejected a hardcoded list of "should never reach the OS" types
 * (`function`, `symbol`, `bigint`). That was wrong in both directions: it encoded an assumption
 * about Electron's internals rather than this app's contract, and it could not express the actual
 * requirement, which is that `shell.*` only ever accepts strings. Stating the contract per
 * boundary catches the same regression precisely - a `bigint` reaching `shell.openPath` is a
 * failure because `openPath` documents a string argument, not because `bigint` is unusual - and
 * leaves `app.setLoginItemSettings` (which legitimately takes an options object) alone.
 */
const BOUNDARY_ARGUMENT_CONTRACTS: Record<string, readonly string[]> = {
  'shell.openExternal': ['string'],
  'shell.openPath': ['string'],
  'shell.showItemInFolder': ['string'],
  'app.setLoginItemSettings': ['object'],
};

/**
 * The largest argument the audit tolerates at a contract-checked boundary.
 *
 * Mirrors `MAX_OS_STRING_LENGTH` in `src/shared/validation.ts`, with headroom, so the assertion
 * fails for a megabyte payload but not for the longest path Windows can actually represent.
 * Declared here rather than imported because the audit is deliberately independent of the
 * constant it is checking: a test that imports the production limit only proves the constant is
 * self-consistent, whereas this states the expectation in absolute terms.
 */
const MAX_OS_STRING_LENGTH_EXPECTED = 8192;

/**
 * Asserts that nothing hostile reached an OS-facing boundary.
 *
 * Run per hostile input rather than once at the end, because "which input reached `shell.openPath`
 * with a megabyte of attacker-controlled text" is only answerable if the audit is not pooled
 * across seventeen sweeps.
 *
 * @param calls - Stub audit log entries from this input's sweep.
 * @param inputId - The hostile input being audited, for the failure message.
 */
function expectBoundaryContracts(calls: StubCall[], inputId: HostileInputId): void {
  // Deliberately no precondition here that anything was reached.
  //
  // Reaching a stub is a property of the *harness*, proven once by the stub-liveness probe in the
  // classification test, not a property of each hostile input. Two separate versions of this
  // helper got it wrong in opposite directions:
  //
  //  - Requiring a contract-checked boundary specifically demanded that `shell.*` be reached,
  //    which stopped being true the moment the handlers correctly rejected hostile input before
  //    the OS - sixteen tests failed demanding the regression back.
  //  - Requiring *any* stub still failed `proxy-throws`, where the structured-clone boundary
  //    rejects the payload before a single handler runs, so no stub is reachable at any
  //    correctness level.
  //
  // The assertions below therefore apply to whatever was reached and pass vacuously otherwise,
  // which is the correct outcome when nothing bad happened.
  const checked = calls.filter((call) => call.boundary in BOUNDARY_ARGUMENT_CONTRACTS);

  const offenders = checked.filter((call) => {
    const allowed = BOUNDARY_ARGUMENT_CONTRACTS[call.boundary];
    return call.argTypes.some((type) => !allowed.includes(type));
  });
  expect(
    offenders,
    `${inputId}: handlers forwarded arguments the boundary does not accept:\n${offenders
      .map(
        (o) =>
          `  ${o.boundary} accepts [${BOUNDARY_ARGUMENT_CONTRACTS[o.boundary].join(', ')}] but got [${o.argTypes.join(', ')}]: ${o.preview}`,
      )
      .join('\n')}`,
  ).toHaveLength(0);

  // A 1 MB string handed straight to `shell.*` is a real defect even though it is a *valid*
  // string: it is not a path, and the OS layer still has to hold and reject it. Scoped to the
  // contract-checked boundaries on purpose - `selectFile`'s renderer-supplied file filters are
  // legitimately large and forwarding them is the handler's job, so a blanket size rule would
  // flag the app's own ~1 KB extension list as an attack.
  const oversized = checked.filter((call) => call.maxArgLength > MAX_OS_STRING_LENGTH_EXPECTED);
  expect(
    oversized,
    `${inputId}: handlers forwarded an oversized payload to the OS:\n${oversized
      .map((o) => `  ${o.boundary} received an argument of ${o.maxArgLength} characters: ${o.preview}`)
      .join('\n')}`,
  ).toHaveLength(0);
}

describe.runIf(IS_REAL)('IPC handler abuse (Tier B, real main + real preload)', () => {
  let session: AppSession;
  let classification: Classification;

  beforeAll(async () => {
    session = await launchApp({ mock: false, env: { E2E_REAL: '1' } });
    await acceptTermsGate(session.page);
    await installSideEffectStubs(session.app);
    classification = await classifyApi(session.page);
  }, CLASSIFY_TIMEOUT_MS);

  afterAll(async () => {
    if (session) await closeApp(session.app, session.userDataDir);
  });

  it('exposes a request method for every IPC-backed electronAPI member', () => {
    // Guards the harness itself. If classification ever collapsed to an empty request list the
    // sweeps below would pass on nothing, which is precisely how the Phase 3.1 test lied at first.
    expect(classification.requests.length).toBeGreaterThan(40);
    expect(classification.subscriptions.length).toBeGreaterThanOrEqual(10);
    expect(classification.all.length).toBe(
      classification.requests.length + classification.sends.length + classification.subscriptions.length,
    );
    for (const name of NON_IPC_METHODS) {
      expect(classification.all, `${name} should still be present on the API`).toContain(name);
    }
  });

  it('records the side-effect stubs, so the per-input boundary audits are not vacuous', async () => {
    // Stubs that silently stop being installed would make every `expectBoundaryContracts` call
    // pass on an empty list. Proved once, here, with a plain valid argument rather than a hostile
    // one, so the probe does not depend on any handler's validation behaving a particular way.
    await session.page.evaluate(async () => {
      const api = (window as unknown as { electronAPI: { revealFile: (p: string) => Promise<void> } }).electronAPI;
      await api.revealFile('/tmp/encodex-stub-liveness-probe.txt');
    });

    const calls = await takeStubCalls(session.app);
    expect(
      calls.filter((c) => c.boundary === 'shell.showItemInFolder'),
      `the shell stub did not record a call, so the boundary audits prove nothing. Recorded instead: ${calls
        .map((c) => c.boundary)
        .join(', ')}`,
    ).toHaveLength(1);
  });

  for (const inputId of HOSTILE_INPUT_IDS) {
    it(
      `survives every handler called with ${inputId}`,
      async () => {
        // A fresh app per hostile input.
        //
        // The first version of this suite swept all seventeen inputs through one shared Electron
        // instance, and that turned a single hostile payload into a cascading failure: `big-array`
        // leaves the main process walking ten thousand filesystem paths, and that work was still
        // draining when `proto-keys` ran. By the end of the run the app had closed and the
        // remaining nine tests failed with "Target page, context or browser has been closed" -
        // reporting a harness artefact as ten separate handler defects.
        //
        // Isolating each input also makes the stub audit attributable: the recorded OS-boundary
        // calls belong to exactly one hostile input, so "which payload reached `shell.openPath`"
        // is answerable.
        const own = await launchApp({ mock: false, env: { E2E_REAL: '1' } });
        try {
          await acceptTermsGate(own.page);
          await installSideEffectStubs(own.app);

          const methods = classification.requests.filter((name) => !NON_IPC_METHODS.has(name));
          const outcomes = (await sweepWithInput(own.page, inputId, methods)) as CallOutcome[];

          expect(outcomes.length, 'the sweep must actually call something').toBe(methods.length);
          expect(await isPageAlive(own.page), 'the renderer must still be alive after the sweep').toBe(true);

          // A method skipped to stay inside the sweep budget is an untested method. It has to fail
          // loudly, otherwise raising SWEEP_BUDGET_MS becomes a quiet way to stop testing things.
          const skipped = outcomes.filter((o) => o.status === 'skipped');
          expect(
            skipped,
            `${skipped.length} method(s) were never called because the sweep exceeded ${SWEEP_BUDGET_MS}ms.\nSlowest completed calls:\n${describeSlowest(outcomes)}`,
          ).toHaveLength(0);

          const timeouts = outcomes.filter((o) => o.status === 'timeout' && !BLOCKING_BY_DESIGN.has(o.name));
          expect(timeouts, `methods that did not settle within ${PER_CALL_TIMEOUT_MS}ms:\n${describeSlowest(timeouts)}`).toHaveLength(0);

          // The methods that are allowed to block must still *finish*. A documented 5s wait is
          // correct; an unbounded wait is the same bug this suite exists to find.
          //
          // `blocked-at-bridge` counts as settled: when the hostile payload cannot be structured
          // cloned, the bridge rejects before the handler runs, so `playerGetFrame` never reaches
          // its 5s decoder timer. That is the handler being unreachable, not hanging, and the
          // `proxy-throws` input legitimately produces exactly this.
          const blockedForever = outcomes.filter(
            (o) => BLOCKING_BY_DESIGN.has(o.name) && o.status !== 'resolved' && o.status !== 'rejected' && o.status !== 'blocked-at-bridge',
          );
          expect(
            blockedForever,
            `methods that block by design must still settle rather than hang:\n${describeBadOutcomes('never settled', blockedForever)}`,
          ).toHaveLength(0);

          const missing = outcomes.filter((o) => o.status === 'missing');
          expect(missing, describeBadOutcomes('methods vanished mid-sweep', missing)).toHaveLength(0);

          // A rejection that names a JavaScript engine error is a handler that trusted its argument.
          // The message arrives prefixed by Electron ("Error invoking remote method 'x': ..."), so
          // the signature is matched anywhere in the string.
          const rawCrashes = outcomes.filter(
            (o) =>
              (o.status === 'rejected' || o.status === 'threw-sync') &&
              RAW_CRASH_SIGNATURES.some((pattern) => pattern.test(String(o.errorMessage))),
          );
          expect(rawCrashes, describeBadOutcomes('handlers crashed on an unvalidated argument', rawCrashes)).toHaveLength(0);

          // Every rejection must be a real, non-empty Error that the app's own formatter can render.
          const malformed = outcomes.filter((o) => {
            if (o.status !== 'rejected' && o.status !== 'threw-sync') return false;
            if (String(o.errorMessage).trim() === '') return true;
            if (!o.errorName || o.errorName === 'Object') return true;
            try {
              return formatError(new Error(String(o.errorMessage))).message.trim() === '';
            } catch {
              return true;
            }
          });
          expect(malformed, describeBadOutcomes('rejections that are not a formattable Error', malformed)).toHaveLength(0);

          // `blocked-at-bridge` is the correct answer for values structured clone cannot carry, and
          // is only legitimate for those inputs. Anything else leaking through would mean the bridge
          // silently coerced a hostile value into something a handler trusted.
          const bridgeBlocked = outcomes.filter((o) => o.status === 'blocked-at-bridge');
          const cloneIncapable: HostileInputId[] = ['proxy-throws', 'symbol', 'function'];
          if (bridgeBlocked.length > 0) {
            expect(
              cloneIncapable,
              `only ${cloneIncapable.join(', ')} are expected to be rejected by the clone boundary, but ${bridgeBlocked
                .map((o) => `${o.name} (${o.errorMessage})`)
                .join(', ')} were blocked`,
            ).toContain(inputId);
          }

          expectBoundaryContracts(await takeStubCalls(own.app), inputId);
        } finally {
          // Always tear the app down. Leaving it running leaks one Electron instance per hostile
          // input and makes a failed run depend on how far it got.
          await closeApp(own.app, own.userDataDir);
        }
      },
      SWEEP_TIMEOUT_MS,
    );
  }

  it(
    'has a working API after the abuse: a benign call still resolves',
    async () => {
      // The sweeps above are allowed to be destructive to *arguments*; they are not allowed to be
      // destructive to the *app*. This is the assertion that a night of hostile calls did not leave
      // the queue, the updater or the handlers themselves wedged.
      //
      // Self-contained on purpose. It originally ran on the shared classification session, which
      // meant the test inherited whatever state the preceding eight minutes of sweeps had left
      // behind - and when that session had died, this reported "Target page, context or browser has
      // been closed", blaming the API for the harness's own lifecycle.
      const own = await launchApp({ mock: false, env: { E2E_REAL: '1' } });
      try {
        await acceptTermsGate(own.page);
        await installSideEffectStubs(own.app);

        // Abuse first, so "still works" means something. `cyclic` is the input that crashed two
        // separate `JSON.stringify` call sites before either was fixed.
        const methods = classification.requests.filter((name) => !NON_IPC_METHODS.has(name));
        await sweepWithInput(own.page, 'cyclic', methods);

        const result = await own.page.evaluate(async () => {
          const api = (
            window as unknown as {
              electronAPI: {
                getCapabilities: () => Promise<unknown>;
                queueList: () => Promise<unknown[]>;
                queueCancelAll: () => Promise<unknown>;
              };
            }
          ).electronAPI;
          await api.queueCancelAll();
          const [capabilities, jobs] = await Promise.all([api.getCapabilities(), api.queueList()]);
          return { capabilitiesType: typeof capabilities, jobCount: jobs.length };
        });
        expect(result.capabilitiesType).toBe('object');
        expect(result.jobCount).toBe(0);
        expect(await isPageAlive(own.page), 'the app must survive the abuse, not just the calls').toBe(true);
      } finally {
        await closeApp(own.app, own.userDataDir);
      }
    },
    SWEEP_TIMEOUT_MS,
  );
});
