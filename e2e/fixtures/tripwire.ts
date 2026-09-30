/**
 * @fileoverview Global crash tripwire for the Playwright e2e suites.
 *
 * Before this module existed, not one of the e2e specs observed anything the
 * app did wrong. A renderer that threw on every mount, a main process that
 * logged an unhandled rejection, a React error boundary catching a render
 * crash - none of it failed a test, because nothing was listening. The suite
 * was green precisely when the GUI was broken.
 *
 * This recorder is attached by {@link launchApp}, so every spec inherits it
 * for free, and re-attached on every relaunch (`ensureLiveSession` /
 * `reloadSession` go back through `launchApp`). The assertion side lives in
 * `e2e/fixtures/tripwire-setup.ts`, which registers the `beforeEach` /
 * `afterEach` hooks; splitting the two is deliberate - the hooks must be
 * registered during collection, not from inside `beforeAll` where a spec
 * launches the app.
 *
 * Five signals are captured:
 *
 * | kind            | source                                              |
 * |-----------------|-----------------------------------------------------|
 * | `pageerror`     | uncaught exception in the renderer                  |
 * | `console`       | `console.error` / `console.warn` in the renderer    |
 * | `crash`         | Chromium renderer process died                      |
 * | `mainException` | `uncaughtException` / `unhandledRejection` in main   |
 * | `mainStderr`    | the same faults as they surface on the main stderr  |
 * | `netfail`       | a request that failed to load                       |
 *
 * Console output is classified against the application log envelope
 * (`[<iso>] [LEVEL] [<context>]`, see `src/shared/logger.ts`) so that "the app
 * logged that a conversion failed" - which is correct behaviour - is not
 * confused with "React logged that a render threw" - which is a defect.
 * Matching structurally rather than on a message substring means the
 * classification can only ever reduce false positives, never hide a crash.
 *
 * A test that provokes a fault on purpose declares it with
 * {@link expectTripwire} rather than muting the console.
 *
 * @see e2e/fixtures/app.ts, e2e/fixtures/tripwire-setup.ts
 * @see src/test-utils/crash-tripwire.ts for the unit-suite equivalent
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ElectronApplication, Page } from 'playwright';

/**
 * Classification of a recorded fault.
 *
 * `appError` / `appWarn` are the application's own structured log output and are
 * deliberately separate from the `console*` kinds for the same reason they are
 * in the unit tripwire.
 * @const
 */
export type TripwireKind =
  | 'pageerror'
  | 'console'
  | 'consoleWarn'
  | 'appError'
  | 'appWarn'
  | 'crash'
  | 'mainException'
  | 'mainStderr'
  | 'netfail'
  | 'tripwireFailure';

/** @interface */
export interface TripwireEntry {
  /** Which listener saw it. */
  kind: TripwireKind;
  /** Human-readable, already stringified and truncated. */
  text: string;
  /**
   * True when the fault landed between tests rather than during one, so it
   * could not be attributed to the test that provoked it. Boot-time and
   * teardown-time faults - exactly the ones nobody suspects - arrive this way.
   */
  stale?: boolean;
}

/**
 * How aggressive the gate is, mirroring `src/test-utils/crash-tripwire.ts` so
 * that `ENCODEX_STRICT_TESTS` means the same thing in both suites.
 *
 * - `crash` (default) - uncaught faults and non-application console output fail.
 * - `strict` - additionally fails on warnings and failed requests.
 * - `exhaustive` - additionally fails on the app's own error logs.
 * @const
 */
export type Strictness = 'crash' | 'strict' | 'exhaustive';

/**
 * Per-kind fatality. Exported as a total table rather than a set-membership
 * test because a missing key here would throw from inside the assertion
 * formatter, which is the exact failure mode that hides bugs.
 *
 * `report` means "always listed in the failure message, never fatal". `netfail`
 * is in that bucket because Chromium cancels in-flight requests on every
 * navigation and on teardown, so a fatal-by-default `requestfailed` guarantees
 * a permanently red suite and the signal gets ignored entirely.
 * @const
 */
