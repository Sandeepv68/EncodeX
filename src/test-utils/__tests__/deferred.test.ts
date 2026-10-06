/**
 * @fileoverview Self-tests for the Phase 4.7 race harness.
 *
 * These are meta-tests: the helpers exist so other tests can make bounded
 * claims, so each helper has to prove the two properties that make it
 * trustworthy - it actually fails when its bound expires, and a bound that
 * *loses* a race leaves nothing behind (no timer, no unhandled rejection that
 * would fail an unrelated test through the crash tripwire).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { deferred, deadline, settles, settlesWithin, flushMicrotasks, nextMacrotask } from '../deferred';

afterEach(() => {
  vi.useRealTimers();
});

describe('deferred', () => {
  it('resolves with the value passed to resolve', async () => {
    const d = deferred<number>();
    expect(d.settled).toBe(false);
    d.resolve(7);
    expect(d.settled).toBe(true);
    await expect(d.promise).resolves.toBe(7);
  });

  it('rejects with the reason passed to reject', async () => {
    const d = deferred<number>();
    d.reject(new Error('nope'));
    expect(d.settled).toBe(true);
    await expect(d.promise).rejects.toThrow('nope');
  });

  it('ignores every settle call after the first', async () => {
    const d = deferred<string>();
    d.resolve('first');
    d.resolve('second');
    d.reject(new Error('third'));
    await expect(d.promise).resolves.toBe('first');
  });

  it('can be settled by an async producer started before anyone awaits', async () => {
    const d = deferred<void>();
    const producer = (async () => {
      await Promise.resolve();
      d.resolve();
    })();
    await expect(d.promise).resolves.toBeUndefined();
    await producer;
  });
});

describe('deadline', () => {
  it('rejects with a message naming the operation and the bound', async () => {
    const bound = deadline(5, 'parsing the queue snapshot');
    await expect(bound.promise).rejects.toThrow('parsing the queue snapshot did not settle within 5ms');
  });

  it('leaves no timer behind once cancelled', () => {
    vi.useFakeTimers();
    const bound = deadline(1000, 'x');
    expect(vi.getTimerCount()).toBe(1);
    bound.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is idempotent on cancel', () => {
    vi.useFakeTimers();
    const bound = deadline(1000, 'x');
    bound.cancel();
    expect(() => bound.cancel()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is inert rather than an unhandled rejection when nobody is waiting on it', async () => {
    // Deliberately NOT wrapped in `Promise.race`: race attaches handlers to
    // every input, so a losing deadline is already "handled" and this hazard is
    // invisible. The dangerous shape is a deadline created, observed only
    // conditionally, and then dropped - which is what the eager handler inside
    // `deadline` exists for.
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => {
      seen.push(reason);
    };
    process.on('unhandledRejection', onRejection);
    try {
      void deadline(5, 'ghost');
      await new Promise((resolve) => setTimeout(resolve, 40));
      // Give Node its two flush points for pending rejections.
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });
});

describe('settles', () => {
  it('returns the input value when it settles inside the bound', async () => {
    await expect(settles(Promise.resolve('ok'), { timeout: 50 })).resolves.toBe('ok');
  });

  it('propagates the input rejection rather than replacing it', async () => {
    await expect(settles(Promise.reject(new Error('inner')), { timeout: 50 })).rejects.toThrow('inner');
  });

  it('fails with a descriptive bound error when the input never settles', async () => {
    await expect(settles(new Promise(() => undefined), { timeout: 5, label: 'draining the queue' })).rejects.toThrow(
      'draining the queue did not settle within 5ms',
    );
  });

  it('leaves no timer behind after the input wins', async () => {
    vi.useFakeTimers();
    await expect(settles(Promise.resolve('ok'), { timeout: 1000 })).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer behind after the input rejects', async () => {
    vi.useFakeTimers();
    await expect(settles(Promise.reject(new Error('inner')), { timeout: 1000 })).rejects.toThrow('inner');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer behind after the bound fires', async () => {
    vi.useFakeTimers();
    const pending = settles(new Promise(() => undefined), { timeout: 10, label: 'slow' });
    const assertion = expect(pending).rejects.toThrow('slow did not settle within 10ms');
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('settlesWithin', () => {
  it('bounds a factory that is never invoked because the queue is already full', async () => {
    await expect(settlesWithin(async () => 'ran', { timeout: 50 })).resolves.toBe('ran');
  });

  it('propagates a synchronous throw from the factory', async () => {
    await expect(
      settlesWithin(() => {
        throw new Error('factory exploded');
      }),
    ).rejects.toThrow('factory exploded');
  });

  it('bounds a factory that never resolves', async () => {
    await expect(settlesWithin(() => new Promise(() => undefined), { timeout: 5, label: 'starting the encoder' })).rejects.toThrow(
      'starting the encoder did not settle within 5ms',
    );
  });
});

describe('flushMicrotasks', () => {
  it('drains queued microtasks without needing the timer queue', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    void Promise.resolve().then(() => order.push('a'));
    void Promise.resolve().then(() => order.push('b'));
    await flushMicrotasks(4);
    expect(order).toEqual(['a', 'b']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('works with fake timers, where a macrotask would hang', async () => {
    vi.useFakeTimers();
    await expect(flushMicrotasks(1)).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('nextMacrotask', () => {
  it('resolves on the next timer turn under real timers', async () => {
    await expect(nextMacrotask()).resolves.toBeUndefined();
  });
});
