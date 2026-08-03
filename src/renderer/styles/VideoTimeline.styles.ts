import { alpha, styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';
import { COLORS } from '../colors';

export const TIMELINE_LAYOUT = {
  RULER_HEIGHT: 32,
  VIDEO_TRACK_HEIGHT: 84,
  AUDIO_TRACK_HEIGHT: 84,
  TRACK_CONTENT_HEIGHT: 80,
  TRACK_CONTENT_TOP: 2,
} as const;

export const TimelineRoot = styled(Box)(({ theme }) => ({
  borderRadius: (theme.shape.borderRadius as number) * 1.5,
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

export const TimelineToolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const TimelineTimeText = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  color: theme.palette.text.secondary,
  fontVariantNumeric: 'tabular-nums',
}));

export const ZoomButton = styled(IconButton)({ padding: 4 });

export const Viewport = styled(Box)({
  position: 'relative',
  overflowX: 'auto',
  overflowY: 'hidden',
  cursor: 'pointer',
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderRadius: 4,
  },
});

export const TrackLabelPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#141414',
  zIndex: 2,
}));

export const TrackLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  color: theme.palette.text.secondary,
}));

export const Scroller = styled(Box)({
  position: 'relative',
  minWidth: '100%',
  userSelect: 'none',
});

export const Ruler = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: TIMELINE_LAYOUT.RULER_HEIGHT,
  backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#141414',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const RulerTick = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  width: 1,
  height: 10,
  backgroundColor: theme.palette.text.secondary,
  pointerEvents: 'none',
}));

export const RulerMinorTick = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  width: 1,
  height: 5,
  backgroundColor: alpha(theme.palette.text.secondary, 0.5),
  pointerEvents: 'none',
}));

export const RulerLabel = styled(Typography)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  transform: 'translateX(3px)',
  fontSize: 10,
  lineHeight: 1.2,
  color: theme.palette.text.secondary,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
}));

export const Lane = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT,
}));

export const ClipTrack = styled(Box)({
  position: 'absolute',
  top: 12,
  bottom: 12,
  left: 0,
  right: 0,
  backgroundColor: COLORS.primary,
  opacity: 0.3,
  borderRadius: 3,
  pointerEvents: 'none',
});

export const VideoTrack = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT,
  borderBottom: `1px solid ${theme.palette.divider}`,
  zIndex: 0,
  pointerEvents: 'none',
}));

export const AudioTrack = styled(Box)({
  position: 'absolute',
  top: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT,
  left: 0,
  right: 0,
  height: TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT,
  backgroundColor: '#809dca42',
  zIndex: 0,
  pointerEvents: 'none',
});

export const ThumbCell = styled(Box)({
  position: 'absolute',
  top: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  bottom: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  backgroundRepeat: 'no-repeat',
});

export const WaveformBar = styled(Box)({
  position: 'absolute',
  backgroundColor: COLORS.primary,
  borderRadius: 1,
  opacity: 0.75,
});

export const KeptRegion = styled(Box)({
  position: 'absolute',
  top: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  bottom: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  backgroundColor: COLORS.primary,
  borderLeft: `2px solid ${COLORS.success}`,
  borderRight: `2px solid ${COLORS.error}`,
  borderRadius: 3,
  zIndex: 2,
  pointerEvents: 'none',
  opacity: 0.5,
});

export const DimmedRegion = styled(Box)({
  position: 'absolute',
  top: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  bottom: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  zIndex: 1,
  pointerEvents: 'none',
});

export const TrimHandle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 6,
  bottom: 6,
  width: 10,
  transform: 'translateX(-50%)',
  cursor: 'ew-resize',
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.info.main,
  border: '1px solid rgba(255, 255, 255, 0.85)',
  borderRadius: 2,
  boxShadow: '0 0 4px rgba(0, 0, 0, 0.45)',
  '&::before': {
    content: '""',
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 1,
  },
}));

export const PlayheadLine = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  transform: 'translateX(-50%)',
  backgroundColor: COLORS.error,
  zIndex: 4,
  cursor: 'ew-resize',
});

export const PlayheadHead = styled(Box)({
  position: 'absolute',
  top: 0,
  left: -4,
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderBottom: `8px solid ${COLORS.error}`,
  pointerEvents: 'none',
});
