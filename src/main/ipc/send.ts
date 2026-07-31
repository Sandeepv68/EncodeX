import { BrowserWindow } from 'electron';

export type IpcSender = (channel: string, ...args: unknown[]) => void;

export function createSender(win: BrowserWindow): IpcSender {
  return (channel: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };
}
