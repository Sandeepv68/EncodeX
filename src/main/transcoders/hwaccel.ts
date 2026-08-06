/**
 * @fileoverview Hardware acceleration detection and configuration.
 * Inspects the selected video codec to identify its hardware-encoder family
 * (NVENC, QSV, AMF, VAAPI, VideoToolbox, Media Foundation) and emits the
 * corresponding ffmpeg input flags (`-hwaccel`, `-hwaccel_output_format`,
 * `-vaapi_device`). HW acceleration is only applied when hardware acceleration
 * is enabled and the mode is 'auto'; the codec family is inferred purely from
 * the codec name suffix.
 */

import { Logger } from '../../shared/logger';
import { HWACCEL_DEFAULTS } from '../../shared/hwaccel-settings';
import { isHardwareVideoCodec } from '../../shared/codec-classification';
import type { HwAccelMode } from '../../shared/types';
import { LOG_APPLYING_HARDWARE_ACCELERATION_FLAGS_FOR } from '../../shared/log-constants';

/**
 * Re-exports the codec classification helper for convenience.
 * @const {function(string|undefined): boolean} isHardwareVideoCodec
 */
export { isHardwareVideoCodec };

/**
 * Logger instance scoped to the hardware acceleration module. Logs the flag
 * tokens emitted when hardware acceleration is applied for a codec.
 * @const {Logger} log
 */
const log = new Logger('main/transcoders/hwaccel');

/**
 * ffmpeg hardware acceleration flag tokens and device identifiers.
 * @const {Object} HWACCEL
 * @property {string} HWACCEL - `-hwaccel` flag selecting the decode accelerator
 * @property {string} HWACCEL_OUTPUT_FORMAT - `-hwaccel_output_format` flag
 *   controlling the format frames are output in
 * @property {string} VAAPI_DEVICE - `-vaapi_device` flag selecting the VAAPI device
 * @property {string} CUDA - `'cuda'` accelerator/format name (NVIDIA)
 * @property {string} QSV - `'qsv'` accelerator/format name (Intel)
 * @property {string} D3D11VA - `'d3d11va'` accelerator name (Windows)
 * @property {string} VAAPI - `'vaapi'` accelerator/format name (Linux)
 * @property {string} VIDEOTOOLBOX - `'videotoolbox'` accelerator name (macOS)
 * @property {string} LINUX_VAAPI_DEVICE - `/dev/dri/renderD128` default VAAPI device
 */
export const HWACCEL = {
  HWACCEL: '-hwaccel',
  HWACCEL_OUTPUT_FORMAT: '-hwaccel_output_format',
  VAAPI_DEVICE: '-vaapi_device',
  CUDA: 'cuda',
  QSV: 'qsv',
  D3D11VA: 'd3d11va',
  VAAPI: 'vaapi',
  VIDEOTOOLBOX: 'videotoolbox',
  LINUX_VAAPI_DEVICE: '/dev/dri/renderD128',
} as const;

/**
 * Maps a hardware video codec name to its accelerator family.
 *
 * Inspects the codec name suffix: `_nvenc` -> 'nvenc', `_qsv` -> 'qsv',
 * `_amf` -> 'amf', `_vaapi` -> 'vaapi', `_videotoolbox` -> 'videotoolbox',
 * `_mf` -> 'mf'. Returns null for undefined or software codecs.
 * @param {string|undefined} videoCodec - The video codec name (e.g. `'h264_nvenc'`)
 * @returns {string|null} Family identifier, or null if no hardware family matches
 */
function matchHwAccelFamily(videoCodec: string | undefined): string | null {
  if (!videoCodec) return null;
  if (videoCodec.endsWith('_nvenc')) return 'nvenc';
  if (videoCodec.endsWith('_qsv')) return 'qsv';
  if (videoCodec.endsWith('_amf')) return 'amf';
  if (videoCodec.endsWith('_vaapi')) return 'vaapi';
  if (videoCodec.endsWith('_videotoolbox')) return 'videotoolbox';
  if (videoCodec.endsWith('_mf')) return 'mf';
  return null;
}

/**
 * Generates the ffmpeg input flags for hardware acceleration, if applicable.
 *
 * Hardware acceleration is applied only when `enabled` resolves to true and
 * `mode` resolves to 'auto' (both default to HWACCEL_DEFAULTS). The codec
 * family is inferred from the video codec name; the returned flag set depends
 * on the family:
 * - nvenc: `-hwaccel cuda -hwaccel_output_format cuda`
 * - qsv: `-hwaccel qsv -hwaccel_output_format qsv`
 * - amf / mf: `-hwaccel d3d11va`
 * - vaapi: `-vaapi_device /dev/dri/renderD128 -hwaccel vaapi
 *   -hwaccel_output_format vaapi`
 * - videotoolbox: `-hwaccel videotoolbox`
 *
 * Any other/unknown family or a non-auto mode returns an empty array (no flags).
 * @param {string} [videoCodec] - The video codec name; hardware flags are only
 *   produced for codecs whose suffix maps to a known family
 * @param {boolean} [enabled] - Master hardware acceleration switch; defaults to
 *   HWACCEL_DEFAULTS.ENABLED
 * @param {HwAccelMode} [mode] - Acceleration mode; only 'auto' yields flags,
 *   defaults to HWACCEL_DEFAULTS.MODE
 * @returns {string[]} Ordered ffmpeg input flag tokens, or an empty array when
 *   acceleration is disabled, the mode is not 'auto', or the codec has no known
 *   hardware family
 */
export function getHwAccelArgs(videoCodec?: string, enabled?: boolean, mode?: HwAccelMode): string[] {
  const isEnabled = enabled ?? HWACCEL_DEFAULTS.ENABLED;
  const accelMode = mode ?? HWACCEL_DEFAULTS.MODE;
  if (!isEnabled || accelMode !== 'auto') return [];

  const family = matchHwAccelFamily(videoCodec);
  if (!family) return [];

  let flags: string[];
  switch (family) {
    case 'nvenc':
      flags = [HWACCEL.HWACCEL, HWACCEL.CUDA, HWACCEL.HWACCEL_OUTPUT_FORMAT, HWACCEL.CUDA];
      break;
    case 'qsv':
      flags = [HWACCEL.HWACCEL, HWACCEL.QSV, HWACCEL.HWACCEL_OUTPUT_FORMAT, HWACCEL.QSV];
      break;
    case 'amf':
      flags = [HWACCEL.HWACCEL, HWACCEL.D3D11VA];
      break;
    case 'vaapi':
      flags = [
        HWACCEL.VAAPI_DEVICE,
        HWACCEL.LINUX_VAAPI_DEVICE,
        HWACCEL.HWACCEL,
        HWACCEL.VAAPI,
        HWACCEL.HWACCEL_OUTPUT_FORMAT,
        HWACCEL.VAAPI,
      ];
      break;
    case 'videotoolbox':
      flags = [HWACCEL.HWACCEL, HWACCEL.VIDEOTOOLBOX];
      break;
    case 'mf':
      flags = [HWACCEL.HWACCEL, HWACCEL.D3D11VA];
      break;
    default:
      return [];
  }

  log.debug(LOG_APPLYING_HARDWARE_ACCELERATION_FLAGS_FOR, videoCodec, ':', flags.join(' '));
  return flags;
}
