import type { ReactNode } from 'react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useMediaQuery, useTheme, CircularProgress } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { ColorModeProvider } from './ColorModeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import ErrorSnackbar from './components/ErrorSnackbar';
import ToastContainer from './components/ToastContainer';
import Footer from './components/Footer';
import AppDrawer from './components/AppDrawer';
import TitleBar from './components/TitleBar';
import { useErrorStore } from './stores/errorStore';
import { useLogStore } from './stores/logStore';
import { useLanguageDirection } from './useLanguageDirection';
import {
  AppRoot,
  AppBody,
  TemporaryDrawer,
  PermanentDrawer,
  ColumnLayout,
  MainContent,
  MobileMenuButton,
  RouteContent,
  PageFallback,
} from './styles/App.styles';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Convert = lazy(() => import('./pages/Convert'));
const MediaInfo = lazy(() => import('./pages/MediaInfo'));
const ImageCompress = lazy(() => import('./pages/ImageCompress'));
const AudioExtract = lazy(() => import('./pages/AudioExtract'));
const VideoCut = lazy(() => import('./pages/VideoCut'));
const BatchQueue = lazy(() => import('./pages/BatchQueue'));
const Logs = lazy(() => import('./pages/Logs'));
const Settings = lazy(() => import('./pages/Settings'));

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
    { path: '/settings', element: <Settings /> },
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
    <AppRoot>
      <TitleBar />
      <AppBody>
        {isMobile ? (
          <TemporaryDrawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}>
            {drawerContent}
          </TemporaryDrawer>
        ) : (
          <PermanentDrawer variant="permanent">{drawerContent}</PermanentDrawer>
        )}
        <ColumnLayout>
          <MainContent>
            {isMobile && (
              <MobileMenuButton onClick={() => setMobileOpen(true)}>
                <FontAwesomeIcon icon={faBars} />
              </MobileMenuButton>
            )}
            <ErrorBoundary>
              <RouteContent>
                <Suspense
                  fallback={
                    <PageFallback>
                      <CircularProgress />
                    </PageFallback>
                  }
                >
                  <Routes>
                    {routes.map(({ path, element }) => (
                      <Route key={path} path={path} element={<ErrorBoundary>{element}</ErrorBoundary>} />
                    ))}
                  </Routes>
                </Suspense>
              </RouteContent>
            </ErrorBoundary>
          </MainContent>
          <Footer />
        </ColumnLayout>
      </AppBody>
      <ErrorSnackbar error={currentError} onClose={clearError} />
      <ToastContainer />
    </AppRoot>
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
