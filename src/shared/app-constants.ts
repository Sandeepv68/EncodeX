export const DRAWER_WIDTH = 220;

export const DEV_SERVER_URL = 'http://localhost:5173';

export const WINDOW_SIZE = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 960,
  MIN_HEIGHT: 600,
} as const;

export const APP_NAME = 'EncodeX';

export const THEME_STORAGE_KEY = 'openconverter-theme';

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
] as const;