const FATALITY: Record<TripwireKind, 'fatal' | 'strict' | 'exhaustive' | 'report'> = {
  pageerror: 'fatal',
  console: 'fatal',
  crash: 'fatal',
  mainException: 'fatal',
  mainStderr: 'fatal',
  tripwireFailure: 'fatal',
  consoleWarn: 'strict',
  appWarn: 'exhaustive',
  appError: 'exhaustive',
  netfail: 'report',
};

const RANK: Record<Strictness, number> = { crash: 0, strict: 1, exhaustive: 2 };

/** @interface */
interface AllowEntry {
  /** The kind this entry silences, or `any` for every kind. */
  kind: TripwireKind | 'any';
  /** Regular-expression source matched against the entry text. */
  pattern: string;
  /** Why this is expected; surfaced in the failure report. */
  reason: string;
  /** ISO date the entry was added. */
  addedOn: string;
  /** ISO date after which the entry must be revisited or removed. */
  reviewBy: string;
}

/**
 * The `Logger` envelope: `console.error('[<iso>] [ERROR] [<context>]', ...)`.
 * @const
 */
const APP_LOG_ENVELOPE = /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[(DEBUG|INFO|WARN|ERROR)\] \[([^\]]*)\]/;

/**
 * Main-process stderr lines that mean the main process itself blew up. Kept
 * tight on purpose: Electron and Chromium write a lot of advisory noise to
 * stderr, and a loose pattern here would be permanently red.
 * @const
 */
const MAIN_FAULT_STDERR =
  /(uncaughtException|unhandledRejection|UnhandledPromiseRejection|Unhandled 'error' event|A JavaScript error occurred in the main process)/i;

/** Hard cap so a crash loop cannot exhaust the test process's memory. @const */
const MAX_ENTRIES = 200;

/** Per-entry text cap; a thrown 10 MB string must not be retained. @const */
const MAX_TEXT = 2000;

/** How many distinct entries a failure message prints before summarising. @const */
const MAX_REPORTED = 20;

/**
 * Milliseconds to let Playwright's socket readers flush before draining.
 *
 * `page.on('console')` is delivered asynchronously over the CDP pipe, so a
 * `console.error` logged by the renderer microseconds before an assertion
 * failed can arrive after `afterEach` has already drained. Without this pause
 * the tripwire would miss exactly the errors it exists to catch, intermittently
 * and without any signal that it had done so.
 * @const
 */
const FLUSH_MS = 50;

/** @interface */
interface Session {
  app: ElectronApplication;
  /** False once the app has closed, so a drain skips it instead of throwing. */
  alive: boolean;
}

/** Live recorder state. Module-level because the app outlives any single test. @const */
const entries: TripwireEntry[] = [];

/** Faults the active test declared as expected. Cleared per test. @const */
const declared: Array<{ kind: TripwireKind; pattern: RegExp }> = [];

/** Every app the tripwire has ever attached to, so a drain can read them all. @const */
const sessions: Session[] = [];

/** Pages already wired, so `app.on('window')` and `launchApp` do not double up. @const */
const wiredPages = new WeakSet<Page>();

/** Memoised allowlist; the JSON cannot change within a run. @const */
let allowlist: AllowEntry[] | null = null;

/**
 * Maps `ENCODEX_STRICT_TESTS` onto a strictness level.
 *
 * Unset or `0` is the baseline gate. Any unrecognised value degrades to the
 * weakest setting rather than the strongest, so a typo in CI cannot turn a
 * green suite red for a reason nobody can reproduce.
 * @returns {Strictness} The resolved level.
 */
function readStrictness(): Strictness {
  switch (process.env.ENCODEX_STRICT_TESTS) {
    case '1':
      return 'strict';
    case '2':
      return 'exhaustive';
    default:
      return 'crash';
  }
}

