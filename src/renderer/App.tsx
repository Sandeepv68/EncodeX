/**
 * @fileoverview Root application component and routing setup.
 *
 * Defines the top-level `App` component that wraps the whole UI in the color
 * mode context (see ColorModeContext.tsx) and the MUI `CssBaseline` reset. The
 * main layout lives in `AppLayout`, which wires up responsive navigation
 * (temporary drawer on mobile, permanent drawer on desktop), lazy-loads every
 * feature page, and renders the route table. Each lazy page is wrapped in its
 * own `ErrorBoundary` so a crash in one feature never tears down the rest of
 * the shell, and a shared `Suspense` shows a spinner while a page chunk is
 * being fetched.
 *
 * Side effects performed once at mount:
 *  - Subscribes to renderer log messages forwarded from the main process via
 *    `window.electronAPI.onLogMessage` and appends them to the log store.
 *  - Applies the persisted "always on top" window setting to the native window.
 */

import type { ReactNode } from 'react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useMediaQuery, useTheme, CircularProgress } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { ColorModeProvider, useColorMode } from './ColorModeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import ErrorSnackbar from './components/ErrorSnackbar';
import ToastContainer from './components/ToastContainer';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import Footer from './components/Footer';
import AppDrawer from './components/AppDrawer';
import TitleBar from './components/TitleBar';
import ShortcutsHelpDialog from './components/ShortcutsHelpDialog';
import UpdateDialog from './components/UpdateDialog';
import TermsDialog from './components/TermsDialog';
import { useHotkeys } from './hooks/useHotkeys';
import { useDevScreenshot } from './dev/useDevScreenshot';
import { SHORTCUTS } from './constants/shortcuts';
import { THEMES } from './colors';
import { useErrorStore } from './stores/errorStore';
import { useLogStore } from './stores/logStore';
import { useSettingsStore } from './stores/settingsStore';
import { callBridgeVoid, fireAndForgetBridge } from './utils/bridge-call';
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

/** Lazy-loaded Dashboard page, loaded on the '/' route. @const {React.ComponentType} */
/** Lazy-loaded Dashboard page, loaded on the '/' route. @const {React.ComponentType} */
const Dashboard = lazy(() => import('./pages/Dashboard'));
/** Lazy-loaded Convert page, loaded on the '/convert' route. @const {React.ComponentType} */
const Convert = lazy(() => import('./pages/Convert'));
/** Lazy-loaded MediaInfo page, loaded on the '/media-info' route. @const {React.ComponentType} */
const MediaInfo = lazy(() => import('./pages/MediaInfo'));
/** Lazy-loaded ImageCompress page, loaded on the '/image-compress' route. @const {React.ComponentType} */
const ImageCompress = lazy(() => import('./pages/ImageCompress'));
/** Lazy-loaded AudioExtract page, loaded on the '/audio-extract' route. @const {React.ComponentType} */
const AudioExtract = lazy(() => import('./pages/AudioExtract'));
/** Lazy-loaded VideoCut page, loaded on the '/video-cut' route. @const {React.ComponentType} */
const VideoCut = lazy(() => import('./pages/VideoCut'));
/** Lazy-loaded Remux page, loaded on the '/remux' route. @const {React.ComponentType} */
const Remux = lazy(() => import('./pages/Remux'));
/** Lazy-loaded Demux page, loaded on the '/demux' route. @const {React.ComponentType} */
const Demux = lazy(() => import('./pages/Demux'));
/** Lazy-loaded BatchQueue page, loaded on the '/batch' route. @const {React.ComponentType} */
const BatchQueue = lazy(() => import('./pages/BatchQueue'));
/** Lazy-loaded Logs page, loaded on the '/logs' route. @const {React.ComponentType} */
const Logs = lazy(() => import('./pages/Logs'));
/** Lazy-loaded Settings page, loaded on the '/settings' route. @const {React.ComponentType} */
const Settings = lazy(() => import('./pages/Settings'));
/** Lazy-loaded About page, loaded on the '/about' route. @const {React.ComponentType} */
const About = lazy(() => import('./pages/About'));

/**
 * Main application shell rendered inside the ColorModeProvider.
 *
 * Builds the responsive page chrome: a native-style `TitleBar` on top, a
 * navigation drawer on the side (a temporary/overlay drawer below the `md`
 * breakpoint, a permanent drawer at `md` and above), and a `MainContent` area
 * holding the routed pages plus the `Footer`. The mobile menu button (hamburger)
 * toggles the temporary drawer on small screens. The permanent drawer opens in
 * the layout the user last chose (condensed, icon-only, by default and
 * persisted to localStorage); the temporary drawer always renders expanded, as
 * it has no condense toggle of its own.
 *
 * Renders the route table for every feature page, each wrapped in an
 *  `ErrorBoundary` and collectively in a `Suspense` fallback spinner. It also
 *  hosts the global `ErrorSnackbar`, `ToastContainer`, and `CloseConfirmDialog`
 *  so error/toast notifications and the close-with-active-jobs confirmation
 *  are shown above all routes.
 *
 * On mount it subscribes to log entries pushed from the main process and
 * applies the persisted always-on-top and launch-at-login window flags.
 *
 * @returns {React.JSX.Element} The full application shell with title bar,
 *   drawer navigation, routed content, footer, and global overlays.
 */
