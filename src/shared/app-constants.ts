/**
 * @fileoverview Application-level constants for window sizing, navigation, and UI shell.
 * Values shared between the main and renderer processes: the Vite dev server URL,
 * main/splash window dimensions, exit codes, theming, and the top-level nav items.
 */

/**
 * Width of the persistent left navigation drawer in pixels.
 * @const {number} DRAWER_WIDTH
 */
export const DRAWER_WIDTH = 220;

/**
 * Width of the persistent navigation drawer when condensed to an icon-only
 * sidebar in pixels.
 * @const {number} DRAWER_WIDTH_CONDENSED
 */
export const DRAWER_WIDTH_CONDENSED = 72;

/**
 * Height of the bottom footer bars. Shared by the main layout footer and the
 * navigation drawer footer so their heights stay in sync.
 * @const {number} FOOTER_HEIGHT
 */
export const FOOTER_HEIGHT = 52;

/**
 * URL of the Vite development server loaded while running in development mode.
 * @const {string} DEV_SERVER_URL
 */
export const DEV_SERVER_URL = 'http://localhost:5173';

/**
 * Main application window size and minimum size constraints.
 * @const {Object} WINDOW_SIZE
 * @property {number} WIDTH - Default window width in pixels.
 * @property {number} HEIGHT - Default window height in pixels.
 * @property {number} MIN_WIDTH - Minimum width the window can be resized to, in pixels.
 * @property {number} MIN_HEIGHT - Minimum height the window can be resized to, in pixels.
 */
export const WINDOW_SIZE = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 960,
  MIN_HEIGHT: 600,
} as const;

/**
 * Splash screen window size shown while the app boots.
 * @const {Object} SPLASH_SIZE
 * @property {number} WIDTH - Splash window width in pixels.
 * @property {number} HEIGHT - Splash window height in pixels.
 */
export const SPLASH_SIZE = {
  WIDTH: 1000,
  HEIGHT: 322,
} as const;

/**
 * Path to the splash screen image, relative to the packaged resources directory.
 * @const {string} SPLASH_IMAGE
 */
export const SPLASH_IMAGE = 'assets/banner.png';

/**
 * Path to the splash screen HTML page that renders {@link SPLASH_IMAGE},
 * relative to the packaged resources directory.
 * @const {string} SPLASH_HTML
 */
export const SPLASH_HTML = 'assets/splash.html';

/**
 * Background color behind the splash image while the window is loading.
 * @const {string} SPLASH_BACKGROUND
 */
export const SPLASH_BACKGROUND = '#EEF4F4';

/**
 * Path to the application icon, relative to the packaged resources directory.
 * Used for the window icon on Windows/Linux and as the source icon for
 * packaged builds.
 * @const {string} APP_ICON
 */
export const APP_ICON = 'assets/icons/icon.ico';

/**
 * Human-readable application name used in window titles and UI text.
 * @const {string} APP_NAME
 */
export const APP_NAME = 'EncodeX';

/**
 * Unique application user model ID used by Windows to identify the app in the
 * taskbar and notification area. Must match the {@link BUILD_APP_ID} used by
 * electron-builder so Windows caches the correct icon per-app instead of
 * falling back to the default Electron icon.
 * @const {string} APP_USER_MODEL_ID
 */
export const APP_USER_MODEL_ID = 'com.openconverter.app';

/**
 * localStorage key used to persist the user's selected UI theme.
 * @const {string} THEME_STORAGE_KEY
 */
export const THEME_STORAGE_KEY = 'encodex-theme';

/**
 * HTML element id of the root node the React application mounts into.
 * @const {string} ROOT_ELEMENT_ID
 */
export const ROOT_ELEMENT_ID = 'root';

/**
 * Process exit codes returned by the main process.
 * @const {Object} EXIT_CODES
 * @property {number} SUCCESS - Code returned on clean shutdown.
 * @property {number} ERROR - Code returned when the app exits with an error.
 * @property {number} USAGE - CLI exit code for invalid/incomplete arguments.
 * @property {number} CANCELLED - CLI exit code for a user-cancelled conversion.
 * @property {number} NOT_FOUND - CLI exit code when FFmpeg/FFprobe is missing.
 * @property {number} TIMEOUT - CLI exit code when a conversion exceeds its timeout.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2,
  CANCELLED: 3,
  NOT_FOUND: 4,
  TIMEOUT: 5,
} as const;

/**
 * Top-level sidebar navigation items; each entry maps a route path to its display label.
 * @const {readonly {to: string; label: string}[]} NAV_ITEMS
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/convert', label: 'Convert' },
  { to: '/media-info', label: 'Media Info' },
  { to: '/image-compress', label: 'Image' },
  { to: '/audio-extract', label: 'Audio' },
  { to: '/video-cut', label: 'Cut' },
  { to: '/batch', label: 'Batch Queue' },
  { to: '/logs', label: 'Logs' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' },
] as const;
