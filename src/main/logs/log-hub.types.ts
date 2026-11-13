/**
 * @fileoverview Types for the main-process log hub.
 *
 * @module main/logs/log-hub.types
 */

import type { LogEntry } from '../../shared/types';

/**
 * A window that wants to receive log entries.
 *
 * The shape is deliberately narrow - an identity, a liveness check and a send
 * function - so the hub can be unit-tested without Electron, and so a window
 * that has been destroyed is skipped instead of throwing on `send`.
 * @interface LogSubscriber
 * @property {number} id - Identifies the subscription. Each subscription gets
 *   its own value, so two windows never collide even when their `webContents`
 *   carry no id.
 * @property {number | undefined} webContentsId - The id of the `webContents`
 *   this subscription belongs to, used to skip echoing an entry back to the
 *   window that produced it.
 * @property {() => boolean} isDestroyed - True once the window is gone.
 * @property {(entry: LogEntry) => void} send - Delivers one entry to the window.
 */
export interface LogSubscriber {
  id: number;
  webContentsId: number | undefined;
  isDestroyed: () => boolean;
  send: (entry: LogEntry) => void;
}
