import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getNotifier } from '../notifications/notifier';
import { Logger } from '../../shared/logger';
import { LOG_IPC_NOTIFICATIONS_GET_SETTINGS, LOG_IPC_NOTIFICATIONS_SET_ENABLED } from '../../shared/log-constants';
import type { DesktopNotificationsSettings } from '../../shared/types';

const log = new Logger('main/ipc/notifications');

export function registerNotificationHandlers(_win: BrowserWindow): void {
  ipcMain.handle(IPC.NOTIFICATIONS_GET_SETTINGS, async (): Promise<DesktopNotificationsSettings> => {
    log.debug(LOG_IPC_NOTIFICATIONS_GET_SETTINGS);
    const notifier = getNotifier();
    return { enabled: notifier?.getEnabled() ?? false, supported: notifier?.isSupported() ?? false };
  });
  ipcMain.handle(IPC.NOTIFICATIONS_SET_ENABLED, async (_event, enabled: boolean): Promise<DesktopNotificationsSettings> => {
    log.debug(LOG_IPC_NOTIFICATIONS_SET_ENABLED, { enabled: Boolean(enabled) });
    const notifier = getNotifier();
    notifier?.setEnabled(Boolean(enabled));
    return { enabled: notifier?.getEnabled() ?? false, supported: notifier?.isSupported() ?? false };
  });
}
