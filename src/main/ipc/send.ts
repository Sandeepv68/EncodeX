/**
 * @fileoverview IPC message sending utilities.
 * Provides the type-safe main→renderer sender factory used across all IPC
 * handler modules (conversion, queue, player, window). The returned IpcSender
 * guards against sending on a destroyed window, so handler code never needs
 * to check the window state before emitting asynchronous notifications.
 */

import { BrowserWindow } from 'electron';
import type { IpcSender } from './types';

/**
 * Creates an IpcSender bound to the given BrowserWindow's WebContents.
 *
 * The returned function forwards a channel name plus an arbitrary argument
 * list via webContents.send, but only while the window has not been
 * destroyed. This makes it safe to call from long-running handlers
 * (conversions, queue jobs, the player) that may outlive the window or fire
 * after it is closed.
 *
 * @param {BrowserWindow} win - The window whose WebContents should receive
 *   the messages.
 * @returns {IpcSender} A sender function of type
 *   (channel: string, ...args: unknown[]) => void. When win.isDestroyed() is
 *   true the send is silently skipped.
 */
export function createSender(win: BrowserWindow): IpcSender {
  return (channel: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };
}
