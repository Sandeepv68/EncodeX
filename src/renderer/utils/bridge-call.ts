/**
 * @fileoverview Helpers for calling the preload bridge when it may be unreliable.
 *
 * `window.electronAPI` is the one dependency the renderer does not own. It can be absent (older preload),
 * it can throw *synchronously* (a broken module in the preload, a version-skewed field), it can reject,
 * and - the case that motivated this file - it can simply never settle, because `ipcRenderer.invoke` is
 * a round-trip to another process and nothing guarantees the other process answers.
 *
 * Each of those is handled by a different primitive, which is why there are two:
 *
 * - {@link callBridgeVoid} contains a synchronous throw from a call whose result is discarded anyway.
 * - {@link withBridgeTimeout} bounds a promise so a hang cannot stall the caller forever.
 *
 * Both are deliberately dependency-free and synchronous-free of React, so stores and module-scope boot
 * code can use them.
 */

/**
 * Calls a `void`-returning bridge method, containing a synchronous throw.
 *
 * The optional-chaining idiom `window.electronAPI?.method(x)` only covers a *missing* API. It does not
 * cover a present one that throws, and Electron's `contextBridge` propagates a synchronous throw
 * straight into the caller - so an unguarded call inside a React effect takes the whole tree down with a
 * blank screen and no error. A fire-and-forget call whose result is discarded has no business
 * propagating anything, so it is caught and reported rather than allowed to escape.
 *
 * Only synchronous throws are caught. A rejected promise is left alone: for an `async` bridge method the
 * caller may legitimately want the rejection, and swallowing it would hide a real failure behind a
 * silent no-op.
 *
 * @param method - The bridge method to invoke. Invoked with no `this`, so it must be bound or an arrow.
 * @param describe - What was being attempted, for the log message.
 * @param onError - Optional sink for the caught error; defaults to `console.warn`.
 * @returns {boolean} True when the call completed without throwing.
 */
export function callBridgeVoid(method: () => unknown, describe: string, onError?: (err: unknown) => void): boolean {
  try {
    method();
    return true;
  } catch (err) {
    (onError ?? ((e: unknown) => console.warn(`Bridge call "${describe}" threw:`, e)))(err);
    return false;
  }
}

/**
 * Invokes a bridge call whose result is discarded, handling both failure shapes.
 *
 * Use this instead of {@link callBridgeVoid} whenever the bridge method is an `async` one. The two differ
 * in a way that matters: `callBridgeVoid` catches only a synchronous throw and deliberately leaves a
 * rejected promise alone, because a caller may want to handle it. A genuinely fire-and-forget `async`
 * call has no such caller, so the rejection becomes an **unhandled rejection** - which, in this app,
 * reaches the user as a console error and trips the Phase 3.4 tripwire. Attaching a handler here is what
 * makes "we do not care about this result" mean what it says.
 *
 * @param invoke - Calls the bridge method.
 * @param describe - What was being attempted, for the log message.
 * @param onError - Optional sink; defaults to `console.warn`.
 */
export function fireAndForgetBridge(invoke: () => unknown, describe: string, onError?: (err: unknown) => void): void {
  const report = onError ?? ((err: unknown) => console.warn(`Bridge call "${describe}" failed:`, err));
  try {
    const result = invoke();
    // Narrow to a thenable rather than assuming a Promise: `send`-style methods return undefined.
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void (result as PromiseLike<unknown>).then(undefined, report);
    }
  } catch (err) {
    report(err);
  }
}

/**
 * Starts a bridge promise, routing a synchronous throw into the rejection path.
 *
 * `contextBridge` propagates a synchronous throw into the caller, so `api.foo().catch(...)` does not
 * protect the call - the throw lands before `.catch` can be attached. That is harmless inside an event
 * handler but fatal at **module scope**: the hydration calls in `settingsStore.ts` run while the bundle
 * is still evaluating, so one throwing bridge method aborts the import and the window stays blank with
 * no app, no error banner, and often no page error to find it by.
 *
 * Wrapping the *invocation* - rather than the result - means a synchronous throw and an asynchronous
 * rejection reach the same `.catch`, so existing handlers cover both without being rewritten.
 *
 * @typeParam T - The resolved value type of the bridge call.
 * @param invoke - Calls the bridge method. Any synchronous throw becomes a rejection.
 * @returns {Promise<T>} The bridge promise, or a rejected promise if the call threw synchronously.
 */
export function bridgePromise<T>(invoke: () => Promise<T>): Promise<T> {
  try {
    return invoke();
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Resolves `promise`, or `fallback` if it has not settled within `timeoutMs`.
 *
 * A rejection is *not* handled here - it propagates to the caller exactly as it would have without
 * this wrapper, so error handling stays where the caller can decide what a failure means. Only a
 * never-settling promise is neutralised, because there is no correct way to await one: the code after
 * the `await` would never run and the failure is silent, which is strictly worse than proceeding with a
 * default.
 *
 * The timer is always cleared, so a short timeout does not keep the Node event loop (or an Electron
 * renderer) alive after the promise wins the race.
 *
 * @typeParam T - The resolved value type of the wrapped promise.
 * @param promise - The promise to bound.
 * @param timeoutMs - How long to wait before falling back.
 * @param fallback - Value to resolve with on timeout. Also used when `promise` is undefined/nullish.
 * @returns {Promise<T>} The original resolution, or `fallback` on timeout.
 */
export function withBridgeTimeout<T>(promise: Promise<T> | undefined | null, timeoutMs: number, fallback: T): Promise<T> {
  if (!promise) return Promise.resolve(fallback);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
