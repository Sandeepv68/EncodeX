/**
 * @fileoverview IPC handler for FFmpeg capability queries.
 * Provides encoder, decoder, and hardware acceleration capability information to renderer.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getEncoderCapabilities } from '../capabilities';
import { LOG_IPC_GET_CAPABILITIES_CALLED } from '../../shared/log-constants';

const log = new Logger('main/ipc/capabilities');

export function registerCapabilityHandlers(): void {
  ipcMain.handle(IPC.GET_CAPABILITIES, () => {
    log.debug(LOG_IPC_GET_CAPABILITIES_CALLED);
    return getEncoderCapabilities();
  });
}
