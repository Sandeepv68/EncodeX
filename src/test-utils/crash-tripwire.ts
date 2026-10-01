/**
 * @fileoverview Global crash tripwire for the unit and integration suites.
 *
 * Vitest already reports unhandled Node rejections, but two large classes of
 * failure slip through it in this repo:
 *
 * 1. **jsdom swallows renderer-side async throws.** `window`'s `error` and
 *    `unhandledrejection` events never reach the Node `process` listeners
 *    Vitest installs, so a rejected promise inside a React effect, a store
 *    subscription, or an event handler fails nothing. That is how "the UI
 *    silently stopped working" ships.
 * 2. **`console.error` is invisible.** React logs every render-phase throw
 *    through `console.error`. A test can therefore pass while the component
 *    under test is crashing on every render, and while the shipped app fills
 *    its Logs page with errors nobody reads.
 *
 * This module installs process-wide listeners and console wrappers once per
 * worker process and records every occurrence with a stack. A `beforeEach`
 * drops anything that landed between tests; an `afterEach` fails the test on
 * anything recorded during it.
 *
 * A test that genuinely needs a console error must declare it with
 * {@link expectCrash}. That is deliberately a visible, greppable act in the
 * diff rather than a silent `.skip`.
 *
 * @see src/test-setup.ts, src/test-setup.crash.ts
 */

import { format as utilFormat } from 'node:util';
import { afterEach, beforeEach } from 'vitest';

/**
 * Classification of a recorded fault.
 *
 * The `app*` kinds are the application's own structured log output. They are
 * deliberately separated from the `console*` kinds because "the app logged that
 * a conversion failed" is correct behaviour, while "React logged that a render
 * threw" is a defect.
 * @const
 */
export type CrashKind =
  'unhandledRejection' | 'uncaughtException' | 'windowError' | 'windowRejection' | 'consoleError' | 'consoleWarn' | 'appError' | 'appWarn';

/** @interface */
export interface CrashRecord {
  /** Which listener/wrapper saw it. */
  kind: CrashKind;
  /** Human-readable, already stringified and truncated. */
  text: string;
  /** Formatted stack when the underlying value carried one. */
  stack?: string;
  /** Logger context label, e.g. `renderer/stores/errorStore`. App records only. */
  context?: string;
}

/**
 * How aggressive the gate is. Ratcheted up over time so the remaining noise can
 * be drained incrementally instead of in one unmergeable commit.
 *
 * - `crash` (default) - uncaught faults and non-application console output fail.
 * - `strict` - additionally fails on `console.warn` and the app's own warnings.
 * - `exhaustive` - additionally fails on the app's own error logs, so every
 *   handled error path must be declared with {@link expectAppLog}.
 * @const
 */
export type Strictness = 'crash' | 'strict' | 'exhaustive';

/**
 * The `Logger` envelope from `src/shared/logger.ts`:
 * `console.error('[<iso>] [ERROR] [<context>]', ...args)`.
 *
 * Matching on the structural shape rather than on a message substring is what
 * makes it safe: any other `console.error` reaching the wrapper is classified
 * as a genuine console fault, so this can only ever *reduce* false positives,
 * never hide a React/DOM crash.
 * @const
 */
const APP_LOG_ENVELOPE = /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[(DEBUG|INFO|WARN|ERROR)\] \[([^\]]*)\]/;

/** Kinds that are fatal in every mode. */
const ALWAYS_FATAL: ReadonlySet<CrashKind> = new Set<CrashKind>([
  'unhandledRejection',
  'uncaughtException',
  'windowError',
  'windowRejection',
  'consoleError',
]);

/**
 * Extra kinds that only become fatal at a given strictness. The `crash` entry
 * is an empty set rather than an absent key so {@link isFatal} is total.
 */
const FATAL_AT: Record<Strictness, ReadonlySet<CrashKind>> = {
  crash: new Set<CrashKind>(),
  strict: new Set<CrashKind>(['consoleWarn', 'appWarn']),
  exhaustive: new Set<CrashKind>(['consoleWarn', 'appWarn', 'appError']),
};

/**
 * Decides whether a recorded fault must fail the test.
 *
 * Exported and total by design: a missing strictness key once made every test
 * in the suite die with `Cannot read properties of undefined (reading 'has')`,
 * which is exactly the kind of tripwire bug that hides the bugs it is meant to
 * surface.
 * @param {CrashKind} kind - The recorded classification.
 * @param {Strictness} strictness - The active level.
 * @returns {boolean} True when the record must fail the test.
 */
