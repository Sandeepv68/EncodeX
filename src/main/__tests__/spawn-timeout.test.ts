import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectAppLog } from '../../test-utils/crash-tripwire';
import { ErrorCode, ERROR_MESSAGES, formatError, isAppError } from '../../shared/errors';
import { KILL_SIGNAL } from '../../shared/transcoder-constants';
import {
  withTimeout,
  isValidTimeout,
  IMAGE_HISTOGRAM_TIMEOUT_MS,
  VIDEO_PREVIEW_TIMEOUT_MS,
  TIMELINE_EXTRACT_TIMEOUT_MS,
} from '../spawn-timeout';
import type { Killable } from '../spawn-timeout';

const TIMEOUT_LOG = 'main/spawn-timeout';

/**
 * A `Killable` that records its calls, standing in for a spawned child.
 * @returns {{ killable: Killable, kill: ReturnType<typeof vi.fn> }} The stub and its spy.
 */
function fakeKillable(): { killable: Killable; kill: ReturnType<typeof vi.fn> } {
  const kill = vi.fn();
  return { killable: { kill }, kill };
}

/**
 * A promise that never settles, i.e. a wedged subprocess.
 * @returns {Promise<never>} A permanently pending promise.
 */
function never(): Promise<never> {
  return new Promise<never>(() => undefined);
}

/**
 * Runs `p` and captures how it settled, so no assertion can leave a rejection
 * unhandled while fake timers are being advanced.
 * @param {Promise<unknown>} p - The promise under test.
 * @returns {Promise<{ ok: boolean; value: unknown; error: unknown }>} The outcome.
 */
async function settle(p: Promise<unknown>): Promise<{ ok: boolean; value: unknown; error: unknown }> {
  return p.then(
    (value) => ({ ok: true, value, error: undefined }),
    (error: unknown) => ({ ok: false, value: undefined, error }),
  );
}

