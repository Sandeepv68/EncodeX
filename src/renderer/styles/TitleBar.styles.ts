import { styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

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

export const TitleBarTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.secondary,
  paddingLeft: theme.spacing(2),
  fontSize: theme.typography.pxToRem(13),
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
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
}));

export const WindowControlIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
}));
