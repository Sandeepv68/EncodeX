import { styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Drawer, IconButton } from '@mui/material';
import { DRAWER_WIDTH, DRAWER_WIDTH_CONDENSED } from '../../shared/app-constants';

export const AppRoot = styled(Box)({ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' });

export const AppBody = styled(Box)({ display: 'flex', flex: 1, minHeight: 0 });

const drawerSlideIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(-24)}); }
  to { opacity: 1; transform: translateX(0); }
`;

export const TemporaryDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': { width: theme.typography.pxToRem(DRAWER_WIDTH), boxSizing: 'border-box' },
}));

export const PermanentDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => {
  const width = $condensed ? DRAWER_WIDTH_CONDENSED : DRAWER_WIDTH;
  return {
    width: theme.typography.pxToRem(width),
    flexShrink: 0,
    height: '100%',
    transition: 'width 0.2s ease',
    '& .MuiDrawer-paper': {
      width: theme.typography.pxToRem(width),
      boxSizing: 'border-box',
      position: 'relative',
      height: '100%',
      transition: 'width 0.2s ease',
      animation: `${drawerSlideIn(theme)} 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
        transition: 'none',
      },
    },
  };
});

export const ColumnLayout = styled(Box)({ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 });

/**
 * Main content area around the routed page. `$flush` removes the bottom padding
 * and gap above the footer so a page (the Copilot) can sit on the footer edge;
 * it then owns its own bottom spacing.
 */
export const MainContent = styled('main', {
  shouldForwardProp: (prop) => prop !== '$flush',
})<{ $flush?: boolean }>(({ theme, $flush }) => ({
  flex: 1,
  overflow: 'auto',
  padding: theme.spacing(2),
  paddingBottom: $flush ? 0 : theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
    paddingBottom: $flush ? 0 : theme.spacing(3),
  },
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  marginBottom: $flush ? 0 : theme.spacing(2),
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
