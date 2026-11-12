/**
 * @fileoverview IPC handlers for the detached Logs window.
 *
 * Three channels are served here:
 *
 *  - `IPC.LOGS_WINDOW_OPEN` (fire-and-forget): the renderer asks the main
 *    process to open the detached Logs window. The window itself is created by
 *    {@link openLogsWindow}, which also subscribes it to the log hub.
 *  - `IPC.LOGS_PUBLISH` (fire-and-forget): the renderer mirrors its own
 *    console output into the main-process log hub, so a detached window can
 *    show renderer-side entries it would otherwise never see.
 *  - `IPC.LOGS_HISTORY` (request): the detached window asks for the buffered
 *    history it missed while it was not open.
 *
 * The handlers are registered from `registerIpcHandlers()` so the channel
 * contract test sees them in the same place as every other handler.
 *
 * @module main/ipc/logs
 */

import { ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { isLogEntry } from '../../shared/ipc-guards';
import { logHub } from '../logs/log-hub';
import { openLogsWindow } from '../logs/logs-window';

/**
 * True once the handlers have been registered.
 *
 * `ipcMain.handle` throws when a channel is registered twice, and the main
 * window can be recreated (the `activate` event on macOS), which re-runs
 * `registerIpcHandlers()`. The guard keeps a second registration from
 * breaking the process.
 * @type {boolean}
 */
let registered = false;

/**
 * Registers the Logs-window IPC handlers.
 *
 * @returns {void} Nothing is returned.
 */
export function registerLogsHandlers(): void {
  if (registered) return;
  registered = true;

  /**
   * Opens the detached Logs window, or focuses the one that is already open.
   *
   * @returns {void}
   */
  ipcMain.on(IPC.LOGS_WINDOW_OPEN, () => {
    openLogsWindow();
  });

  /**
   * Publishes renderer-produced log entries into the main-process hub.
   *
   * The payload is an array of entries: the renderer batches its console
   * output so a chatty renderer does not turn every log line into its own IPC
   * message. Entries that do not match the `LogEntry` shape are dropped rather
   * than forwarded, because the hub would hand them straight to a window's
   * log view.
   *
   * @param {unknown} payload - The batch of entries published by the renderer.
   * @param {IpcMainEvent} event - The event that carried the batch.
   * @returns {void}
   */
  ipcMain.on(IPC.LOGS_PUBLISH, (event: IpcMainEvent, payload: unknown) => {
    if (!Array.isArray(payload)) return;
    for (const candidate of payload) {
      if (!isLogEntry(candidate)) continue;
      logHub.publish(candidate, event.sender.id);
    }
  });

  /**
   * Returns the buffered log history the hub has collected so far.
   *
   * @returns {import('../../shared/types').LogEntry[]} The buffered entries, oldest first.
   */
  ipcMain.handle(IPC.LOGS_HISTORY, () => logHub.snapshot());
}
