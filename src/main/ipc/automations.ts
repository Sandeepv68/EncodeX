/**
 * @fileoverview IPC handlers for the automation definition library.
 *
 * Every library mutation is validated with the shared automation schemas and
 * persisted through {@link AutomationStore}. The two file-transfer operations
 * use native dialogs and reject invalid documents with `AppError`s.
 */

import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { readFileSync, statSync, writeFileSync } from 'fs';
import { formatError, invalidAutomationFileError } from '../../shared/errors';
import {
  LOG_AUTOMATION_HANDLER_FAILED,
  LOG_IPC_AUTOMATION_DELETE,
  LOG_IPC_AUTOMATION_DUPLICATE,
  LOG_IPC_AUTOMATION_EXPORT,
  LOG_IPC_AUTOMATION_GET,
  LOG_IPC_AUTOMATION_IMPORT,
  LOG_IPC_AUTOMATION_LIST,
  LOG_IPC_AUTOMATION_SAVE,
} from '../../shared/log-constants';
import { IPC } from '../../shared/ipc-channels';
import { Logger } from '../../shared/logger';
import { AUTOMATION_LIMITS, AUTOMATION_STORE } from '../../shared/automations/limits';
import {
  parseAutomationDefinition,
  parseAutomationDuplicateRequest,
  parseAutomationExportJson,
  parseAutomationId,
} from '../../shared/automations/schema';
import type { AutomationDefinition } from '../../shared/automations/types';
import { AutomationStore, buildAutomationExport } from '../automations/store';

const log = new Logger('main/ipc/automations');

let store: AutomationStore | null = null;

/** Returns the process-wide automation store, created on first use. */
export function getAutomationStore(): AutomationStore {
  store ??= new AutomationStore(app.getPath('userData'));
  return store;
}

/** Clears the cached store; intended for isolated tests. */
export function resetAutomationStore(): void {
  store = null;
}

async function guarded<T>(channel: string, run: () => T | Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    log.error(LOG_AUTOMATION_HANDLER_FAILED, channel, err);
    throw formatError(err);
  }
}

function safeExportName(name: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  return `${base || 'automation'}.json`;
}

/** Registers the seven Phase 2 automation library handlers. */
export function registerAutomationHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.AUTOMATION_LIST, async () =>
    guarded(IPC.AUTOMATION_LIST, () => {
      log.info(LOG_IPC_AUTOMATION_LIST);
      return getAutomationStore().list();
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_GET, async (_event, id: unknown) =>
    guarded(IPC.AUTOMATION_GET, () => {
      log.info(LOG_IPC_AUTOMATION_GET);
      return getAutomationStore().get(parseAutomationId(id));
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_SAVE, async (_event, definition: unknown) =>
    guarded(IPC.AUTOMATION_SAVE, () => {
      log.info(LOG_IPC_AUTOMATION_SAVE);
      return getAutomationStore().save(parseAutomationDefinition(definition));
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_DELETE, async (_event, id: unknown) =>
    guarded(IPC.AUTOMATION_DELETE, () => {
      log.info(LOG_IPC_AUTOMATION_DELETE);
      return getAutomationStore().delete(parseAutomationId(id));
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_DUPLICATE, async (_event, request: unknown) =>
    guarded(IPC.AUTOMATION_DUPLICATE, () => {
      log.info(LOG_IPC_AUTOMATION_DUPLICATE);
      return getAutomationStore().duplicate(parseAutomationDuplicateRequest(request));
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_IMPORT, async () =>
    guarded(IPC.AUTOMATION_IMPORT, async () => {
      log.info(LOG_IPC_AUTOMATION_IMPORT);
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: AUTOMATION_STORE.dialogFilterName, extensions: ['json'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const filePath = result.filePaths[0];
      try {
        const stat = statSync(filePath);
        if (!stat.isFile() || stat.size > AUTOMATION_LIMITS.maxFileBytes) {
          throw new Error('not a bounded regular file');
        }
        const envelope = parseAutomationExportJson(readFileSync(filePath, 'utf8'));
        return getAutomationStore().importDefinition(envelope.automation);
      } catch (err) {
        throw invalidAutomationFileError(err instanceof Error ? err.message : String(err));
      }
    }),
  );

  ipcMain.handle(IPC.AUTOMATION_EXPORT, async (_event, id: unknown) =>
    guarded(IPC.AUTOMATION_EXPORT, async () => {
      log.info(LOG_IPC_AUTOMATION_EXPORT);
      const definition = getAutomationStore().get(parseAutomationId(id));
      if (!definition) return null;
      const result = await dialog.showSaveDialog(win, {
        title: 'Export Automation',
        defaultPath: safeExportName(definition.name),
        filters: [{ name: AUTOMATION_STORE.dialogFilterName, extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return null;
      const envelope = buildAutomationExport(definition);
      writeFileSync(result.filePath, JSON.stringify(envelope, null, 2), 'utf8');
      return result.filePath;
    }),
  );
}
