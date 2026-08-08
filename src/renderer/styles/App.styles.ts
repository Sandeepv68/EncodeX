import { styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Drawer, IconButton } from '@mui/material';
import { DRAWER_WIDTH } from '../../shared/app-constants';

export const AppRoot = styled(Box)({ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' });

export const AppBody = styled(Box)({ display: 'flex', flex: 1, minHeight: 0 });

const drawerSlideIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(-24)}); }
  to { opacity: 1; transform: translateX(0); }
`;

export const TemporaryDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': { width: theme.typography.pxToRem(DRAWER_WIDTH), boxSizing: 'border-box' },
}));

export const PermanentDrawer = styled(Drawer)(({ theme }) => ({
  width: theme.typography.pxToRem(DRAWER_WIDTH),
  flexShrink: 0,
  height: '100%',
  '& .MuiDrawer-paper': {
    width: theme.typography.pxToRem(DRAWER_WIDTH),
    boxSizing: 'border-box',
    position: 'relative',
    height: '100%',
    animation: `${drawerSlideIn(theme)} 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
}));

export const ColumnLayout = styled(Box)({ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 });

export const MainContent = styled('main')(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) },
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  marginBottom: theme.spacing(2),
}));

export const MobileMenuButton = styled(IconButton)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  color: theme.palette.text.secondary,
  alignSelf: 'flex-start',
}));

export const RouteContent = styled(Box)({ flex: 1, minHeight: 0 });

export const PageFallback = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: theme.typography.pxToRem(200),
}));
