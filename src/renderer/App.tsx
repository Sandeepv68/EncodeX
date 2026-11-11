/**
 * @fileoverview Root application component and routing setup.
 *
 * Defines the top-level `App` component that wraps the whole UI in the color
 * mode context (see ColorModeContext.tsx) and the MUI `CssBaseline` reset. The
 * main layout lives in `AppLayout`, which wires up responsive navigation
 * (temporary drawer on mobile, permanent drawer on desktop), loads every
 * feature page as its own chunk, and renders the route table. Each lazy page is
 * wrapped in its own `ErrorBoundary` so a crash in one feature never tears
 * down the rest of the shell. While a page's chunk is in flight, the route
 * shows that page's own loading state: Dashboard keeps the startup spinner
 * while every other page renders a layout-matched skeleton.
 *
 * The skeletons are rendered by {@link RouteLoader} rather than by a
 * `Suspense` fallback: React keeps the previous page on screen while a
 * transition is pending and never paints a fallback in that case, which is
 * why the per-page skeletons used to be invisible.
 *
 * Side effects performed once at mount:
 *  - Subscribes to renderer log messages forwarded from the main process via
 *    `window.electronAPI.onLogMessage` and appends them to the log store.
 *  - Applies the persisted "always on top" window setting to the native window.
 */

import type { ComponentType, ReactNode } from 'react';
import { useState, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMediaQuery, useTheme, CircularProgress } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { ColorModeProvider, useColorMode } from './ColorModeContext';
import { NavigationGuardProvider, useNavigationGuard } from './NavigationGuardContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  AboutSkeleton,
  AudioExtractSkeleton,
  BatchQueueSkeleton,
  ConvertSkeleton,
  CopilotSkeleton,
  DemuxSkeleton,
  ImageCompressSkeleton,
  LogsSkeleton,
  MediaInfoSkeleton,
  RemuxSkeleton,
  SettingsSkeleton,
  VideoCutSkeleton,
} from './components/PageSkeletons';
import ErrorSnackbar from './components/ErrorSnackbar';
import ToastContainer from './components/ToastContainer';
import MuxQueueSync from './components/MuxQueueSync';
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
import { THEMES } from '../shared/theme/colors';
import { useErrorStore } from './stores/errorStore';
import { useLogStore } from './stores/logStore';
import { useAuditStore } from './stores/auditStore';
import { useSettingsStore } from './stores/settingsStore';
import type { PageLoader, RouteLoaderProps } from './types';
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

/** Loads the Dashboard page chunk (the '/' route). @const {PageLoader} */
const loadDashboard: PageLoader = () => import('./pages/Dashboard');
/** Loads the Convert page chunk (the '/convert' route). @const {PageLoader} */
const loadConvert: PageLoader = () => import('./pages/Convert');
/** Loads the MediaInfo page chunk (the '/media-info' route). @const {PageLoader} */
const loadMediaInfo: PageLoader = () => import('./pages/MediaInfo');
/** Loads the ImageCompress page chunk (the '/image-compress' route). @const {PageLoader} */
const loadImageCompress: PageLoader = () => import('./pages/ImageCompress');
/** Loads the AudioExtract page chunk (the '/audio-extract' route). @const {PageLoader} */
const loadAudioExtract: PageLoader = () => import('./pages/AudioExtract');
/** Loads the VideoCut page chunk (the '/video-cut' route). @const {PageLoader} */
const loadVideoCut: PageLoader = () => import('./pages/VideoCut');
/** Loads the Remux page chunk (the '/remux' route). @const {PageLoader} */
const loadRemux: PageLoader = () => import('./pages/Remux');
/** Loads the Demux page chunk (the '/demux' route). @const {PageLoader} */
const loadDemux: PageLoader = () => import('./pages/Demux');
/** Loads the BatchQueue page chunk (the '/batch' route). @const {PageLoader} */
const loadBatchQueue: PageLoader = () => import('./pages/BatchQueue');
/** Loads the Copilot page chunk (the '/copilot' route). @const {PageLoader} */
const loadCopilot: PageLoader = () => import('./pages/Copilot');
/** Loads the Logs page chunk (the '/logs' route). @const {PageLoader} */
const loadLogs: PageLoader = () => import('./pages/Logs');
/** Loads the Settings page chunk (the '/settings' route). @const {PageLoader} */
const loadSettings: PageLoader = () => import('./pages/Settings');
/** Loads the About page chunk (the '/about' route). @const {PageLoader} */
const loadAbout: PageLoader = () => import('./pages/About');

