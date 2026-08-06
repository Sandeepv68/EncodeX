/**
 * @fileoverview IPC handler for FFmpeg capability queries.
 * Registers the main-process handler for the GET_CAPABILITIES channel and
 * delegates to getEncoderCapabilities() (src/main/capabilities.ts) to
 * discover which video/audio encoders and hardware acceleration methods are
 * available in the bundled FFmpeg binary. Results are cached on first probe
 * and returned to the renderer so the UI can enable or disable codec and
 * hardware-acceleration options accordingly.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getEncoderCapabilities } from '../capabilities';
import { LOG_IPC_GET_CAPABILITIES_CALLED } from '../../shared/log-constants';

const log = new Logger('main/ipc/capabilities');

/**
 * Registers the IPC handler for the GET_CAPABILITIES channel.
 *
 * @returns {void} Nothing is returned.
 */
export function registerCapabilityHandlers(): void {
  /**
   * Handles the IPC.GET_CAPABILITIES channel (get-capabilities).
   * No payload is expected. Returns the cached or freshly probed encoder and
   * hardware-acceleration capabilities. Unlike most handlers it never throws:
   * getEncoderCapabilities() logs probe failures and returns null instead.
   *
   * @returns {EncoderCapabilities | null} Lists of available videoEncoders,
   *   audioEncoders and hwaccels, or null when the FFmpeg capability probe
   *   failed.
   */
  ipcMain.handle(IPC.GET_CAPABILITIES, () => {
    log.debug(LOG_IPC_GET_CAPABILITIES_CALLED);
    return getEncoderCapabilities();
  });
}
