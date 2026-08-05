/**
 * @fileoverview IPC handler for FFmpeg capability queries.
 * Provides encoder, decoder, and hardware acceleration capability information to renderer.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getEncoderCapabilities } from '../capabilities';

const log = new Logger('main/ipc/capabilities');

export function registerCapabilityHandlers(): void {
  ipcMain.handle(IPC.GET_CAPABILITIES, () => {
    log.debug('GET_CAPABILITIES called');
    return getEncoderCapabilities();
  });
}
