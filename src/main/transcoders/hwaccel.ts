import { Logger } from '../../shared/logger';
import { HWACCEL_DEFAULTS } from '../../shared/hwaccel-settings';
import { isHardwareVideoCodec } from '../../shared/codec-classification';
import type { HwAccelMode } from '../../shared/hwaccel-settings';

export { isHardwareVideoCodec };

const log = new Logger('main/transcoders/hwaccel');

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

  log.debug('Applying hardware acceleration flags for', videoCodec, ':', flags.join(' '));
  return flags;
}
