import { alpha, styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';

export const TIMELINE_LAYOUT = {
  RULER_HEIGHT: 32,
  VIDEO_TRACK_HEIGHT: 84,
  AUDIO_TRACK_HEIGHT: 84,
  TRACK_CONTENT_HEIGHT: 80,
  TRACK_CONTENT_TOP: 2,
} as const;

export const TimelineRoot = styled(Box)(({ theme }) => ({
  borderRadius: (theme.shape.borderRadius as number) * 1.5,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

export const TimelineToolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

export const TimelineTimeText = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  color: theme.palette.text.secondary,
  fontVariantNumeric: 'tabular-nums',
}));

export const ZoomButton = styled(IconButton)({ padding: 4 });

export const Viewport = styled(Box)(({ theme }) => ({
  position: 'relative',
  overflowX: 'auto',
  overflowY: 'hidden',
  cursor: 'pointer',
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderRadius: theme.typography.pxToRem(4),
  },
}));

export const TrackLabelPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#141414',
  zIndex: 2,
}));

export const TrackLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 72,
  color: theme.palette.text.secondary,
  gap: theme.spacing(0.25),
}));

export const Scroller = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$width',
})<{ $width: number }>(({ $width }) => ({
  position: 'relative',
  minWidth: '100%',
  userSelect: 'none',
  width: $width,
}));

export const Ruler = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: TIMELINE_LAYOUT.RULER_HEIGHT,
  backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#141414',
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
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
  transform: `translateX(${theme.typography.pxToRem(3)})`,
  fontSize: theme.typography.pxToRem(10),
  lineHeight: 1.2,
  color: theme.palette.text.secondary,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
}));

export const MarkerBubble = styled(Box)(({ theme }) => {
  const bg = theme.palette.mode === 'light' ? 'rgb(0 0 0 / 66%)' : 'rgba(97, 97, 97, 0.9)';
  return {
    position: 'absolute',
    bottom: -3,
    transform: 'translateX(-50%)',
    backgroundColor: bg,
    color: '#fff',
    fontSize: theme.typography.pxToRem(10),
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    padding: theme.spacing(0.75, 0.75),
    borderRadius: theme.typography.pxToRem(8),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: theme.shadows[1],
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 5,
  };
});

export const Lane = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT,
}));

export const ClipTrack = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  bottom: 12,
  left: 0,
  right: 0,
  backgroundColor: theme.palette.primary.main,
  opacity: 0.3,
  borderRadius: theme.typography.pxToRem(3),
  pointerEvents: 'none',
}));

export const VideoTrack = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT,
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
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

export const WaveformBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  backgroundColor: theme.palette.primary.main,
  borderRadius: theme.typography.pxToRem(1),
  opacity: 0.75,
}));

export const KeptRegion = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  bottom: TIMELINE_LAYOUT.TRACK_CONTENT_TOP,
  backgroundColor: theme.palette.primary.main,
  borderLeft: `${theme.typography.pxToRem(2)} solid ${theme.palette.success.main}`,
  borderRight: `${theme.typography.pxToRem(2)} solid ${theme.palette.error.main}`,
  borderRadius: theme.typography.pxToRem(3),
  zIndex: 3,
  cursor: 'move',
  pointerEvents: 'auto',
  opacity: 0.5,
  '&:hover > .timeline-move-indicator': {
    opacity: 1,
  },
}));

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
  border: `${theme.typography.pxToRem(1)} solid rgba(255, 255, 255, 0.85)`,
  borderRadius: theme.typography.pxToRem(2),
  boxShadow: `0 0 ${theme.typography.pxToRem(4)} rgba(0, 0, 0, 0.45)`,
  '&::before': {
    content: '""',
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.typography.pxToRem(1),
  },
}));

export const TrackBubbleAnchor = styled(Box)({
  position: 'absolute',
  left: 0,
  right: 0,
  pointerEvents: 'none',
  zIndex: 2,
});

export const ScrollShadowAnchor = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: TIMELINE_LAYOUT.RULER_HEIGHT + TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT,
  pointerEvents: 'none',
  zIndex: 2,
});

export const ScrollShadow = styled(Box)(({ theme }) => {
  const light = theme.palette.mode === 'light';
  return {
    position: 'sticky',
    left: 0,
    top: 0,
    width: 24,
    height: '100%',
    background: light
      ? 'linear-gradient(to right, rgb(0 0 0 / 20%), rgba(0, 0, 0, 0))'
      : 'linear-gradient(to right, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0))',
    borderLeft: `${theme.typography.pxToRem(1)} solid ${light ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)'}`,
  };
});

export const TrackInfoBubble = styled(Box)(({ theme }) => {
  const bg = theme.palette.mode === 'light' ? 'rgb(0 0 0 / 66%)' : 'rgba(33, 33, 33, 0.95)';
  return {
    position: 'sticky',
    top: 0,
    left: 0,
    width: 'max-content',
    maxWidth: `min(60vw, ${theme.typography.pxToRem(480)})`,
    backgroundColor: bg,
    color: '#fff',
    fontSize: theme.typography.pxToRem(11),
    lineHeight: 1.3,
    padding: theme.spacing(0.5, 1),
    borderBottomRightRadius: theme.typography.pxToRem(6),
    boxShadow: theme.shadows[2],
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    zIndex: 2,
    transition: 'opacity 120ms ease',
  };
});

export const PlayheadLine = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  transform: 'translateX(-50%)',
  backgroundColor: theme.palette.error.main,
  zIndex: 4,
  cursor: 'ew-resize',
}));

export const PlayheadHead = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: -4,
  width: 0,
  height: 0,
  borderLeft: `${theme.typography.pxToRem(5)} solid transparent`,
  borderRight: `${theme.typography.pxToRem(5)} solid transparent`,
  borderBottom: `${theme.typography.pxToRem(8)} solid ${theme.palette.error.main}`,
  pointerEvents: 'none',
}));