describe('spawn-timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isValidTimeout', () => {
    it.each([1, 30, 30000, 0.5, Number.MAX_SAFE_INTEGER])('accepts the positive finite budget %p', (ms) => {
      expect(isValidTimeout(ms)).toBe(true);
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['a numeric string', '30000'],
      ['null', null],
      ['undefined', undefined],
      ['an object', {}],
      ['an array', []],
      ['a boolean', true],
      ['a symbol', Symbol('30000')],
      ['a bigint', 30000n],
    ])('rejects %s', (_label, value) => {
      expect(isValidTimeout(value)).toBe(false);
    });
  });

  describe('when the work settles inside its budget', () => {
    it('resolves with the work result', async () => {
      const outcome = await settle(withTimeout(async () => 'ok', 1000, 'probe'));
      expect(outcome).toEqual({ ok: true, value: 'ok', error: undefined });
    });

    it('rejects with the work error unchanged', async () => {
      const boom = new Error('ffprobe exited with code 1');
      const outcome = await settle(withTimeout(async () => Promise.reject(boom), 1000, 'probe'));
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toBe(boom);
    });

    it('does not kill the registered target', async () => {
      const { killable, kill } = fakeKillable();
      await settle(
        withTimeout(
          async (onSpawn) => {
            onSpawn(killable);
            return 'ok';
          },
          1000,
          'probe',
        ),
      );
      expect(kill).not.toHaveBeenCalled();
    });

    it('leaves no pending timer behind', async () => {
      await settle(withTimeout(async () => 'ok', 1000, 'probe'));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('leaves no pending timer behind when the work rejects', async () => {
      await settle(withTimeout(async () => Promise.reject(new Error('nope')), 1000, 'probe'));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not kill the target even long after settling', async () => {
      const { killable, kill } = fakeKillable();
      await settle(
        withTimeout(
          async (onSpawn) => {
            onSpawn(killable);
            return 'ok';
          },
          1000,
          'probe',
        ),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      expect(kill).not.toHaveBeenCalled();
    });
  });

  describe('when the work outlives its budget', () => {
    it('rejects with an OPERATION_TIMED_OUT AppError', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const pending = settle(withTimeout(() => never(), 50, 'probe'));
      await vi.advanceTimersByTimeAsync(50);
      const outcome = await pending;
      expect(outcome.ok).toBe(false);
      expect(isAppError(outcome.error)).toBe(true);
      expect((outcome.error as { code: string }).code).toBe(ErrorCode.OPERATION_TIMED_OUT);
      expect((outcome.error as { message: string }).message).toBe(ERROR_MESSAGES[ErrorCode.OPERATION_TIMED_OUT]);
    });

    it('names the label and the budget in the detail', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const pending = settle(withTimeout(() => never(), 50, 'ffprobe'));
      await vi.advanceTimersByTimeAsync(50);
      const outcome = await pending;
      expect((outcome.error as { detail: string }).detail).toBe('ffprobe timed out after 50ms');
    });

    it('kills the registered target with SIGKILL', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const { killable, kill } = fakeKillable();
      const pending = settle(
        withTimeout(
          (onSpawn) => {
            onSpawn(killable);
            return never();
          },
          50,
          'probe',
        ),
      );
      await vi.advanceTimersByTimeAsync(50);
      await pending;
      expect(kill).toHaveBeenCalledTimes(1);
      expect(kill).toHaveBeenCalledWith(KILL_SIGNAL);
    });

    it('does not spawn at all before the budget expires', async () => {
      const start = vi.fn(() => never());
      const pending = settle(withTimeout(start, 50, 'probe'));
      await vi.advanceTimersByTimeAsync(49);
      expect(start).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
    });

    it('survives a target that was never registered', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const pending = settle(withTimeout(() => never(), 50, 'probe'));
      await vi.advanceTimersByTimeAsync(50);
      const outcome = await pending;
      expect((outcome.error as { code: string }).code).toBe(ErrorCode.OPERATION_TIMED_OUT);
    });

    it('still reports the timeout when the kill itself throws', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      expectAppLog('warn', TIMEOUT_LOG);
      const kill = vi.fn(() => {
        throw new Error('ESRCH');
      });
      const pending = settle(
        withTimeout(
          (onSpawn) => {
            onSpawn({ kill });
            return never();
          },
          50,
          'probe',
        ),
      );
      await vi.advanceTimersByTimeAsync(50);
      const outcome = await pending;
      expect((outcome.error as { code: string }).code).toBe(ErrorCode.OPERATION_TIMED_OUT);
    });

    it('leaves no pending timer behind', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const pending = settle(withTimeout(() => never(), 50, 'probe'));
      await vi.advanceTimersByTimeAsync(50);
      await pending;
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not settle twice when the work lands after the timeout', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      let release!: (value: string) => void;
      const { killable, kill } = fakeKillable();
      const work = new Promise<string>((resolve) => {
        release = resolve;
      });
      const settlements: string[] = [];
      const guarded = withTimeout(
        (onSpawn) => {
          onSpawn(killable);
          return work;
        },
        50,
        'probe',
      ).then(
        () => settlements.push('resolved'),
        (err: unknown) => settlements.push(`rejected:${(err as { code: string }).code}`),
      );

      await vi.advanceTimersByTimeAsync(50);
      release('too late');
      await guarded;
      await vi.advanceTimersByTimeAsync(50);

      expect(settlements).toEqual([`rejected:${ErrorCode.OPERATION_TIMED_OUT}`]);
      expect(kill).toHaveBeenCalledTimes(1);
    });

    it('surfaces a raw timeout message as OPERATION_TIMED_OUT via formatError', async () => {
      expectAppLog('error', TIMEOUT_LOG);
      const pending = settle(withTimeout(() => never(), 50, 'video preview extract'));
      await vi.advanceTimersByTimeAsync(50);
      const outcome = await pending;
      const rendered = formatError(outcome.error);
      expect(rendered.code).toBe(ErrorCode.OPERATION_TIMED_OUT);
    });
  });

  describe('when the budget itself is unusable', () => {
    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('rejects a %s budget without starting any work', async (label, budget) => {
      expectAppLog('error', TIMEOUT_LOG);
      const start = vi.fn(() => never());
      const outcome = await settle(withTimeout(start, budget, 'probe'));
      expect(start).not.toHaveBeenCalled();
      expect((outcome.error as { code: string }).code).toBe(ErrorCode.OPERATION_TIMED_OUT);
      expect((outcome.error as { detail: string }).detail).toContain(`"probe"`);
      expect((outcome.error as { detail: string }).detail).toContain(label === 'Infinity' ? 'Infinity' : String(budget));
    });

    it('reports the value type rather than stringifying a hostile value', async () => {
      const hostile = { toString: () => 'boom' } as unknown as number;
      const outcome = await settle(withTimeout(() => never(), hostile, 'probe'));
      expect((outcome.error as { detail: string }).detail).toContain('object');
    });
  });

  describe('when start throws synchronously', () => {
    it('turns the throw into a rejection', async () => {
      const boom = new Error('spawn ENOENT');
      const outcome = await settle(
        withTimeout(
          () => {
            throw boom;
          },
          1000,
          'probe',
        ),
      );
      expect(outcome.error).toBe(boom);
    });

    it('leaves no pending timer behind', async () => {
      await settle(
        withTimeout(
          () => {
            throw new Error('spawn ENOENT');
          },
          1000,
          'probe',
        ),
      );
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('budget constants', () => {
    it.each([
      ['IMAGE_HISTOGRAM_TIMEOUT_MS', IMAGE_HISTOGRAM_TIMEOUT_MS],
      ['VIDEO_PREVIEW_TIMEOUT_MS', VIDEO_PREVIEW_TIMEOUT_MS],
      ['TIMELINE_EXTRACT_TIMEOUT_MS', TIMELINE_EXTRACT_TIMEOUT_MS],
    ])('%s is a usable budget', (name, value) => {
      expect(isValidTimeout(value)).toBe(true);
    });
  });
});
