/**
 * @fileoverview Dismissible inline error banner.
 *
 * Renders a prominent banner at the top of a page/form when an operation has
 * failed. Given an AppError, the banner picks a MUI alert severity (error,
 * warning, or info) and an accompanying FontAwesome icon based on the error
 * code, then shows the error message plus any technical `detail`. An optional
 * close button removes the banner via `onClose`.
 *
 * Severity mapping by code:
 *  - error (circle-exclamation): FILE_NOT_FOUND, FFMPEG_NOT_FOUND,
 *    CONVERSION_FAILED, QUEUE_ERROR, PLAYER_ERROR, PERMISSION_DENIED, UNKNOWN.
 *  - warning (triangle-exclamation): PROBE_FAILED, INVALID_FORMAT,
 *    BMF_NOT_AVAILABLE, FFPROBE_NOT_FOUND.
 *  - info (circle-info): CANCELLED, OUTPUT_NOT_SPECIFIED,
 *    INPUT_NOT_SPECIFIED.
 * Unknown codes fall back to the UNKNOWN (error) configuration. The banner is
 * wrapped in a MUI Collapse and enters with a slide/fade animation.
 *
 * Props (see {@link ErrorBannerProps}):
 *  - error: the AppError to display, or null to render nothing.
 *  - onClose: optional callback; when provided, a dismiss button is shown.
 */

import { Collapse } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faTriangleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { ErrorCode } from '../../shared/errors';
import type { ErrorBannerProps } from './types';
import { BaseAlert } from '../styles/alerts.styles';
import { BannerMessageText, BannerDetailText } from '../styles/ErrorBanner.styles';

/**
 * Per-error-code presentation settings: the MUI severity and the matching
 * FontAwesome icon. Entries are keyed by ErrorCode values; unknown codes are
 * resolved to the UNKNOWN entry by the component.
 * @const {Record<string, {severity: AlertColor; icon: React.ReactElement}>} config
 */
const config: Record<string, { severity: AlertColor; icon: React.ReactElement }> = {
  [ErrorCode.FILE_NOT_FOUND]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.FFMPEG_NOT_FOUND]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.CONVERSION_FAILED]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.QUEUE_ERROR]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PLAYER_ERROR]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PERMISSION_DENIED]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.UNKNOWN]: { severity: 'error', icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PROBE_FAILED]: { severity: 'warning', icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.INVALID_FORMAT]: { severity: 'warning', icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.BMF_NOT_AVAILABLE]: { severity: 'warning', icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.FFPROBE_NOT_FOUND]: { severity: 'warning', icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.CANCELLED]: { severity: 'info', icon: <FontAwesomeIcon icon={faCircleInfo} /> },
  [ErrorCode.OUTPUT_NOT_SPECIFIED]: { severity: 'info', icon: <FontAwesomeIcon icon={faCircleInfo} /> },
  [ErrorCode.INPUT_NOT_SPECIFIED]: { severity: 'info', icon: <FontAwesomeIcon icon={faCircleInfo} /> },
};

/**
 * Renders the inline error banner, or nothing when `error` is null.
 *
 * Resolves the presentation config for the error code (falling back to UNKNOWN)
 * and lays out the icon, message, optional detail, and optional dismiss button
 * inside the shared alert surface.
 * @param {ErrorBannerProps} props - Component props.
 * @param {AppError | null} props.error - Error to display; null renders nothing.
 * @param {() => void} [props.onClose] - Dismiss callback; enables the close
 *   button when provided.
 * @returns {JSX.Element | null} The banner, or null when there is no error.
 */
export default function ErrorBanner({ error, onClose }: ErrorBannerProps) {
  if (!error) return null;
  const cfg = config[error.code] || config[ErrorCode.UNKNOWN];
  return (
    <Collapse in>
      <BaseAlert severity={cfg.severity} icon={cfg.icon} onClose={onClose}>
        <BannerMessageText variant="body2">{error.message}</BannerMessageText>
        {error.detail && <BannerDetailText variant="caption">{error.detail}</BannerDetailText>}
      </BaseAlert>
    </Collapse>
  );
}
