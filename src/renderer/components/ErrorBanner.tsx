import { Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Logger } from '../../shared/logger';
import { AppError, ErrorCode, ErrorCodeType } from '../../shared/errors';
import {
  BannerRoot,
  BannerIconBox,
  BannerMessageBox,
  BannerMessageText,
  BannerDetailText,
  BannerCloseButton,
} from '../styles/ErrorBanner.styles';

const log = new Logger('renderer/components/ErrorBanner');

const config: Record<string, { color: string; bg: string; icon: React.ReactElement }> = {
  [ErrorCode.FILE_NOT_FOUND]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.FFMPEG_NOT_FOUND]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.CONVERSION_FAILED]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.QUEUE_ERROR]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.PLAYER_ERROR]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.PERMISSION_DENIED]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.UNKNOWN]: { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)', icon: <ErrorIcon /> },
  [ErrorCode.PROBE_FAILED]: { color: '#f39c12', bg: 'rgba(243,156,18,0.1)', icon: <WarningAmberIcon /> },
  [ErrorCode.INVALID_FORMAT]: { color: '#f39c12', bg: 'rgba(243,156,18,0.1)', icon: <WarningAmberIcon /> },
  [ErrorCode.BMF_NOT_AVAILABLE]: { color: '#f39c12', bg: 'rgba(243,156,18,0.1)', icon: <WarningAmberIcon /> },
  [ErrorCode.FFPROBE_NOT_FOUND]: { color: '#f39c12', bg: 'rgba(243,156,18,0.1)', icon: <WarningAmberIcon /> },
  [ErrorCode.CANCELLED]: { color: '#3498db', bg: 'rgba(52,152,219,0.1)', icon: <InfoOutlinedIcon /> },
  [ErrorCode.OUTPUT_NOT_SPECIFIED]: { color: '#3498db', bg: 'rgba(52,152,219,0.1)', icon: <InfoOutlinedIcon /> },
  [ErrorCode.INPUT_NOT_SPECIFIED]: { color: '#3498db', bg: 'rgba(52,152,219,0.1)', icon: <InfoOutlinedIcon /> },
};

interface Props {
  error: AppError | null;
  onClose?: () => void;
}

export default function ErrorBanner({ error, onClose }: Props) {
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
            <CloseIcon fontSize="small" />
          </BannerCloseButton>
        )}
      </BannerRoot>
    </Collapse>
  );
}
