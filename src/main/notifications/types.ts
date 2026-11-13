export interface NotifierOptions {
  getMainWindow: () => import('electron').BrowserWindow | null;
}

export type NotificationTarget = 'queue' | 'mux';