/** @returns {Strictness} The active strictness level. */
export function getTripwireStrictness(): Strictness {
  return readStrictness();
}

/**
 * Decides whether a recorded fault must fail the test.
 * @param {TripwireKind} kind - The recorded classification.
 * @param {Strictness} strictness - The active level.
 * @returns {boolean} True when the record must fail the test.
 */
export function isFatalTripwireKind(kind: TripwireKind, strictness: Strictness): boolean {
  const level = FATALITY[kind];
  if (level === 'fatal') return true;
  if (level === 'report') return false;
  return RANK[strictness] >= RANK[level];
}

/**
 * Loads the allowlist, and records a fatal entry for anything past its review
 * date.
 *
 * An allowlist with no expiry is how a suppression list becomes permanent: the
 * entry outlives the bug it was written for, and the next occurrence of the
 * same text is silently accepted forever. Failing on the stale entry forces
 * somebody to re-read it.
 * @returns {AllowEntry[]} The parsed allowlist.
 */
export function loadAllowlist(): AllowEntry[] {
  if (allowlist) return allowlist;
  const file = path.join(__dirname, 'allowed-errors.json');
  let parsed: AllowEntry[];
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as AllowEntry[];
  } catch (err) {
    record('tripwireFailure', `allowed-errors.json is unreadable: ${String(err)}`);
    allowlist = [];
    return allowlist;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of parsed) {
    if (entry.reviewBy && entry.reviewBy < today) {
      record(
        'tripwireFailure',
        `allowed-errors.json entry /${entry.pattern}/ (added ${entry.addedOn}) passed its review date ${entry.reviewBy}. ` +
          `Re-read it, then either fix the cause or extend reviewBy with a reason.`,
      );
    }
  }
  allowlist = parsed;
  return allowlist;
}

/**
 * Appends a fault, honouring the cap and the length limit.
 * @param {TripwireKind} kind - Classification.
 * @param {string} text - Human-readable description.
 * @param {boolean} [stale] - True when recorded between tests.
 */
function record(kind: TripwireKind, text: string, stale = false): void {
  if (entries.length >= MAX_ENTRIES) return;
  const entry: TripwireEntry = { kind, text: text.slice(0, MAX_TEXT) };
  if (stale) entry.stale = true;
  entries.push(entry);
}

/**
 * Renders a `pageerror` value, keeping the stack because that is the only part
 * that says *where* the renderer blew up.
 * @param {unknown} err - The value Playwright handed to the `pageerror` listener.
 * @returns {string} A bounded description.
 */
function describeRendererError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ? `${err.name}: ${err.message}\n${err.stack}` : `${err.name}: ${err.message}`;
  }
  return String(err);
}

/**
 * Classifies a renderer console message.
 *
 * The first argument of a `console.*` call is the only reliable place to look:
 * a `console.error('failed to load', error)` has its error in the second
 * argument, and the app logger always leads with the envelope.
 * @param {string} type - Playwright's console message type.
 * @param {string} text - The rendered message.
 * @returns {TripwireKind|null} The classification, or null when the message is not a failure.
 */
export function classifyConsoleMessage(type: string, text: string): TripwireKind | null {
  if (type === 'error') {
    return APP_LOG_ENVELOPE.test(text) ? 'appError' : 'console';
  }
  if (type === 'warning') {
    return APP_LOG_ENVELOPE.test(text) ? 'appWarn' : 'consoleWarn';
  }
  // `debug`, `info`, `log`, `dir`, `trace`, ... are not failures.
  return null;
}

/**
 * Attaches the renderer-side listeners to one page.
 *
 * `page.on` survives `page.reload()` (it is page-scoped, not execution-context
 * scoped), so a spec that reloads per test needs no re-wiring.
 * @param {Page} page - The page to watch.
 */
