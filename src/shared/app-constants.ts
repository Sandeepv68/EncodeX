export const DRAWER_WIDTH = 220;

export const DEV_SERVER_URL = 'http://localhost:5173';

export const WINDOW_SIZE = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 960,
  MIN_HEIGHT: 600,
} as const;

export const SPLASH_SIZE = {
  WIDTH: 600,
  HEIGHT: 600,
} as const;

export const SPLASH_IMAGE = 'assets/splash_screen.png';

export const SPLASH_BACKGROUND = '#EEF4F4';

export const APP_NAME = 'EncodeX';

export const THEME_STORAGE_KEY = 'encodex-theme';

export const ROOT_ELEMENT_ID = 'root';

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
} as const;

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
] as const;
