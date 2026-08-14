import { alpha, styled } from '@mui/material/styles';
import { Box, Chip, IconButton, Skeleton, Typography } from '@mui/material';
import { OVERLAY_COLORS, TIMELINE_COLORS } from '../colors';

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

export const PreviewBadge = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(0.75),
  height: theme.typography.pxToRem(20),
  '& .MuiChip-label': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.pxToRem(11),
  },
  '&.MuiChip-colorWarning': {
    backgroundColor: alpha(theme.palette.warning.main, 0.18),
  },
}));

export const ZoomButton = styled(IconButton)(({ theme }) => ({ padding: theme.typography.pxToRem(4) }));

/** Zoom-in/zoom-out buttons clustered in the toolbar. @const ZoomControls */
export const ZoomControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.25),
}));

export const Viewport = styled(Box)(({ theme }) => ({
  position: 'relative',
  flex: 1,
  minWidth: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  cursor: 'pointer',
  '&::-webkit-scrollbar': {
    height: theme.typography.pxToRem(8),
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: TIMELINE_COLORS.scrollbarThumb,
    borderRadius: theme.typography.pxToRem(4),
  },
}));

export const TrackLabelPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'light' ? TIMELINE_COLORS.labelPanelBackgroundLight : TIMELINE_COLORS.labelPanelBackgroundDark,
  zIndex: 2,
}));

export const TrackLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.typography.pxToRem(72),
  color: theme.palette.text.secondary,
  gap: theme.spacing(0.25),
}));

/** Video-track label taller than the base label with a bottom divider. @const VideoTrackLabel */
export const VideoTrackLabel = styled(TrackLabel)(({ theme }) => ({
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** Audio-track label taller than the base label. @const AudioTrackLabel */
export const AudioTrackLabel = styled(TrackLabel)(({ theme }) => ({
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT),
}));

/** Toolbar row under the timeline: labels panel plus scrollable viewport. @const TrackRow */
export const TrackRow = styled(Box)({
  display: 'flex',
});

/** Empty spacer matching the ruler height inside the labels panel. @const RulerSpacer */
export const RulerSpacer = styled(Box)(({ theme }) => ({
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.RULER_HEIGHT),
}));

/** Icon centered inside a track label. @const TrackIconBox */
export const TrackIconBox = styled(Box)({
  display: 'flex',
  alignItems: 'center',
});

/** Loading skeleton inset to the track content area. @const TrackSkeleton */
export const TrackSkeleton = styled(Skeleton)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(2),
  bottom: theme.typography.pxToRem(2),
  left: 0,
  right: 0,
  borderRadius: theme.shape.borderRadius,
}));

/** Centered grip icon revealed on hover over the kept region. @const MoveIndicator */
export const MoveIndicator = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  transition: 'opacity 120ms ease',
  pointerEvents: 'none',
  backgroundColor: OVERLAY_COLORS.black45,
  color: OVERLAY_COLORS.white,
  borderRadius: '6px',
  padding: '6px',
});

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
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.RULER_HEIGHT),
  backgroundColor: theme.palette.mode === 'light' ? TIMELINE_COLORS.labelPanelBackgroundLight : TIMELINE_COLORS.labelPanelBackgroundDark,
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

export const RulerTick = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  width: theme.typography.pxToRem(1),
  height: theme.typography.pxToRem(10),
  backgroundColor: theme.palette.text.secondary,
  pointerEvents: 'none',
}));

export const RulerMinorTick = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  width: theme.typography.pxToRem(1),
  height: theme.typography.pxToRem(5),
  backgroundColor: alpha(theme.palette.text.secondary, 0.5),
  pointerEvents: 'none',
}));

export const RulerLabel = styled(Typography)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(12),
  transform: `translateX(${theme.typography.pxToRem(3)})`,
  fontSize: theme.typography.pxToRem(10),
  lineHeight: 1.2,
  color: theme.palette.text.secondary,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
}));

