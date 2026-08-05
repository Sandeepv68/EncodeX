import { Collapse } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faTriangleExclamation, faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons';
import { ErrorCode } from '../../shared/errors';
import type { ErrorBannerProps } from './types';
import { COLORS } from '../colors';
import {
  BannerRoot,
  BannerIconBox,
  BannerMessageBox,
  BannerMessageText,
  BannerDetailText,
  BannerCloseButton,
  BannerCloseIcon,
} from '../styles/ErrorBanner.styles';

const config: Record<string, { color: string; bg: string; icon: React.ReactElement }> = {
  [ErrorCode.FILE_NOT_FOUND]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.FFMPEG_NOT_FOUND]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.CONVERSION_FAILED]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.QUEUE_ERROR]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PLAYER_ERROR]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PERMISSION_DENIED]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.UNKNOWN]: { color: COLORS.error, bg: COLORS.tint.error10, icon: <FontAwesomeIcon icon={faCircleExclamation} /> },
  [ErrorCode.PROBE_FAILED]: { color: COLORS.warning, bg: COLORS.tint.warning10, icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.INVALID_FORMAT]: { color: COLORS.warning, bg: COLORS.tint.warning10, icon: <FontAwesomeIcon icon={faTriangleExclamation} /> },
  [ErrorCode.BMF_NOT_AVAILABLE]: {
    color: COLORS.warning,
    bg: COLORS.tint.warning10,
    icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
  },
  [ErrorCode.FFPROBE_NOT_FOUND]: {
    color: COLORS.warning,
    bg: COLORS.tint.warning10,
    icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
  },
  [ErrorCode.CANCELLED]: { color: COLORS.info, bg: COLORS.tint.info10, icon: <FontAwesomeIcon icon={faCircleInfo} /> },
  [ErrorCode.OUTPUT_NOT_SPECIFIED]: { color: COLORS.info, bg: COLORS.tint.info10, icon: <FontAwesomeIcon icon={faCircleInfo} /> },
  [ErrorCode.INPUT_NOT_SPECIFIED]: { color: COLORS.info, bg: COLORS.tint.info10, icon: <FontAwesomeIcon icon={faCircleInfo} /> },
};

export default function ErrorBanner({ error, onClose }: ErrorBannerProps) {
  if (!error) return null;
  const cfg = config[error.code] || config[ErrorCode.UNKNOWN];
  return (
    <Collapse in>
      <BannerRoot $tone={cfg.color} $tint={cfg.bg}>
        <BannerIconBox $tone={cfg.color}>{cfg.icon}</BannerIconBox>
        <BannerMessageBox>
          <BannerMessageText variant="body2" $tone={cfg.color}>
            {error.message}
          </BannerMessageText>
          {error.detail && (
            <BannerDetailText variant="caption" $tone={cfg.color}>
              {error.detail}
            </BannerDetailText>
          )}
        </BannerMessageBox>
        {onClose && (
          <BannerCloseButton size="small" onClick={onClose} $tone={cfg.color}>
            <BannerCloseIcon icon={faXmark} />
          </BannerCloseButton>
        )}
      </BannerRoot>
    </Collapse>
  );
}