export function isFatal(kind: CrashKind, strictness: Strictness): boolean {
  return ALWAYS_FATAL.has(kind) || FATAL_AT[strictness].has(kind);
}

/** Guard so a reused worker installs the tripwire exactly once; see {@link install}. @const */
const TRIPWIRE_FLAG = '__encodexCrashTripwire__';

/** Hard cap so a crash loop cannot exhaust memory. @const */
const MAX_RECORDS = 200;

/** Per-record text/stack cap; a thrown 10 MB string must not be retained. @const */
const MAX_TEXT = 2000;

/** @interface */
interface TripwireState {
  records: CrashRecord[];
  /** Declared-by-the-test allowances, reset per test. */
  expected: Array<{ kind: CrashKind; pattern: RegExp }>;
  /** Records dropped in `beforeEach` that arrived after the previous test ended. */
  stale: number;
  /** Capped, cycle-safe recorder shared by the listeners and console wrappers. */
  push: (kind: CrashKind, value: unknown, text?: string, context?: string) => void;
  /** How aggressive the gate is, from `ENCODEX_STRICT_TESTS`. */
  strictness: Strictness;
  /** The console method the *active* wrapper delegates to once it has recorded. */
  passthroughError: (...args: unknown[]) => void;
  passthroughWarn: (...args: unknown[]) => void;
  /** Identity of the currently authoritative wrapper, used to retire stale ones. */
  activeError: ((...args: unknown[]) => void) | null;
  activeWarn: ((...args: unknown[]) => void) | null;
}

/**
 * Maps `ENCODEX_STRICT_TESTS` onto a strictness level.
 *
 * Unset or `0` is the baseline gate; `1` and `2` progressively ratchet up. Any
 * other value is treated as the baseline so a typo in CI degrades to the
 * weakest setting rather than the strongest.
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

/**
 * Classifies the first `console.*` argument against the application log
 * envelope.
 * @param {unknown} first - The first argument passed to `console.error`/`warn`.
 * @returns {{ context: string } | null} The logger context, or null if not an app log.
 */
function asAppLog(first: unknown): { context: string } | null {
  if (typeof first !== 'string') return null;
  const match = APP_LOG_ENVELOPE.exec(first);
  return match ? { context: match[2] } : null;
}

/**
 * Stringifies an arbitrary thrown value without ever throwing itself.
 *
 * `console.error({ a: 1 })` is legal and common, and so is a value with a
 * `toJSON` that throws or a getter that throws - both of which would make a
 * naive `JSON.stringify` in the tripwire throw *inside the console wrapper*,
 * turning a caught fault into a new uncaught one.
 * @param {unknown} value - The value to render.
 * @returns {string} A bounded, cycle-safe string.
 */
function describeValue(value: unknown): string {
  const type = typeof value;
  if (type === 'string') return value as string;
  if (type === 'undefined') return 'undefined';
  if (type === 'bigint') return `${String(value)}n`;
  if (type === 'symbol') return String(value);
  if (value === null) return 'null';
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Event) return `Event(${value.type})`;
  try {
    const seen = new WeakSet<object>();
    return (
      JSON.stringify(value, (_key, val: unknown) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        if (typeof val === 'bigint') return `${String(val)}n`;
        return val;
      }) ?? String(value)
    );
  } catch {
    return `[unserialisable ${type}]`;
  }
}

/**
 * Renders a `console.*` argument list.
 *
 * React and Node both use `util.format` semantics (`%s`, `%d`, `%o`, `%j`) and
 * pass a component name or value as a separate argument, so joining with spaces
 * would report "An update to %s inside a test" and hide the one detail that
 * identifies the culprit. `util.format` is used first, with a
 * never-throwing fallback for the hostile values handled by {@link describeValue}.
 * @param {unknown[]} args - Arguments.
 * @returns {string} A bounded, human-readable rendering.
 */
function describeArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  let text: string;
  try {
    text = utilFormat(...args);
  } catch {
    text = args.map(describeValue).join(' ');
  }
  return text.slice(0, MAX_TEXT);
}

/**
 * Extracts a stack without ever throwing.
 *
 * `console.error(err, context)` is the common shape, and the stack is the only
 * part of the record that says *where* the fault came from, so an argument list
 * is scanned for its first `Error` rather than only accepting a lone value.
 * @param {unknown} value - Thrown value, or a `console.*` argument list.
 * @returns {string|undefined} A bounded stack, when one was available.
 */
function stackOf(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value.find((entry): entry is Error => entry instanceof Error) : value;
  const raw = candidate instanceof Error ? candidate.stack : undefined;
  if (typeof raw !== 'string') return undefined;
  return raw.length > MAX_TEXT ? `${raw.slice(0, MAX_TEXT)}...` : raw;
}