function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currentError, clearError } = useErrorStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { drawerCondensed, setDrawerCondensed } = useSettingsStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { themeId, setTheme } = useColorMode();

  useLanguageDirection();
  useDevScreenshot();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    // Guarded for the same reason as the mount effect below: this is fire-and-forget, and a
    // synchronous throw from `contextBridge` would otherwise propagate out of the effect and take the
    // tree down - losing the log stream that would have explained why.
    callBridgeVoid(() => {
      cleanup = window.electronAPI?.onLogMessage((entry) => {
        useLogStore.getState().addEntry(entry);
      });
    }, 'onLogMessage subscription');
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    // Both calls are fire-and-forget `send`s: their results are discarded, and neither has a reply to
    // wait on. Optional chaining covers a missing method but not one that throws, and `contextBridge`
    // propagates a synchronous throw into the caller - so unguarded, a preload that throws here took
    // the entire tree down on first paint with a blank window. `bootstrapRendererMonitoring` is gated
    // the same way, and the two together were the entire Phase 3.4 finding.
    const { alwaysOnTop, launchAtLogin } = useSettingsStore.getState();
    fireAndForgetBridge(() => window.electronAPI?.windowSetAlwaysOnTop(alwaysOnTop), 'windowSetAlwaysOnTop on mount');
    fireAndForgetBridge(() => window.electronAPI?.setLaunchAtLogin(launchAtLogin), 'setLaunchAtLogin on mount');
  }, []);

  /**
   * Global navigation shortcuts (Alt+1..9) derived from the shortcut registry,
   * navigating to each spec's target route and closing the mobile drawer.
   * @const {Array<{id: string; handler: () => void}>}
   */
  const navBindings = SHORTCUTS.filter((spec) => spec.section === 'global' && spec.to).map((spec) => ({
    id: spec.id,
    handler: () => {
      navigate(spec.to!);
      setMobileOpen(false);
    },
  }));

  useHotkeys([
    { id: 'global.help', handler: () => setHelpOpen(true) },
    ...navBindings,
    {
      id: 'global.themeToggle',
      handler: () => {
        const index = THEMES.findIndex((candidate) => candidate.id === themeId);
        setTheme(THEMES[(index + 1) % THEMES.length].id);
      },
    },
  ]);

  /**
   * Route table mapping URL paths to their lazy-loaded page elements.
   * Keys mirror the path definitions used by AppDrawer and pageIcons.tsx.
   * @const {Array<{path: string, element: ReactNode}>}
   */
  const routes: { path: string; element: ReactNode }[] = [
    { path: '/', element: <Dashboard /> },
    { path: '/convert', element: <Convert /> },
    { path: '/media-info', element: <MediaInfo /> },
    { path: '/image-compress', element: <ImageCompress /> },
    { path: '/audio-extract', element: <AudioExtract /> },
    { path: '/video-cut', element: <VideoCut /> },
    { path: '/remux', element: <Remux /> },
    { path: '/demux', element: <Demux /> },
    { path: '/batch', element: <BatchQueue /> },
    { path: '/logs', element: <Logs /> },
    { path: '/settings', element: <Settings /> },
    { path: '/about', element: <About /> },
  ];

  const drawerContent = (
    <AppDrawer
      isMobile={isMobile}
      condensed={isMobile ? false : drawerCondensed}
      onToggleCondense={() => setDrawerCondensed(!drawerCondensed)}
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
          <PermanentDrawer $condensed={drawerCondensed} variant="permanent">
            {drawerContent}
          </PermanentDrawer>
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
      <CloseConfirmDialog />
      <UpdateDialog />
      <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TermsDialog />
    </AppRoot>
  );
}

/**
 * Root component of the renderer.
 *
 * Provides the color mode/theme/direction context via `ColorModeProvider`,
 * applies the MUI `CssBaseline` (global CSS reset and theme-aware background),
 * and mounts the `AppLayout` shell. It takes no props.
 *
 * @returns {React.JSX.Element} The provider-wrapped application layout.
 */
export default function App() {
  return (
    <ColorModeProvider>
      <CssBaseline />
      <AppLayout />
    </ColorModeProvider>
  );
}
