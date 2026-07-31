import { styled } from '@mui/material/styles';
import { Box, Drawer, IconButton } from '@mui/material';
import { DRAWER_WIDTH } from '../../shared/app-constants';

export const AppRoot = styled(Box)({ display: 'flex', height: '100vh' });

export const TemporaryDrawer = styled(Drawer)({
  '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
});

export const PermanentDrawer = styled(Drawer)({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    position: 'relative',
    height: '100vh',
  },
});

export const ColumnLayout = styled(Box)({ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 });

export const MainContent = styled('main')(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) },
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
}));

export const MobileMenuButton = styled(IconButton)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  color: theme.palette.text.secondary,
  alignSelf: 'flex-start',
}));

export const RouteContent = styled(Box)({ flex: 1 });

export const PageFallback = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
});