function wirePage(page: Page): void {
  if (wiredPages.has(page)) return;
  wiredPages.add(page);

  page.on('pageerror', (err) => record('pageerror', describeRendererError(err)));
  page.on('crash', () => record('crash', 'Chromium renderer process crashed (page.on("crash"))'));
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const kind = classifyConsoleMessage(type, msg.text());
    if (kind) record(kind, msg.text());
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    record('netfail', `${req.url()} - ${failure ? failure.errorText : 'unknown failure'}`);
  });
}

/**
 * Installs the main-process recorder.
 *
 * `app.evaluate` runs the function inside the Electron main process, so these
 * listeners see faults the test process can never observe.
 *
 * Installing an `uncaughtException` listener does change one behaviour: Node
 * would otherwise tear the process down, and Electron would fall back to its
 * "A JavaScript error occurred in the main process" dialog. The listener
 * records instead, which keeps the process alive. That is the point - the
 * recorded entry fails the test either way - but it is also why a main-process
 * crash cannot be allowed to end the run silently.
 * @param {ElectronApplication} app - The running app.
 */
async function installMainRecorder(app: ElectronApplication): Promise<void> {
  try {
    await app.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      if (scope.__encodexE2eTripwire) return;
      scope.__encodexE2eTripwire = true;
      const captured: string[] = [];
      scope.__encodexE2eMainErrors = captured;

      const describe = (value: unknown): string => {
        try {
          if (value instanceof Error) return value.stack ? `${value.name}: ${value.message}\n${value.stack}` : String(value);
          if (typeof value === 'string') return value;
          return JSON.stringify(value) ?? String(value);
        } catch {
          return String(value);
        }
      };

      process.on('uncaughtException', (err) => captured.push(describe(err)));
      process.on('unhandledRejection', (reason) => captured.push(`unhandledRejection: ${describe(reason)}`));
    });
  } catch (err) {
    record('tripwireFailure', `could not install the main-process recorder: ${String(err)}`);
  }
}

/**
 * Watches the main process' stderr for faults it failed to route through
 * `process`.
 *
 * A throw inside a `setImmediate` callback or a promise chain Electron owns can
 * bypass the process listeners, but it still reaches stderr, so the two sources
 * are complementary rather than redundant.
 * @param {ElectronApplication} app - The running app.
 */
function wireMainStderr(app: ElectronApplication): void {
  let proc: ReturnType<ElectronApplication['process']>;
  try {
    proc = app.process();
  } catch {
    return;
  }
  const stream = proc?.stderr;
  if (!stream) return;

  let carry = '';
  stream.on('data', (chunk: Buffer | string) => {
    const lines = `${carry}${chunk.toString()}`.split(/\r?\n/);
    carry = lines.pop() ?? '';
    for (const line of lines) {
      if (MAIN_FAULT_STDERR.test(line)) record('mainStderr', line.trim());
    }
  });
}

/**
 * Attaches the whole tripwire to a freshly launched app.
 *
 * Called from `launchApp` rather than from each spec, and re-called on every
 * relaunch, which is what makes "every spec inherits it" true by construction:
 * a new spec that forgets to opt in still fails on a crashing renderer.
 *
 * The page argument is optional on purpose. Registering the `window` listener
 * before the first BrowserWindow exists is what catches boot-time faults, which
 * are the ones nobody suspects and the ones a broken main process produces.
 * @param {ElectronApplication} app - The running app.
 */
export function attachTripwire(app: ElectronApplication): void {
  const session: Session = { app, alive: true };
  sessions.push(session);
  app.on('close', () => {
    session.alive = false;
  });
  app.on('window', (win) => wirePage(win));
  for (const win of app.windows()) wirePage(win);
  wireMainStderr(app);
  void installMainRecorder(app);
}

