/**
 * @fileoverview Detached Logs window support for the renderer.
 *
 * The Logs page can be detached into its own OS window. That window is a
 * *second renderer process*, so it cannot see the first renderer's log store:
 * the two processes share no memory. This module carries the entries across
 * the process boundary:
 *
 *  - {@link isDetachedMode} tells a renderer whether it is the detached one.
 *  - {@link mirrorLogEntry} forwards a locally produced entry to the main
 *    process, which publishes it into the shared log hub.
 *  - {@link subscribeDetachedLogFeed} seeds the detached window's store from
 *    the hub's history and keeps it up to date with the live stream.
 *
 * Mirroring is skipped in the detached window itself: that window's own
 * console output would otherwise travel to the main process and be echoed back
 * to it, showing every entry twice.
 *
 * @module renderer/logs/detached
 */

import { useLogStore } from '../stores/logStore';
import { bridgePromise, callBridgeVoid, fireAndForgetBridge } from '../utils/bridge-call';
import type { LogEntry } from '../../shared/types';

/**
 * The query marker the main process puts on the detached window's URL.
 * @const {string}
 */
const DETACHED_MARKER = 'detached=1';

/**
 * How long mirrored entries are collected before they are sent, in
 * milliseconds.
 *
 * Batching keeps a chatty renderer from turning every console call into its
 * own IPC message; the cost is that the detached view trails by at most this
 * interval.
 * @const {number}
 */
const MIRROR_FLUSH_MS = 200;

/**
 * True when this renderer is the detached Logs window.
 *
 * @returns {boolean} True when the window was opened as a detached Logs view.
 */
export function isDetachedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.search.includes(DETACHED_MARKER);
}
/**
 * The entries collected since the last flush. @type {LogEntry[]}
 */
let pendingEntries: LogEntry[] = [];

/**
 * The pending flush timer, or `undefined` when no flush is scheduled.
 * @type {number | undefined}
 */
let flushTimer: number | undefined;

/**
 * Sends the collected entries to the main process and clears the buffer.
 *
 * The bridge call is fire-and-forget: the entries are already in this
 * renderer's own store, so a bridge that fails costs the *detached* view the
 * entry, not this one. A failure is recorded in the log store rather than
 * printed - printing would go through the patched console, which mirrors the
 * message again, and a bridge that keeps failing would then feed itself one
 * warning per flush.
 *
 * @returns {void}
 */
function flushMirroredEntries(): void {
  flushTimer = undefined;
  if (pendingEntries.length === 0) return;
  const batch = pendingEntries;
  pendingEntries = [];
  fireAndForgetBridge(
    () => window.electronAPI?.logsPublishEntries?.(batch),
    'logsPublishEntries',
    (err) => {
      useLogStore.getState().addEntry({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        text: `Bridge call "logsPublishEntries" failed: ${String(err)}`,
        source: 'renderer',
      });
    },
  );
}

/**
 * Forwards a locally produced log entry to the main-process log hub.
 *
 * The entry is collected and sent in a batch, so a burst of console output
 * costs one IPC message rather than one per entry.
 *
 * @param {LogEntry} entry - The entry to mirror.
 * @returns {void}
 */
export function mirrorLogEntry(entry: LogEntry): void {
  if (isDetachedMode()) return;
  pendingEntries.push(entry);
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(flushMirroredEntries, MIRROR_FLUSH_MS);
}

/**
 * Orders two entries by their hub sequence number.
 *
 * The hub stamps every entry it distributes with a monotonic sequence number,
 * so it is the ordering key for entries that arrive from several sources.
 *
 * @param {LogEntry} a - The first entry.
 * @param {LogEntry} b - The second entry.
 * @returns {number} A negative number when `a` comes first.
 */
function compareBySeq(a: LogEntry, b: LogEntry): number {
  // Both entries come from the map, which only ever holds entries that carry a
  // sequence number, so the assertion is safe here.
  return (a.seq as number) - (b.seq as number);
}

/**
 * Seeds the detached window's log store with the shared history and keeps it
 * up to date with the live stream.
 *
 * The live subscription is registered *before* the history is fetched, so the
 * two together cover every entry: the history carries what was published
 * before the fetch, the live stream carries what was published after the
 * subscription. Both are merged by sequence number, so an entry that arrives
 * through both paths is stored once.
 *
 * @returns {() => void} A function that stops the live subscription.
 */
export function subscribeDetachedLogFeed(): () => void {
  /** The entries seen so far, keyed by their hub sequence number. @type {Map<number, LogEntry>} */
  const bySeq = new Map<number, LogEntry>();

  /**
   * Writes the merged entries into the store.
   * @returns {void}
   */
  const flush = (): void => {
    useLogStore.getState().replaceEntries([...bySeq.values()].sort(compareBySeq));
  };

  /**
   * Records one entry and republishes the merged list.
   * @param {LogEntry} entry - The entry to record.
   * @returns {void}
   */
  const record = (entry: LogEntry): void => {
    if (entry.seq === undefined) return;
    bySeq.set(entry.seq, entry);
    flush();
  };

  let unsubscribe: (() => void) | undefined;
  callBridgeVoid(() => {
    unsubscribe = window.electronAPI?.onLogMessage?.(record);
  }, 'onLogMessage');

  void bridgePromise(() => window.electronAPI!.logsGetHistory!())
    .then((history) => {
      for (const entry of history ?? []) record(entry);
    })
    .catch(() => {
      /* The history is a best-effort seed; the live stream still works. */
    });

  return () => unsubscribe?.();
}
