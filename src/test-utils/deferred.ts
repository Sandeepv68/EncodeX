/**
 * @fileoverview Race harness: a `deferred()` primitive and *bounded* waits.
 *
 * The plan's rule for Phase 4.7 is that "every `eventually` is a bounded
 * assertion, not a `waitFor` that silently passes". Two separate failure modes
 * make that worth a shared utility rather than inline code:
 *
 * 1. **An unbounded wait passes when nothing happened.** `waitFor` retries until
 *    its timeout and then *fails*, which is correct - but a test written as
 *    `await Promise.race([eventually, nothing])` or as a bare `await p` that the
 *    event loop services anyway can pass on a code path that never ran.
 * 2. **A losing deadline becomes an unhandled rejection.** `Promise.race([p,
 *    timeout])` leaves the timeout promise pending after `p` wins; when it later
 *    rejects, the rejection has no handler and the crash tripwire fails the test
 *    for a reason unrelated to what the test was checking. Every helper here
 *    attaches its handler eagerly and clears its timer so a lost race is inert.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, row 4.7
 */

/**
 * A promise plus its settle functions, created eagerly.
 * @interface
 */
export interface Deferred<T> {
  /** The shared promise. */
  promise: Promise<T>;
  /** Settles `promise` with `value`. Subsequent calls are ignored. */
  resolve(value: T | PromiseLike<T>): void;
  /** Settles `promise` with `reason`. Subsequent calls are ignored. */
  reject(reason?: unknown): void;
  /** True once `resolve` or `reject` has been called for the first time. */
  readonly settled: boolean;
}

/**
 * Creates a promise whose settlement is controlled by the caller.
 * @template T - The resolved value type.
 * @returns {Deferred<T>} The promise and its settle functions.
 */
export function deferred<T = void>(): Deferred<T> {
  let resolveFn!: (value: T | PromiseLike<T>) => void;
  let rejectFn!: (reason?: unknown) => void;
  let settled = false;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    resolve(value) {
      if (settled) return;
      settled = true;
      resolveFn(value);
    },
    reject(reason) {
      if (settled) return;
      settled = true;
      rejectFn(reason);
    },
    get settled() {
      return settled;
    },
  };
}

/**
 * A one-shot timer that rejects with a descriptive error.
 * @interface
 */
export interface Deadline {
  /** Rejects with a labelled error if `cancel()` is not called in time. */
  readonly promise: Promise<never>;
  /** Stops the timer. Idempotent, so it is safe to call from a `finally`. */
  cancel(): void;
}

/**
 * Builds a deadline that fails after `ms` with a message naming the operation.
 *
 * The rejection handler is attached eagerly, so a deadline that loses a race is
 * reported nowhere - only an *uncancelled and unobserved* deadline should ever
 * surface, and that one is exactly the bug this exists to catch.
 * @param {number} ms - Milliseconds before the deadline fires.
 * @param {string} [label] - Operation name used in the error message.
 * @returns {Deadline} The promise and its `cancel`.
 */
export function deadline(ms: number, label = 'operation'): Deadline {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timer = undefined;
      reject(new Error(`${label} did not settle within ${ms}ms`));
    }, ms);
  });
  // Mark the rejection handled *now* rather than at race time, so a deadline
  // that loses cannot become an unhandled rejection milliseconds later.
  void promise.catch(() => undefined);
  return {
    promise,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

/**
 * Options for {@link settles}.
 * @interface
 */
export interface SettlesOptions {
  /** Milliseconds before the bound fires. Defaults to 5000. */
  timeout?: number;
  /** Operation name used when the bound fires. Defaults to `label`. */
  label?: string;
}

/**
 * Awaits `input`, failing with a descriptive error if it has not settled within
 * the bound. Cancels the bound on every exit, including when `input` rejects, so
 * no timer outlives the assertion.
 * @template T - The resolved value type.
 * @param {Promise<T>} input - The promise under test.
 * @param {SettlesOptions} [options] - Bound length and label.
 * @returns {Promise<T>} `input`'s settlement.
 */
export async function settles<T>(input: Promise<T>, options: SettlesOptions = {}): Promise<T> {
  const bound = deadline(options.timeout ?? 5000, options.label ?? 'assertion');
  try {
    return await Promise.race([input, bound.promise]);
  } finally {
    bound.cancel();
  }
}

/**
 * Runs `fn` and bounds its promise the same way {@link settles} bounds an
 * existing one. Passing the factory rather than the promise means the call
 * itself happens inside the bound.
 * @template T - The resolved value type.
 * @param {() => Promise<T>} fn - The async work under test.
 * @param {SettlesOptions} [options] - Bound length and label.
 * @returns {Promise<T>} `fn`'s settlement.
 */
export async function settlesWithin<T>(fn: () => Promise<T>, options: SettlesOptions = {}): Promise<T> {
  return settles(Promise.resolve().then(fn), options);
}

/**
 * Yields to the event loop `times` times, draining queued microtasks.
 *
 * Counts rather than `setTimeout(0)` on purpose: it works under fake timers,
 * where a macrotask would never fire, and a fixed count makes a test's
 * dependence on "enough turns" explicit instead of hiding inside a sleep.
 * @param {number} [times] - How many microtask turns to drain. Defaults to 3.
 * @returns {Promise<void>} Resolves after the last turn.
 */
export async function flushMicrotasks(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

/**
 * Resolves on the next macrotask.
 *
 * **Incompatible with fake timers** - the `setTimeout` will never fire unless
 * the test advances the clock. Prefer {@link flushMicrotasks}.
 * @returns {Promise<void>} Resolves on the next timer turn.
 */
export function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
