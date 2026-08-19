/**
 * @fileoverview Central IPC handler registration and setup.
 * Single entry point that wires up every IPC channel between the main and
 * renderer processes. It first creates the main→renderer sender via
 * createSender() (see src/main/ipc/send.ts), then delegates to each
 * per-domain registration module: dialogs, capabilities, conversion, queue,
 * player, window, image and timeline. The main process is expected to call
 * registerIpcHandlers() once at startup with the main BrowserWindow so all
 * channel handlers exist before the renderer issues any IPC request. Note
 * that ipcMain handlers are registered globally on Electron's singleton
 * ipcMain; only the modules receiving the window reference (dialogs,
 * conversion, queue, player, window) are scoped to the given window.
 */

import { BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { createSender } from './send';
import { registerDialogHandlers } from './dialogs';
import { registerConversionHandlers } from './conversion';
import { registerQueueHandlers } from './queue';
import { registerSystemHandlers } from './system';
import { registerPlayerHandlers } from './player';
import { registerWindowHandlers } from './window';
import { registerCapabilityHandlers } from './capabilities';
import { registerImageHandlers } from './image';
import { registerTimelineHandlers } from './timeline';
import { registerUpdaterHandlers } from './updater';
import { LOG_REGISTERING_IPC_HANDLERS } from '../../shared/log-constants';

const log = new Logger('main/ipc/handlers');

/**
 * Registers all IPC handlers for the given main BrowserWindow.
 *
 * Each registration module installs its channel handlers; the window is used
 * as the dialog parent and to derive the shared main→renderer sender, which is
 * handed to the conversion, queue and player modules for pushing asynchronous
 * events (progress, job updates, decoded frames).
 *
 * @param {BrowserWindow} win - The application's main BrowserWindow. Used as
 *   the parent of native dialogs and as the target of all main→renderer
 *   messages.
 * @returns {void} Nothing is returned.
 */
export function registerIpcHandlers(win: BrowserWindow): void {
  log.info(LOG_REGISTERING_IPC_HANDLERS);
  const send = createSender(win);
  registerDialogHandlers(win);
  registerCapabilityHandlers();
  registerConversionHandlers(win, send);
  registerQueueHandlers(win, send);
  registerSystemHandlers(win);
  registerPlayerHandlers(win, send);
  registerWindowHandlers(win);
  registerImageHandlers();
  registerTimelineHandlers();
  registerUpdaterHandlers(win);
}
