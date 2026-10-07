/**
 * @fileoverview Latest-wins coalescing for high-frequency `ipcRenderer.on` pushes.
 *
 * The preload subscribes the renderer to events that can legitimately arrive much faster than the
 * renderer can usefully apply them - per-frame preview frames, per-chunk audio, per-job progress
 * snapshots. Phase 3.3 (`e2e/specs/ipc-events.spec.ts`) measured what that costs: at ~650 events/sec
 * across 15 channels the renderer round-trip degrades to 1.5-2.8 s while main stays at 1-20 ms,
 * because every event is applied by React on arrival, unbatched by any back-pressure. A progress bar
 * does not need 100 snapshots a second; a canvas preview does not need every frame.
 *
 * `coalescingSubscription` wraps a channel's subscribe/unsubscribe pair in a latest-wins trailing-edge
 * window:
 *
 * - The first event of a window is applied immediately, so a channel that stays quiet is delayed
 *   zero.
 * - Events arriving inside the window collapse into the most recent one; only that one is applied,
 *   when the window closes.
 * - The tail is never lost: the newest event is always the one that gets out. A progress update that
 *   happens to land in the last millisecond of a window is still delivered.
 *
 * A burst of N events in a window therefore costs two deliveries (the first and the latest) instead
 * of N. Unsubscribe cancels any pending delivery, so a torn-down consumer cannot be woken by a
 * straggler flush.
 */

/**
 * Wraps a push subscription so consecutive events inside {@link intervalMs} collapse into the latest.
 *
 * @template T - Payload type of the channel.
 * @param {(emit: (data: T) => void) => () => void} subscribe - Registers an `ipcRenderer.on`
 *   listener; the supplied `emit` is the coalesced delivery path. Returns an unsubscribe that removes
 *   the listener.
 * @param {number} intervalMs - Width of the coalescing window. The delivery rate collapses toward
 *   roughly `1 / intervalMs` under a flood.
 * @returns {(cb: (data: T) => void) => () => void} A subscription function with the same shape as the
 *   preload's `on*` methods: call it with the consumer callback and get back an unsubscribe that
 *   cancels both the listener and any pending delivery.
 */
export function coalescingSubscription<T>(
  subscribe: (emit: (data: T) => void) => () => void,
  intervalMs: number,
): (cb: (data: T) => void) => () => void {
  return (cb) => {
    let pending: T | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      timer = undefined;
      const last = pending;
      pending = undefined;
      if (last !== undefined) cb(last);
    };

    const unsubscribe = subscribe((data: T) => {
      if (timer === undefined) {
        cb(data);
        timer = setTimeout(flush, intervalMs);
      } else {
        pending = data;
      }
    });

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      unsubscribe();
    };
  };
}
