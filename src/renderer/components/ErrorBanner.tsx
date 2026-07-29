import { Box, Typography, IconButton, Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AppError, ErrorCode, ErrorCodeType } from '../../shared/errors';

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          p: 1.5,
          borderRadius: 1,
          bgcolor: cfg.bg,
          border: `1px solid ${cfg.color}33`,
        }}
      >
        <Box sx={{ color: cfg.color, mt: 0.3, display: 'flex' }}>{cfg.icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: cfg.color }}>
            {error.message}
          </Typography>
          {error.detail && (
            <Typography variant="caption" sx={{ color: cfg.color, opacity: 0.8, display: 'block', mt: 0.3 }}>
              {error.detail}
            </Typography>
          )}
        </Box>
        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ color: cfg.color, mt: -0.3 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Collapse>
  );
}
