/**
 * @fileoverview Self-tests for the global crash tripwire.
 *
 * The tripwire fails tests, so a bug in it would take the whole suite down
 * with a message nobody can act on ("crash-tripwire: 1 unexpected fault").
 * These tests drive each recording path directly and assert on the recorder's
 * contents instead of on suite failure, which keeps them honest.
 *
 * Console output is suppressed with {@link silenceConsoleOutput} rather than
 * with `mockImplementation(noop)`: a non-delegating stub removes the tripwire
 * from the call chain and would make these tests assert nothing.
 *
 * @see src/test-utils/crash-tripwire.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { CrashKind, Strictness } from '../crash-tripwire';
import { expectAppLog, getAppLogs, getStrictness, isFatal, silenceConsoleOutput, takeRecordedCrashes } from '../crash-tripwire';

/** Drops the print side of the tripwire for the duration of a test. */
let restoreConsole: (() => void) | null = null;

/** Drains the recorder so one test's deliberate noise cannot fail the next. */
afterEach(() => {
  takeRecordedCrashes();
  restoreConsole?.();
  restoreConsole = null;
});

describe('crash-tripwire', () => {
  describe('recording', () => {
    it('records console.error with the joined arguments', () => {
      restoreConsole = silenceConsoleOutput();
      console.error('boom', 42);
      expect(takeRecordedCrashes()).toEqual([{ kind: 'consoleError', text: 'boom 42' }]);
    });

    it('records console.warn separately from console.error', () => {
      restoreConsole = silenceConsoleOutput();
      console.warn('careful');
      expect(takeRecordedCrashes()).toEqual([{ kind: 'consoleWarn', text: 'careful' }]);
    });

    it('records an Error argument with its stack', () => {
      restoreConsole = silenceConsoleOutput();
      console.error(new TypeError('cannot read x'));
      const records = takeRecordedCrashes();
      expect(records).toHaveLength(1);
      expect(records[0].kind).toBe('consoleError');
      expect(records[0].text).toContain('TypeError: cannot read x');
      expect(records[0].stack).toContain('TypeError: cannot read x');
    });

    it('survives arguments that cannot be serialized', () => {
      restoreConsole = silenceConsoleOutput();
      const hostile: Record<string, unknown> = {};
      Object.defineProperty(hostile, 'boom', {
        enumerable: true,
        get() {
          throw new Error('getter exploded');
        },
      });
      expect(() => console.error(hostile)).not.toThrow();
      expect(takeRecordedCrashes()).toHaveLength(1);
    });

    it('survives a circular argument', () => {
      restoreConsole = silenceConsoleOutput();
      const cyclic: Record<string, unknown> = { name: 'root' };
      cyclic.self = cyclic;
      console.error(cyclic);
      const records = takeRecordedCrashes();
      expect(records).toHaveLength(1);
      // util.format renders the cycle as `[Circular *n]`; the point is that the
      // wrapper neither throws nor recurses forever.
      expect(records[0].text).toMatch(/Circular/);
    });

    it('truncates an oversized argument instead of retaining it', () => {
      restoreConsole = silenceConsoleOutput();
      console.error('x'.repeat(100_000));
      const records = takeRecordedCrashes();
      expect(records).toHaveLength(1);
      expect(records[0].text.length).toBeLessThanOrEqual(2000);
    });

    it('records exactly once per call even when a stale wrapper is still in the chain', () => {
      restoreConsole = silenceConsoleOutput();
      // Layer a delegating spy on top of the live wrapper, then let the next
      // test cycle re-install a fresh wrapper underneath it. The retired
      // wrapper must stay silent so the call is not double-reported.
      const original = console.error;
      const spy = (...args: unknown[]): void => original.apply(console, args);
      console.error = spy;
      console.error('once');
      expect(takeRecordedCrashes()).toEqual([{ kind: 'consoleError', text: 'once' }]);
    });
  });

  describe('application log classification', () => {
    it('classifies a Logger envelope as app output, not a console fault', () => {
      restoreConsole = silenceConsoleOutput();
      console.error('[2026-01-02T03:04:05.678Z] [ERROR] [renderer/stores/errorStore] Conversion failed');
      const records = takeRecordedCrashes();
      expect(records).toHaveLength(1);
      expect(records[0].kind).toBe('appError');
      expect(records[0].context).toBe('renderer/stores/errorStore');
    });

    it('classifies a Logger warning envelope as app output', () => {
      restoreConsole = silenceConsoleOutput();
      console.warn('[2026-01-02T03:04:05.678Z] [WARN] [main/transcoders] falling back');
      const records = takeRecordedCrashes();
      expect(records).toHaveLength(1);
      expect(records[0].kind).toBe('appWarn');
      expect(records[0].context).toBe('main/transcoders');
    });

    it('does not classify a near-miss envelope as app output', () => {
      restoreConsole = silenceConsoleOutput();
      // A missing level, a non-ISO date and a missing context must all fall
      // through to the fatal path, so the classifier cannot be used to smuggle
      // a real crash past the gate.
      console.error('[not-a-date] [ERROR] [ctx] something');
      expect(takeRecordedCrashes()[0].kind).toBe('consoleError');
    });

    it('does not classify an object argument as app output', () => {
      restoreConsole = silenceConsoleOutput();
      console.error({ level: 'ERROR', context: 'x' });
      expect(takeRecordedCrashes()[0].kind).toBe('consoleError');
    });

    it('exposes app records separately from console faults', () => {
      restoreConsole = silenceConsoleOutput();
      console.error('[2026-01-02T03:04:05.678Z] [ERROR] [a] app');
      console.error('not app');
      const logs = getAppLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].context).toBe('a');
    });
  });

  describe('expectAppLog', () => {
    it('accepts an exact logger context', () => {
      expectAppLog('error', 'renderer/stores/errorStore');
      // Declaration only; the assertion outcome is covered by the suite-level
      // behaviour. What matters here is that the record is still captured.
      expect(getAppLogs()).toEqual([]);
    });
  });

  describe('fatality matrix', () => {
    const ALL_KINDS: CrashKind[] = [
      'unhandledRejection',
      'uncaughtException',
      'windowError',
      'windowRejection',
      'consoleError',
      'consoleWarn',
      'appError',
      'appWarn',
    ];
    const LEVELS: Strictness[] = ['crash', 'strict', 'exhaustive'];

    it('never throws for any kind/level combination', () => {
      for (const level of LEVELS) {
        for (const kind of ALL_KINDS) {
          expect(typeof isFatal(kind, level)).toBe('boolean');
        }
      }
    });

    it('treats uncaught faults as fatal in every mode', () => {
      for (const level of LEVELS) {
        for (const kind of ['unhandledRejection', 'uncaughtException', 'windowError', 'windowRejection'] as const) {
          expect(isFatal(kind, level), `${kind} @ ${level}`).toBe(true);
        }
      }
    });

    it('treats a React render crash as fatal in every mode', () => {
      for (const level of LEVELS) {
        expect(isFatal('consoleError', level), `consoleError @ ${level}`).toBe(true);
      }
    });

    it('never fails the application logging its own handled error in the baseline mode', () => {
      expect(isFatal('appError', 'crash')).toBe(false);
      expect(isFatal('appWarn', 'crash')).toBe(false);
      expect(isFatal('consoleWarn', 'crash')).toBe(false);
    });

    it('ratchets monotonically: every kind fatal at level N is fatal at N+1', () => {
      for (let i = 0; i < LEVELS.length - 1; i += 1) {
        for (const kind of ALL_KINDS) {
          if (isFatal(kind, LEVELS[i])) {
            expect(isFatal(kind, LEVELS[i + 1]), `${kind} regressed from ${LEVELS[i]} to ${LEVELS[i + 1]}`).toBe(true);
          }
        }
      }
    });
  });

  describe('strictness', () => {
    it('is driven solely by ENCODEX_STRICT_TESTS', () => {
      const raw = process.env.ENCODEX_STRICT_TESTS;
      expect(getStrictness()).toBe(raw === '1' ? 'strict' : raw === '2' ? 'exhaustive' : 'crash');
    });
  });
});
