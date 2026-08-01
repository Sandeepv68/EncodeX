import { BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { createSender } from './send';
import { registerDialogHandlers } from './dialogs';
import { registerConversionHandlers } from './conversion';
import { registerQueueHandlers } from './queue';
import { registerPlayerHandlers } from './player';
import { registerWindowHandlers } from './window';
import { registerCapabilityHandlers } from './capabilities';

const log = new Logger('main/ipc/handlers');

export function registerIpcHandlers(win: BrowserWindow): void {
  log.info('Registering IPC handlers');
  const send = createSender(win);
  registerDialogHandlers(win);
  registerCapabilityHandlers();
  registerConversionHandlers(win, send);
  registerQueueHandlers(win, send);
  registerPlayerHandlers(win, send);
  registerWindowHandlers(win);
}
