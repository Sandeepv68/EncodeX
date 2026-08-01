export const COLORS = {
  primary: '#0f9b8e',
  secondary: '#0dbfb0',
  info: '#3498db',
  error: '#e74c3c',
  success: '#2ecc71',
  warning: '#f39c12',
  background: {
    light: '#f5f5f5',
    lightPaper: '#ffffff',
    dark: '#1a1a2e',
    darkPaper: '#1e2a4a',
    drawerDark: '#16213e',
  },
  text: {
    lightPrimary: '#1a1a2e',
    lightSecondary: '#6b6b80',
    darkPrimary: '#e8e8e8',
    darkSecondary: '#a0a0b0',
  },
  border: {
    light: '#e0e0e0',
    dark: '#2a3a5a',
  },
  tint: {
    primary15: 'rgba(15,155,142,0.15)',
    primary25: 'rgba(15,155,142,0.25)',
    error10: 'rgba(231,76,60,0.1)',
    warning10: 'rgba(243,156,18,0.1)',
    info10: 'rgba(52,152,219,0.1)',
  },
  log: {
    background: '#1e1e1e',
    text: '#d4d4d4',
    muted: '#888888',
    debug: '#9e9e9e',
    info: '#4fc3f7',
    warn: '#ffa726',
    error: '#ef5350',
  },
  player: {
    background: '#000000',
    control: '#ffffff',
  },
} as const;

export const SHADOWS = {
  SOFT_LIGHT: '0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.05)',
  SOFT_DARK: '0 1px 2px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)',
  SOFT_HOVER_LIGHT: '0 2px 4px rgba(0, 0, 0, 0.05), 0 6px 18px rgba(0, 0, 0, 0.08)',
  SOFT_HOVER_DARK: '0 2px 4px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(0, 0, 0, 0.2)',
} as const;