/**
 * Minimum time a page skeleton stays on screen.
 *
 * A page chunk is a local file, so it resolves in a few milliseconds. A
 * skeleton that only lives that long reads as a one-frame glitch rather than
 * as a loading state, so the chunk is held back for this long the first time
 * a page is opened. Once the page is loaded, it renders synchronously and no
 * skeleton is shown at all - reopening a page is instant.
 * @const {number}
 */
const MIN_SKELETON_MS = 200;

/**
 * Page components that finished loading, keyed by their loader.
 *
 * The bundler caches the module itself, but the component is kept here too so
 * a route that is opened a second time renders it synchronously: no skeleton,
 * no delay, exactly like a statically imported page.
 * @const {Map<PageLoader, React.ComponentType>}
 */
const loadedPages = new Map<PageLoader, ComponentType>();

/**
 * Renders a page once its chunk has loaded, showing the page's own skeleton
 * in the meantime.
 *
 * The skeleton is rendered by this component rather than by a `Suspense`
 * fallback on purpose: React keeps the previous page on screen while a
 * transition is pending and never paints a fallback in that case, which is
 * exactly why the per-page skeletons used to be invisible. Rendering the
 * skeleton here makes it part of the route's own tree, so it is painted
 * whenever the route is.
 *
 * The router reuses the route element when it swaps routes, so the loaded
 * component is only used while it belongs to the current loader - otherwise
 * the page of the previous route would stay on screen.
 *
 * A failed load is re-thrown during render so the route's `ErrorBoundary`
 * reports it like any other page crash.
 * @param {RouteLoaderProps} props - Component props.
 * @returns {JSX.Element} The skeleton or the loaded page.
 */
