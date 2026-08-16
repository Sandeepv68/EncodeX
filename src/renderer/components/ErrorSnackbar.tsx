/**
 * @fileoverview Auto-hiding error snackbar.
 *
 * Renders a transient top-right Snackbar when an AppError is present. The
 * snackbar maps the error code to a MUI Alert severity (error / warning / info)
 * and displays the error message with an optional technical detail line. It
 * auto-hides after SNACKBAR_AUTO_HIDE_MS and can also be dismissed manually via
 * its close button or by swiping; both paths call `onClose`.
 *
 * Severity mapping by code:
 *  - 'error': CONVERSION_FAILED, FILE_NOT_FOUND, FFMPEG_NOT_FOUND, QUEUE_ERROR,
 *    PLAYER_ERROR, PERMISSION_DENIED, UNKNOWN.
 *  - 'warning': FFPROBE_NOT_FOUND, INVALID_FORMAT, PROBE_FAILED,
 *    BMF_NOT_AVAILABLE.
 *  - 'info': CANCELLED, OUTPUT_NOT_SPECIFIED, INPUT_NOT_SPECIFIED.
 * Unknown codes default to 'error'.
 *
 * Props (see {@link ErrorSnackbarProps}):
 *  - error: the AppError to surface, or null to render nothing.
 *  - onClose: fired when the snackbar is dismissed or auto-hidden.
 */

import { Snackbar, AlertColor } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Logger } from '../../shared/logger';
import { ErrorCode } from '../../shared/errors';
import type { ErrorSnackbarProps } from './types';
import { SnackbarAlert, AlertMessage, AlertDetail } from '../styles/ErrorSnackbar.styles';
import { SNACKBAR_AUTO_HIDE_MS, TITLE_BAR_HEIGHT } from '../../shared/constants';

const log = new Logger('renderer/components/ErrorSnackbar');

/**
 * Maps each error code to a MUI Alert severity color.
 * @const {Record<string, AlertColor>} severityMap
 */
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

/**
 * Renders the error snackbar, or nothing when `error` is null.
 *
 * Resolves the severity for the error code (defaulting to 'error') and renders
 * a filled, closable SnackbarAlert anchored at the top-right with an automatic
 * hide duration. A second line is shown when `error.detail` is present.
 * @param {ErrorSnackbarProps} props - Component props.
 * @param {AppError | null} props.error - Error to display; null renders nothing.
 * @param {() => void} props.onClose - Dismissal callback for manual close and
 *   auto-hide.
 * @returns {JSX.Element | null} The snackbar, or null when there is no error.
 */
export default function ErrorSnackbar({ error, onClose }: ErrorSnackbarProps) {
  const theme = useTheme();
  if (!error) return null;
  const severity = severityMap[error.code] || 'error';
  return (
    <Snackbar
      open
      autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ root: { style: { top: `calc(${theme.typography.pxToRem(TITLE_BAR_HEIGHT)} + ${theme.spacing(1)})` } } }}
    >
      <SnackbarAlert onClose={onClose} severity={severity} variant="filled">
        <AlertMessage>{error.message}</AlertMessage>
        {error.detail && <AlertDetail>{error.detail}</AlertDetail>}
      </SnackbarAlert>
    </Snackbar>
  );
}
