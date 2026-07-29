import { Snackbar, Alert, AlertColor } from '@mui/material';
import { AppError, ErrorCode, ErrorCodeType } from '../../shared/errors';

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

interface Props {
  error: AppError | null;
  onClose: () => void;
}

export default function ErrorSnackbar({ error, onClose }: Props) {
  if (!error) return null;
  const severity = severityMap[error.code] || 'error';
  return (
    <Snackbar open autoHideDuration={6000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert onClose={onClose} severity={severity} variant="filled" sx={{ maxWidth: 600 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{error.message}</div>
        {error.detail && <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{error.detail}</div>}
      </Alert>
    </Snackbar>
  );
}
