import { styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TITLEBAR_COLORS, OVERLAY_COLORS } from '../colors';

const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export const TitleBarRoot = styled(Box)(({ theme }) => ({
  ...dragRegion,
  height: theme.typography.pxToRem(36),
  minHeight: theme.typography.pxToRem(36),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  userSelect: 'none',
  WebkitUserSelect: 'none',
}));

export const TitleBarBrand = styled(Box)({
  ...dragRegion,
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
});

export const TitleBarIcon = styled('img')(({ theme }) => ({
  display: 'block',
  width: theme.typography.pxToRem(20),
  height: theme.typography.pxToRem(20),
  marginLeft: theme.spacing(1.5),
  marginRight: theme.spacing(1),
  borderRadius: theme.typography.pxToRem(4),
  filter: `drop-shadow(0 ${theme.typography.pxToRem(1)} ${theme.typography.pxToRem(2)} ${OVERLAY_COLORS.black25})`,
  flexShrink: 0,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  pointerEvents: 'none',
}));

export const TitleBarTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
  lineHeight: 1,
  letterSpacing: theme.typography.pxToRem(0.2),
}));

export const WindowControls = styled(Box)({
  ...noDragRegion,
  display: 'flex',
  alignItems: 'center',
  height: '100%',
});

export const WindowControlButton = styled(IconButton)(({ theme }) => ({
  width: theme.typography.pxToRem(46),
  height: '100%',
  borderRadius: 0,
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
}));

export const WindowCloseButton = styled(WindowControlButton)(({ theme }) => ({
  '&:hover': {
    backgroundColor: TITLEBAR_COLORS.closeBackground,
    color: theme.palette.error.contrastText,
  },
}));

export const WindowControlIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
}));