/**
 * Installs the tripwire, or returns the already-installed one.
 *
 * `pool: 'forks'` with isolation on gives every test file its own child
 * process, so this runs once per file - but it is still memoised, because a
 * setup file that is ever loaded twice in one process (a `setupFiles` entry
 * plus an explicit import, say) would otherwise stack a second pair of
 * listeners on top of the first and start double-recording every fault.
 * @returns {TripwireState} The shared recorder state.
 */
function install(): TripwireState {
  const scope = globalThis as unknown as Record<string, unknown>;
  const existing = scope[TRIPWIRE_FLAG] as TripwireState | undefined;
  if (existing) return existing;

  const state: TripwireState = {
    records: [],
    expected: [],
    strictness: readStrictness(),
    stale: 0,
    push: () => undefined,
    passthroughError: console.error.bind(console),
    passthroughWarn: console.warn.bind(console),
    activeError: null,
    activeWarn: null,
  };

  state.push = (kind: CrashKind, value: unknown, text?: string, context?: string): void => {
    if (state.records.length >= MAX_RECORDS) return;
    const entry: CrashRecord = { kind, text: (text ?? describeValue(value)).slice(0, MAX_TEXT) };
    const stack = stackOf(value);
    if (stack) entry.stack = stack;
    if (context !== undefined) entry.context = context;
    state.records.push(entry);
  };

  scope[TRIPWIRE_FLAG] = state;

  process.on('unhandledRejection', (reason) => state.push('unhandledRejection', reason));
  process.on('uncaughtException', (err) => state.push('uncaughtException', err));

  // The renderer half. Guarded because the integration suite runs in the
  // `node` environment where there is no `window`.
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => state.push('windowError', event.error ?? event.message, event.message));
    window.addEventListener('unhandledrejection', (event) => state.push('windowRejection', (event as PromiseRejectionEvent).reason));
  }

  return state;
}

/**
 * Ensures exactly one live console wrapper per method.
 *
 * Two hazards are handled here:
 *
 * 1. **A leaked stub blinds detection.** A test that calls
 *    `vi.spyOn(console, 'error').mockImplementation(noop)` and never restores
 *    leaves its stub installed, and the tripwire stops seeing anything. When
 *    the current value is not our own wrapper, it is re-wrapped.
 * 2. **Re-wrapping would double-record.** The previous wrapper is still in the
 *    call chain underneath whatever was layered on top of it, so both would
 *    record and both would print. Every wrapper therefore checks whether it is
 *    still the active one; a retired wrapper does nothing at all, which leaves
 *    exactly one record and one line of output per call.
 *
 * A test that stubs `console.error` with a *non*-delegating implementation
 * still opts out of detection - that is intentional, since replacing the
 * console is an explicit statement that its output is not what is under test.
 * @returns {TripwireState} The shared recorder state.
 */
function ensureConsolePatched(): TripwireState {
  const state = install();

  if (console.error !== state.activeError) {
    const wrapper = (...args: unknown[]): void => {
      if (state.activeError !== wrapper) return;
      const app = asAppLog(args[0]);
      state.push(app ? 'appError' : 'consoleError', args, describeArgs(args), app?.context);
      state.passthroughError.apply(console, args);
    };
    state.activeError = wrapper;
    console.error = wrapper;
  }

  if (console.warn !== state.activeWarn) {
    const wrapper = (...args: unknown[]): void => {
      if (state.activeWarn !== wrapper) return;
      const app = asAppLog(args[0]);
      state.push(app ? 'appWarn' : 'consoleWarn', args, describeArgs(args), app?.context);
      state.passthroughWarn.apply(console, args);
    };
    state.activeWarn = wrapper;
    console.warn = wrapper;
  }

  return state;
}

/** @param {CrashRecord} record - A recorded fault. @returns {string} A report line. */
function formatRecord(record: CrashRecord): string {
  const where = record.context ? ` (${record.context})` : '';
  const head = `[${record.kind}]${where} ${record.text}`;
  return record.stack ? `${head}\n${indent(record.stack)}` : head;
}

/** @param {string} text - Text to indent. @returns {string} */
function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');
}

/**
 * Declares that the current test is expected to produce a matching fault.
 *
 * Multiple declarations accumulate, so a test that expects both a rejected
 * promise and a `console.error` calls this once per expectation. Declarations
 * are cleared after each test.
 * @param {CrashKind} kind - The classification to allow.
 * @param {string|RegExp} pattern - Substring or regexp the record text must match.
 */
