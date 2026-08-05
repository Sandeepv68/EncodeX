import { Snackbar, AlertColor } from '@mui/material';
import { Logger } from '../../shared/logger';
import { ErrorCode } from '../../shared/errors';
import type { ErrorSnackbarProps } from './types';
import { SnackbarAlert, AlertMessage, AlertDetail } from '../styles/ErrorSnackbar.styles';
import { SNACKBAR_AUTO_HIDE_MS } from '../../shared/constants';

const log = new Logger('renderer/components/ErrorSnackbar');

const severityMap: Record<string, AlertColor> = {
  [ErrorCode.CONVERSION_FAILED]: 'error',
  [ErrorCode.FILE_NOT_FOUND]: 'error',
  [ErrorCode.FFMPEG_NOT_FOUND]: 'error',
  [ErrorCode.FFPROBE_NOT_FOUND]: 'warning',
  [ErrorCode.INVALID_FORMAT]: 'warning',
  [ErrorCode.PROBE_FAILED]: 'warning',
  [ErrorCode.QUEUE_ERROR]: 'error',
  [ErrorCode.PLAYER_ERROR]: 'error',
  [ErrorCode.CANCELLED]: 'info',
  [ErrorCode.BMF_NOT_AVAILABLE]: 'warning',
  [ErrorCode.OUTPUT_NOT_SPECIFIED]: 'info',
  [ErrorCode.INPUT_NOT_SPECIFIED]: 'info',
  [ErrorCode.PERMISSION_DENIED]: 'error',
  [ErrorCode.UNKNOWN]: 'error',
};

export default function ErrorSnackbar({ error, onClose }: ErrorSnackbarProps) {
  if (!error) return null;
  const severity = severityMap[error.code] || 'error';
  return (
    <Snackbar open autoHideDuration={SNACKBAR_AUTO_HIDE_MS} onClose={onClose} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <SnackbarAlert onClose={onClose} severity={severity} variant="filled">
        <AlertMessage>{error.message}</AlertMessage>
        {error.detail && <AlertDetail>{error.detail}</AlertDetail>}
      </SnackbarAlert>
    </Snackbar>
  );
}