export const MarkerBubble = styled(Box)(({ theme }) => {
  const bg = theme.palette.mode === 'light' ? OVERLAY_COLORS.black66 : TIMELINE_COLORS.markerBubbleBackgroundDark;
  return {
    position: 'absolute',
    bottom: theme.typography.pxToRem(-3),
    transform: 'translateX(-50%)',
    backgroundColor: bg,
    color: OVERLAY_COLORS.white,
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
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT),
}));

export const ClipTrack = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(12),
  bottom: theme.typography.pxToRem(12),
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
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  zIndex: 0,
  pointerEvents: 'none',
}));

export const AudioTrack = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$width',
})<{ $width: number }>(({ theme, $width }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT),
  left: 0,
  width: $width,
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT),
  background: TIMELINE_COLORS.audioTrack,
  zIndex: 0,
  pointerEvents: 'none',
}));

export const ThumbCell = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
  bottom: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
  backgroundRepeat: 'no-repeat',
}));

export const WaveformBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  backgroundColor: theme.palette.primary.main,
  borderRadius: theme.typography.pxToRem(999),
  opacity: 0.75,
}));

export const KeptRegion = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
  bottom: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
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

export const DimmedRegion = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
  bottom: theme.typography.pxToRem(TIMELINE_LAYOUT.TRACK_CONTENT_TOP),
  zIndex: 1,
  pointerEvents: 'none',
}));

export const TrimHandle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(6),
  bottom: theme.typography.pxToRem(6),
  width: theme.typography.pxToRem(10),
  transform: 'translateX(-50%)',
  cursor: 'ew-resize',
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.info.main,
  border: `${theme.typography.pxToRem(1)} solid ${OVERLAY_COLORS.white85}`,
  borderRadius: theme.typography.pxToRem(2),
  boxShadow: `0 0 ${theme.typography.pxToRem(4)} ${OVERLAY_COLORS.black45}`,
  '&::before': {
    content: '""',
    width: theme.typography.pxToRem(2),
    height: theme.typography.pxToRem(20),
    backgroundColor: OVERLAY_COLORS.white90,
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

export const ScrollShadowAnchor = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: theme.typography.pxToRem(TIMELINE_LAYOUT.RULER_HEIGHT + TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT),
  pointerEvents: 'none',
  zIndex: 2,
}));

export const ScrollShadow = styled(Box)(({ theme }) => {
  const light = theme.palette.mode === 'light';
  return {
    position: 'sticky',
    left: 0,
    top: 0,
    width: theme.typography.pxToRem(24),
    height: '100%',
    background: light
      ? `linear-gradient(to right, ${OVERLAY_COLORS.black20}, ${OVERLAY_COLORS.black0})`
      : `linear-gradient(to right, ${OVERLAY_COLORS.black70}, ${OVERLAY_COLORS.black0})`,
    borderLeft: `${theme.typography.pxToRem(1)} solid ${light ? OVERLAY_COLORS.black25 : OVERLAY_COLORS.white30}`,
  };
});

export const TrackInfoBubble = styled(Box)(({ theme }) => {
  const bg = theme.palette.mode === 'light' ? OVERLAY_COLORS.black66 : TIMELINE_COLORS.trackInfoBubbleBackgroundDark;
  return {
    position: 'sticky',
    top: 0,
    left: 0,
    width: 'max-content',
    maxWidth: `min(60vw, ${theme.typography.pxToRem(480)})`,
    backgroundColor: bg,
    color: OVERLAY_COLORS.white,
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
  width: theme.typography.pxToRem(2),
  transform: 'translateX(-50%)',
  backgroundColor: theme.palette.error.main,
  zIndex: 4,
  cursor: 'ew-resize',
}));

export const PlayheadHead = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: theme.typography.pxToRem(-4),
  width: 0,
  height: 0,
  borderLeft: `${theme.typography.pxToRem(5)} solid transparent`,
  borderRight: `${theme.typography.pxToRem(5)} solid transparent`,
  borderBottom: `${theme.typography.pxToRem(8)} solid ${theme.palette.error.main}`,
  pointerEvents: 'none',
}));
