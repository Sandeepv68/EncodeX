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
 *  - {@link subscribeSharedLogFeed} seeds a window's store from the hub's
 *    history and keeps it up to date with the live stream. Both the in-app and
 *    the detached Logs page use it, so they show the same ordered entries.
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
 * Drops console entries that have not been mirrored yet.
 *
 * A clear must not be undone by the batch timer: an entry produced a few
 * milliseconds before the user pressed clear would otherwise be published
 * after the hub was emptied and appear as if it had survived.
 *
 * @returns {void}
 */
function discardPendingMirroredEntries(): void {
  pendingEntries = [];
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
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
 * Seeds a Logs window's store with the shared history and keeps it up to date
 * with the live stream.
 *
 * Both the in-app and the detached Logs page use this feed. Reading one hub
 * through the same history-plus-live path is what keeps the two views in
 * step; collecting entries directly in the in-app window made it miss history
 * the detached window received.
 *
 * The live subscription is registered *before* the history is fetched, so the
 * two together cover every entry: the history carries what was published
 * before the fetch, the live stream carries what was published after the
 * subscription. Both are merged by sequence number, so an entry that arrives
 * through both paths is stored once.
 *
 * @returns {() => void} A function that stops the live subscription.
 */
export function subscribeSharedLogFeed(): () => void {
  /** The entries seen so far, keyed by their hub sequence number. @type {Map<number, LogEntry>} */
  const bySeq = new Map<number, LogEntry>();

  /**
   * Incremented on every clear, so a history request started before the clear
   * cannot write the old entries back when its response lands afterwards.
   * @type {number}
   */
  let generation = 0;

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

  /**
   * Drops the cached entries after the shared history was cleared.
   *
   * The local store is cleared as well, and both the cache and the generation
   * reset are needed: the cache would otherwise repopulate the store on the
   * next live entry, and an in-flight history response would seed it with the
   * entries the user just cleared.
   *
   * @returns {void}
   */
  const handleCleared = (): void => {
    generation += 1;
    bySeq.clear();
    discardPendingMirroredEntries();
    flush();
  };

  let unsubscribe: (() => void) | undefined;
  let unsubscribeCleared: (() => void) | undefined;
  callBridgeVoid(() => {
    unsubscribe = window.electronAPI?.onLogMessage?.(record);
    unsubscribeCleared = window.electronAPI?.onLogsCleared?.(handleCleared);
  }, 'onLogMessage');

  const requestGeneration = generation;
  void bridgePromise(() => window.electronAPI!.logsGetHistory!())
    .then((history) => {
      if (requestGeneration !== generation) return;
      for (const entry of history ?? []) record(entry);
    })
    .catch(() => {
      /* The history is a best-effort seed; the live stream still works. */
    });

  return () => {
    unsubscribe?.();
    unsubscribeCleared?.();
  };
}