export function RouteLoader({ load, skeleton, minVisibleMs = MIN_SKELETON_MS }: RouteLoaderProps) {
  const [, forceUpdate] = useReducer((tick: number) => tick + 1, 0);
  const [failures, setFailures] = useState<Map<PageLoader, { error: unknown }>>(() => new Map());
  const Page = loadedPages.get(load);

  useEffect(() => {
    if (Page) return undefined;
    let cancelled = false;
    const startedAt = Date.now();
    void load()
      .then((module) => {
        // The module is cached even when the route changed in the meantime: a
        // page that was visited while the user moved on must not have to load
        // its chunk again on the next visit.
        loadedPages.set(load, module.default);
        if (cancelled) return;
        const remaining = Math.max(0, minVisibleMs - (Date.now() - startedAt));
        const show = (): void => {
          if (cancelled) return;
          forceUpdate();
        };
        if (remaining > 0) {
          setTimeout(show, remaining);
        } else {
          show();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailures((previous) => new Map(previous).set(load, { error: err }));
      });
    return () => {
      cancelled = true;
    };
  }, [load, Page, minVisibleMs]);

  const failure = failures.get(load);
  if (failure !== undefined) throw failure.error;
  if (!Page) return <>{skeleton}</>;
  return <Page />;
}

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
 *  `ErrorBoundary` and its own `Suspense` fallback. It also
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
  const { t } = useTranslation();
  const { currentError, clearError } = useErrorStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { drawerCondensed, setDrawerCondensed } = useSettingsStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const { navigate } = useNavigationGuard();
  const { themeId, setTheme } = useColorMode();
  const location = useLocation();
  const mainContentRef = useRef<HTMLElement>(null);

  useLanguageDirection();
  useDevScreenshot();

  useLayoutEffect(() => {
    // A layout effect runs after the DOM is committed, so the ref is attached
    // by the time the body executes; the assertion only tells TypeScript what
    // is already true.
    const mainContent = mainContentRef.current!;
    mainContent.scrollTop = 0;
    mainContent.scrollLeft = 0;
  }, [location.pathname]);

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
    let cleanup: (() => void) | undefined;
    // Same guarded pattern as the log subscription above: audit records are a
    // fire-and-forget push, and a synchronous contextBridge throw must not take
    // the tree down.
    callBridgeVoid(() => {
      cleanup = window.electronAPI?.onAuditEntry((entry) => {
        useAuditStore.getState().addEntry(entry);
      });
    }, 'onAuditEntry subscription');
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
   * Route table mapping URL paths to their page elements. Every page is loaded
   * as its own chunk and shows its own skeleton until that chunk arrives (see
   * {@link RouteLoader}). Keys mirror the path definitions used by AppDrawer
   * and pageIcons.tsx.
   * @const {Array<{path: string, element: ReactNode}>}
   */
  const routes: { path: string; element: ReactNode }[] = [
    {
      path: '/',
      element: (
        <RouteLoader
          load={loadDashboard}
          skeleton={
            <PageFallback>
              <CircularProgress aria-label={t('app.loading')} />
            </PageFallback>
          }
          minVisibleMs={0}
        />
      ),
    },
    { path: '/convert', element: <RouteLoader load={loadConvert} skeleton={<ConvertSkeleton />} /> },
    { path: '/media-info', element: <RouteLoader load={loadMediaInfo} skeleton={<MediaInfoSkeleton />} /> },
    { path: '/image-compress', element: <RouteLoader load={loadImageCompress} skeleton={<ImageCompressSkeleton />} /> },
    { path: '/audio-extract', element: <RouteLoader load={loadAudioExtract} skeleton={<AudioExtractSkeleton />} /> },
    { path: '/video-cut', element: <RouteLoader load={loadVideoCut} skeleton={<VideoCutSkeleton />} /> },
    { path: '/remux', element: <RouteLoader load={loadRemux} skeleton={<RemuxSkeleton />} /> },
    { path: '/demux', element: <RouteLoader load={loadDemux} skeleton={<DemuxSkeleton />} /> },
    { path: '/batch', element: <RouteLoader load={loadBatchQueue} skeleton={<BatchQueueSkeleton />} /> },
    { path: '/copilot', element: <RouteLoader load={loadCopilot} skeleton={<CopilotSkeleton />} /> },
    { path: '/logs', element: <RouteLoader load={loadLogs} skeleton={<LogsSkeleton />} /> },
    { path: '/settings', element: <RouteLoader load={loadSettings} skeleton={<SettingsSkeleton />} /> },
    { path: '/about', element: <RouteLoader load={loadAbout} skeleton={<AboutSkeleton />} /> },
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
          <MainContent ref={mainContentRef} $flush={location.pathname === '/copilot'}>
            {isMobile && (
              <MobileMenuButton onClick={() => setMobileOpen(true)} aria-label={t('app.menu')} data-testid="mobile-menu-button">
                <FontAwesomeIcon icon={faBars} />
              </MobileMenuButton>
            )}
            <ErrorBoundary>
              <RouteContent>
                <Routes>
                  {routes.map(({ path, element }) => (
                    <Route key={path} path={path} element={<ErrorBoundary>{element}</ErrorBoundary>} />
                  ))}
                </Routes>
              </RouteContent>
            </ErrorBoundary>
          </MainContent>
          <Footer />
        </ColumnLayout>
      </AppBody>
      <ErrorSnackbar error={currentError} onClose={clearError} />
      <ToastContainer />
      <MuxQueueSync />
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
      <NavigationGuardProvider>
        <AppLayout />
      </NavigationGuardProvider>
    </ColorModeProvider>
  );
}
