/**
 * @fileoverview Central IPC handler registration and setup.
 * Initializes all IPC communication channels between main and renderer processes.
 */

import { BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { createSender } from './send';
import { registerDialogHandlers } from './dialogs';
import { registerConversionHandlers } from './conversion';
import { registerQueueHandlers } from './queue';
import { registerPlayerHandlers } from './player';
import { registerWindowHandlers } from './window';
import { registerCapabilityHandlers } from './capabilities';
import { registerImageHandlers } from './image';
import { registerTimelineHandlers } from './timeline';
import { LOG_REGISTERING_IPC_HANDLERS } from '../../shared/log-constants';

const log = new Logger('main/ipc/handlers');

export function registerIpcHandlers(win: BrowserWindow): void {
  log.info(LOG_REGISTERING_IPC_HANDLERS);
  const send = createSender(win);
  registerDialogHandlers(win);
  registerCapabilityHandlers();
  registerConversionHandlers(win, send);
  registerQueueHandlers(win, send);
  registerPlayerHandlers(win, send);
  registerWindowHandlers(win);
  registerImageHandlers();
  registerTimelineHandlers();
}
