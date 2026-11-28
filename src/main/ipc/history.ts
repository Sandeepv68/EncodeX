import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  LOG_IPC_HISTORY_CLEAR,
  LOG_IPC_HISTORY_GET_THUMBNAIL,
  LOG_IPC_HISTORY_LIST,
  LOG_IPC_HISTORY_REMOVE,
} from '../../shared/log-constants';
import { formatError } from '../../shared/errors';
import { Logger } from '../../shared/logger';
import type { HistoryEntry } from '../../shared/history/types';
import type { HistoryStore } from '../history/store';

const log = new Logger('main/ipc/history');

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerHistoryHandlers(store: HistoryStore, notify: () => void): void {
  ipcMain.handle(IPC.HISTORY_LIST, async (): Promise<HistoryEntry[]> => {
    log.info(LOG_IPC_HISTORY_LIST);
    try {
      return store.list();
    } catch (err) {
      log.error(LOG_IPC_HISTORY_LIST, describeError(err));
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.HISTORY_GET_THUMBNAIL, async (_event, id: string): Promise<string | null> => {
    log.info(LOG_IPC_HISTORY_GET_THUMBNAIL, id);
    try {
      return typeof id === 'string' ? store.getThumbnail(id) : null;
    } catch (err) {
      log.error(LOG_IPC_HISTORY_GET_THUMBNAIL, describeError(err));
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.HISTORY_CLEAR, async (): Promise<void> => {
    log.info(LOG_IPC_HISTORY_CLEAR);
    try {
      store.clear();
      notify();
    } catch (err) {
      log.error(LOG_IPC_HISTORY_CLEAR, describeError(err));
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.HISTORY_REMOVE, async (_event, id: string): Promise<boolean> => {
    log.info(LOG_IPC_HISTORY_REMOVE, id);
    try {
      const removed = typeof id === 'string' ? store.remove(id) : false;
      if (removed) notify();
      return removed;
    } catch (err) {
      log.error(LOG_IPC_HISTORY_REMOVE, describeError(err));
      throw formatError(err);
    }
  });
}