/**
 * Pulls the main-process records accumulated since the last read.
 *
 * The array is spliced rather than read whole so a fault is reported by the
 * test that provoked it, not repeated by every test that follows.
 * @param {Session} session - The app to read.
 * @returns {Promise<void>} Resolves once drained.
 */
async function collectMainErrors(session: Session): Promise<void> {
  if (!session.alive) return;
  try {
    const captured = await session.app.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      const list = scope.__encodexE2eMainErrors;
      if (!Array.isArray(list)) return [] as string[];
      return list.splice(0, list.length) as string[];
    });
    for (const text of captured) record('mainException', text);
  } catch {
    // The app is gone or wedged. `session.alive` is cleared and a crash that
    // took the process down is already visible to the spec that noticed.
    session.alive = false;
  }
}

/**
 * Declares that the current test is expected to produce a matching fault.
 *
 * Multiple declarations accumulate, so a test that expects both a renderer
 * `pageerror` and a `console` error calls this once per expectation. The
 * declaration is a visible, greppable act in the diff rather than a silent
 * `page.on('console', () => {})` inside the spec.
 * @param {TripwireKind} kind - The classification to allow.
 * @param {string|RegExp} pattern - Substring or regexp the entry text must match.
 */
export function expectTripwire(kind: TripwireKind, pattern: string | RegExp): void {
  declared.push({ kind, pattern: typeof pattern === 'string' ? new RegExp(escapeRegExp(pattern)) : pattern });
}

/**
 * Declares an expected application log record, by level and logger context.
 *
 * Pinning *which subsystem* was expected to log, rather than only that something
 * was logged, keeps the escape hatch from swallowing a different fault.
 * @param {'error'|'warn'} level - Log severity.
 * @param {string|RegExp} context - The logger context, e.g. `/errorStore/`.
 */
export function expectAppLogTripwire(level: 'error' | 'warn', context: string | RegExp): void {
  const kind: TripwireKind = level === 'error' ? 'appError' : 'appWarn';
  const pattern =
    typeof context === 'string' ? new RegExp(`\\[${escapeRegExp(level.toUpperCase())}\\] \\[${escapeRegExp(context)}\\]`) : context;
  declared.push({ kind, pattern });
}

/** @param {string} text - Literal text. @returns {string} */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tags everything recorded so far as *stale* and forgets the declarations.
 *
 * Anything recorded between the previous `afterEach` and this `beforeEach` -
 * most importantly a fault raised while the app was booting in `beforeAll` -
 * cannot be attributed to a test, so it is tagged and **kept**, not cleared:
 * the next test's report is the only place it can still surface, and a fault
 * dropped on the floor is the failure mode this whole plan exists to kill. The
 * {@link MAX_ENTRIES} cap still bounds the list, because a fault that arrives
 * while entries are pending is refused by {@link record} rather than queued.
 */
export function resetTripwire(): void {
  for (const entry of entries) entry.stale = true;
  declared.length = 0;
}

/**
 * Drains everything recorded during the active test, including the
 * main-process records.
 *
 * The per-test declarations are cleared by {@link resetTripwire} in the next
 * `beforeEach` rather than here, because the caller still has to evaluate the
 * drained entries against them.
 * @returns {Promise<TripwireEntry[]>} The recorded entries, oldest first.
 */
export async function takeTripwireEntries(): Promise<TripwireEntry[]> {
  loadAllowlist();
  await new Promise((resolve) => setTimeout(resolve, FLUSH_MS));
  for (const session of sessions) await collectMainErrors(session);
  return entries.splice(0, entries.length);
}

/**
 * A recorded fault matched by a declaration or the allowlist.
 * @param {TripwireEntry} entry - The recorded fault.
 * @returns {string|null} The reason it was tolerated, or null if it was not.
 */
