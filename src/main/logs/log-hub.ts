/**
 * @fileoverview Main-process log hub.
 *
 * The renderer keeps its own copy of the log (a zustand store in the renderer
 * process), so a second window could not see it: the two renderer processes do
 * not share memory. This module is the single place where every log entry
 * passes through on its way to a window that wants to display it.
 *
 * What the hub does:
 *  - keeps a bounded history of the entries it has seen, oldest first;
 *  - stamps every entry with a monotonic `seq` so a consumer can order entries
 *    that arrive from several sources and drop the ones it already applied;
 *  - fans entries out to the windows that subscribed to it.
 *
 * The hub does not know how an entry was produced. The main process publishes
 * its own console output here, and the renderer mirrors its console output
 * here as well, so a window that subscribes sees both sources merged in one
 * ordered stream.
 *
 * @module main/logs/log-hub
 */

import { LOG_MAX_ENTRIES } from '../../shared/constants';
import type { LogEntry } from '../../shared/types';
import type { LogSubscriber } from './log-hub.types';

/**
 * The shared log history and its broadcast fan-out.
 *
 * The buffer is a plain array trimmed from the front, capped at
 * `LOG_MAX_ENTRIES` (2000) - the same cap the renderer store uses, so both
 * sides of the app hold a comparable amount of history.
 */
export class LogHub {
  /** The buffered entries, oldest first. @type {LogEntry[]} */
  private entries: LogEntry[] = [];

  /** The sequence number handed to the next published entry. @type {number} */
  private nextSeq = 1;

  /** The windows currently receiving broadcasts. @type {Map<number, LogSubscriber>} */
  private subscribers = new Map<number, LogSubscriber>();

  /** The identity handed to the next subscription. @type {number} */
  private nextSubscriberId = 1;

  /**
   * Publishes one entry: stamps it with the next sequence number, appends it
   * to the history and broadcasts it to every subscriber except the origin.
   *
   * The origin is excluded because the window that produced an entry already
   * has it: the renderer adds its own console output to its local store
   * directly, and echoing the entry back would show it twice.
   *
   * @param {LogEntry} entry - The entry to publish.
   * @param {number} [originId] - The `webContents` id of the publisher, when
   *   the publisher is itself a subscriber.
   * @returns {LogEntry} The published entry, including its assigned `seq`.
   */
  publish(entry: LogEntry, originId?: number): LogEntry {
    const published: LogEntry = { ...entry, seq: this.nextSeq };
    this.nextSeq += 1;
    this.entries.push(published);
    if (this.entries.length > LOG_MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - LOG_MAX_ENTRIES);
    }
    for (const subscriber of this.subscribers.values()) {
      if (originId !== undefined && subscriber.webContentsId === originId) continue;
      if (subscriber.isDestroyed()) continue;
      subscriber.send(published);
    }
    return published;
  }

  /**
   * Returns the buffered history, oldest first.
   *
   * The array is a copy: a caller that mutated it would corrupt the history
   * for every other consumer.
   *
   * @returns {LogEntry[]} The buffered entries.
   */
  snapshot(): LogEntry[] {
    return this.entries.slice();
  }

  /**
   * Registers a window to receive published entries.
   *
   * The subscription gets its own identity, so two windows never collide even
   * when their `webContents` carry no id.
   *
   * @param {LogSubscriber} subscriber - The window to subscribe, without an
   *   `id` (the hub assigns one).
   * @returns {number} The identity assigned to the subscription.
   */
  subscribe(subscriber: Omit<LogSubscriber, 'id'>): number {
    const id = this.nextSubscriberId;
    this.nextSubscriberId += 1;
    this.subscribers.set(id, { ...subscriber, id });
    return id;
  }

  /**
   * Removes a subscriber, so a closed window is never written to.
   *
   * @param {number} id - The subscription identity to remove.
   * @returns {void}
   */
  unsubscribe(id: number): void {
    this.subscribers.delete(id);
  }

  /**
   * The number of subscribers currently registered.
   *
   * @returns {number} The subscriber count.
   */
  subscriberCount(): number {
    return this.subscribers.size;
  }
}

/**
 * The process-wide hub instance.
 *
 * A singleton rather than an injected dependency because three separate
 * modules need the same history: the console patch in the main process, the
 * IPC registrar, and the detached-window manager.
 * @const {LogHub}
 */
export const logHub = new LogHub();
