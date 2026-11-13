import { Notification, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { NotificationTarget, NotifierOptions } from './types';

export class DesktopNotifier {
  private opts: NotifierOptions;
  private enabled = false;
  private recent = new Map<string, number>();
  private ttlMs = 8000;

  constructor(opts: NotifierOptions) {
    this.opts = opts;
  }

  isSupported(): boolean {
    try {
      return Notification.isSupported();
    } catch {
      return false;
    }
  }

  setEnabled(v: boolean): void {
    this.enabled = Boolean(v);
  }

  getEnabled(): boolean {
    return this.enabled;
  }

  shouldNotify(win: BrowserWindow | null): boolean {
    if (!win) return false;
    try {
      return !win.isFocused() || win.isMinimized();
    } catch {
      return true;
    }
  }

  notify(title: string, body: string, dedupeKey?: string, opts?: { target?: NotificationTarget }): void {
    try {
      if (!this.enabled) return;
      if (!this.isSupported()) return;
      const win = this.opts.getMainWindow();
      if (!this.shouldNotify(win)) return;
      if (dedupeKey) {
        const now = Date.now();
        const last = this.recent.get(dedupeKey);
        if (last && now - last < this.ttlMs) return;
        this.recent.set(dedupeKey, now);
      }
      const n = new Notification({ title, body });
      n.on('click', () => {
        try {
          if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
            if (opts?.target && !win.isDestroyed()) {
              win.webContents.send(IPC.NOTIFICATIONS_CLICKED, { target: opts.target });
            }
          }
        } catch {
          /* ignore */
        }
      });
      n.show();
    } catch {
      /* never throw */
    }
  }
}

let instance: DesktopNotifier | null = null;
export function initNotifier(opts: NotifierOptions): DesktopNotifier {
  instance = new DesktopNotifier(opts);
  return instance;
}
export function getNotifier(): DesktopNotifier | null {
  return instance;
}