export function expectCrash(kind: CrashKind, pattern: string | RegExp): void {
  install().expected.push({ kind, pattern: typeof pattern === 'string' ? new RegExp(escapeRegExp(pattern)) : pattern });
}

/**
 * Declares an expected application log record, by level and logger context.
 *
 * This is the `exhaustive`-mode counterpart of {@link expectCrash}: it pins
 * *which subsystem* was expected to log, not just that something was logged.
 * @param {'error'|'warn'} level - Log severity.
 * @param {string|RegExp} context - The logger context, e.g. `/errorStore/`.
 */
export function expectAppLog(level: 'error' | 'warn', context: string | RegExp): void {
  const kind: CrashKind = level === 'error' ? 'appError' : 'appWarn';
  const pattern =
    typeof context === 'string' ? new RegExp(`\\[${escapeRegExp(level.toUpperCase())}\\] \\[${escapeRegExp(context)}\\]`) : context;
  install().expected.push({ kind, pattern });
}

/** @param {string} text - Literal text. @returns {string} */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns and clears everything recorded since the last call.
 *
 * Exposed for tests of the tripwire itself and for the rare suite that wants
 * to assert on the *contents* of what leaked.
 * @returns {CrashRecord[]} The records, oldest first.
 */
export function takeRecordedCrashes(): CrashRecord[] {
  const state = install();
  return state.records.splice(0, state.records.length);
}

/** @returns {Strictness} The active strictness level. */
export function getStrictness(): Strictness {
  return install().strictness;
}

/**
 * Suppresses tripwire-recorded console output while keeping detection on.
 *
 * Tests that deliberately drive error paths would otherwise flood the run with
 * stderr, and silencing them with `mockImplementation(noop)` blinds the
 * tripwire instead. This keeps the recording and drops only the print.
 * @returns {() => void} A function that restores normal console output.
 */
export function silenceConsoleOutput(): () => void {
  const state = install();
  const error = state.passthroughError;
  const warn = state.passthroughWarn;
  state.passthroughError = () => undefined;
  state.passthroughWarn = () => undefined;
  return () => {
    state.passthroughError = error;
    state.passthroughWarn = warn;
  };
}

/**
 * Returns every application error/warning log recorded during the test.
 *
 * Used to assert on diagnostics rather than merely tolerate them, which turns
 * the app's error logging from "noise we had to silence" into a covered
 * behaviour. Honours `expectAppLog` declarations, so a test can either inspect
 * the full set or pin the specific records it cares about.
 * @returns {CrashRecord[]} The recorded application log records.
 */
export function getAppLogs(): CrashRecord[] {
  return install().records.filter((entry) => entry.kind === 'appError' || entry.kind === 'appWarn');
}

/**
 * Registers the per-test clear/assert hooks.
 *
 * `beforeEach` drops faults that arrived after the previous test finished (a
 * leaked timer firing late). Those are recorded as `stale` and reported in
 * strict mode rather than being blamed on the next test, which would make the
 * failure unreadable.
 */
export function registerCrashAssertions(): void {
  install();

  beforeEach(() => {
    const state = ensureConsolePatched();
    state.stale += state.records.length;
    state.records.length = 0;
    state.expected.length = 0;
  });

  afterEach(() => {
    const state = ensureConsolePatched();
    const unexpected = state.records.filter(
      (entry) => !state.expected.some((allow) => allow.kind === entry.kind && allow.pattern.test(entry.text)),
    );
    state.records.length = 0;
    state.expected.length = 0;

    if (state.strictness !== 'crash' && state.stale > 0) {
      // Surfaced through process.emitWarning rather than console.warn, which is
      // itself a recorded kind and would recurse.
      process.emitWarning(
        `crash-tripwire: dropped ${state.stale} fault(s) that arrived after the previous test ended (leaked async work)`,
        'EncodeXCrashTripwire',
      );
    }
    state.stale = 0;

    const fatal = unexpected.filter((entry) => isFatal(entry.kind, state.strictness));
    if (fatal.length === 0) return;

    const report = fatal.slice(0, 20).map(formatRecord).join('\n');
    const overflow = fatal.length > 20 ? `\n  ...and ${fatal.length - 20} more` : '';
    throw new Error(
      `crash-tripwire (${state.strictness}): ${fatal.length} unexpected ${fatal.length === 1 ? 'fault' : 'faults'} during this test. ` +
        `Unhandled exceptions must not escape into production; fix the cause, or declare the expected fault with ` +
        `expectCrash(kind, /pattern/) (or expectAppLog(level, context)) if the test provokes it on purpose.\n` +
        `${report}${overflow}`,
    );
  });
}
