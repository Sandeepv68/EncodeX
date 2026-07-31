import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Drawer, IconButton, useMediaQuery, useTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { ColorModeProvider } from './ColorModeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import ErrorSnackbar from './components/ErrorSnackbar';
import ToastContainer from './components/ToastContainer';
import Footer from './components/Footer';
import AppDrawer from './components/AppDrawer';
import { useErrorStore } from './stores/errorStore';
import Dashboard from './pages/Dashboard';
import Convert from './pages/Convert';
import MediaInfo from './pages/MediaInfo';
import ImageCompress from './pages/ImageCompress';
import AudioExtract from './pages/AudioExtract';
import VideoCut from './pages/VideoCut';
import BatchQueue from './pages/BatchQueue';
import Logs from './pages/Logs';
import { DRAWER_WIDTH } from '../shared/app-constants';
import { useLogStore } from './stores/logStore';
import { useLanguageDirection } from './useLanguageDirection';

function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currentError, clearError } = useErrorStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useLanguageDirection();

  useEffect(() => {
    const cleanup = window.electronAPI?.onLogMessage((entry) => {
      useLogStore.getState().addEntry(entry);
    });
    return () => cleanup?.();
  }, []);

  const routes: { path: string; element: ReactNode }[] = [
    { path: '/', element: <Dashboard /> },
    { path: '/convert', element: <Convert /> },
    { path: '/media-info', element: <MediaInfo /> },
    { path: '/image-compress', element: <ImageCompress /> },
    { path: '/audio-extract', element: <AudioExtract /> },
    { path: '/video-cut', element: <VideoCut /> },
    { path: '/batch', element: <BatchQueue /> },
    { path: '/logs', element: <Logs /> },
  ];

  const drawerContent = (
    <AppDrawer
      isMobile={isMobile}
      onNavigate={() => {
        setMobileOpen(false);
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              position: 'relative',
              height: '100vh',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box
          component="main"
          sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 }, position: 'relative', display: 'flex', flexDirection: 'column' }}
        >
          {isMobile && (
            <IconButton onClick={() => setMobileOpen(true)} sx={{ mb: 1, color: 'text.secondary', alignSelf: 'flex-start' }}>
              <MenuOpenIcon />
            </IconButton>
          )}
          <ErrorBoundary>
            <Box sx={{ flex: 1 }}>
              <Routes>
                {routes.map(({ path, element }) => (
                  <Route key={path} path={path} element={<ErrorBoundary>{element}</ErrorBoundary>} />
                ))}
              </Routes>
            </Box>
          </ErrorBoundary>
        </Box>
        <Footer />
      </Box>
      <ErrorSnackbar error={currentError} onClose={clearError} />
      <ToastContainer />
    </Box>
  );
}

export default function App() {
  return (
    <ColorModeProvider>
      <CssBaseline />
      <AppLayout />
    </ColorModeProvider>
  );
}
