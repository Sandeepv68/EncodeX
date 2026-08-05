/**
 * @fileoverview IPC message sending utilities.
 * Provides type-safe IPC message sending from main to renderer process.
 */

import { BrowserWindow } from 'electron';
import type { IpcSender } from './types';

export function createSender(win: BrowserWindow): IpcSender {
  return (channel: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };
}