export function toleratedBy(entry: TripwireEntry): string | null {
  const declaredMatch = declared.find((d) => d.kind === entry.kind && d.pattern.test(entry.text));
  if (declaredMatch) return 'declared with expectTripwire()';
  const allowed = loadAllowlist().find((a) => (a.kind === 'any' || a.kind === entry.kind) && safeRegExp(a.pattern).test(entry.text));
  return allowed ? `allowlisted: ${allowed.reason}` : null;
}

/**
 * Compiles an allowlist pattern, tolerating a bad regex in the data file.
 *
 * An invalid pattern must not be allowed to throw from inside the assertion
 * formatter: that would fail the test with an unrelated error and hide the
 * fault being reported. A pattern that will not compile matches nothing, which
 * degrades to "the entry is dead" - visible, and fixable.
 * @param {string} source - Regular-expression source.
 * @returns {RegExp} The compiled pattern, or one that never matches.
 */
function safeRegExp(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch {
    return /(?!)/;
  }
}

/** @param {TripwireEntry} entry - A recorded fault. @returns {string} A report line. */
function formatEntry(entry: TripwireEntry): string {
  const where = entry.stale ? ' (recorded between tests)' : '';
  return `[${entry.kind}]${where} ${entry.text}`;
}

/** @param {string} text - Text to indent. @returns {string} */
function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');
}

/** @interface */
export interface TripwireSuppression {
  /** The recorded fault that was tolerated. */
  entry: TripwireEntry;
  /** Why it was tolerated: a declaration, or the allowlist entry that matched. */
  reason: string;
}

/**
 * Builds the failure message for a non-empty set of fatal faults.
 *
 * Entries are deduplicated with a per-key count, because a render loop that
 * throws fires the same `console.error` thousands of times and twenty identical
 * lines bury the one that is actually different.
 * @param {TripwireEntry[]} fatal - The fatal faults.
 * @param {TripwireSuppression[]} suppressed - Faults a test or the allowlist explicitly tolerated.
 * @param {number} informational - Faults that are non-fatal by policy; reported as a count.
 * @param {Strictness} strictness - The active level.
 * @returns {string} The message to throw.
 */
export function formatTripwireFailure(
  fatal: TripwireEntry[],
  suppressed: TripwireSuppression[],
  informational: number,
  strictness: Strictness,
): string {
  const counts = new Map<string, { entry: TripwireEntry; count: number }>();
  for (const entry of fatal) {
    const key = `${entry.kind}\u0000${entry.text}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { entry, count: 1 });
  }
  const distinct = [...counts.values()];
  const report = distinct
    .slice(0, MAX_REPORTED)
    .map(({ entry, count }) => indent(count > 1 ? `${formatEntry(entry)}  (x${count})` : formatEntry(entry)))
    .join('\n');
  const hidden = distinct.length > MAX_REPORTED ? `\n  ...and ${distinct.length - MAX_REPORTED} more distinct fault(s)` : '';

  // Suppressions are listed even though they did not fail the test: a run that
  // leans on the allowlist should say so on the same screen as the failure, or
  // the allowlist quietly becomes the new normal.
  const tolerated =
    suppressed.length > 0
      ? `\n\nSuppressed (${suppressed.length}):\n${suppressed
          .slice(0, 5)
          .map(({ entry, reason }) => indent(`[${entry.kind}] ${entry.text.slice(0, 200)}\n        ${reason}`))
          .join('\n')}`
      : '';
  const quiet = informational > 0 ? `\n  (${informational} further non-fatal fault(s) recorded)` : '';

  return (
    `e2e-tripwire (${strictness}): ${fatal.length} unexpected ${fatal.length === 1 ? 'fault' : 'faults'} during this test ` +
    `(${distinct.length} distinct). A renderer exception, a console.error, or a main-process crash must never reach a user in a ` +
    `shipped build. Fix the cause, or declare the expected fault with expectTripwire(kind, /pattern/) (or ` +
    `expectAppLogTripwire(level, context)) if the test provokes it on purpose.\n${report}${hidden}${quiet}${tolerated}`
  );
}
