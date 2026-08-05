import type { ColorMode, ThemeId } from './types';

/**
 * A theme palette definition. Light themes share the same color mode but use
 * different accent colors and subtle background tints.
 */
export interface ThemeDefinition {
  id: ThemeId;
  /** i18n key used to display the theme name in the settings. */
  labelKey: string;
  mode: ColorMode;
  primary: string;
  secondary: string;
  background: {
    default: string;
    paper: string;
    drawer: string;
  };
  text: {
    primary: string;
    secondary: string;
  };
  border: string;
  tint: {
    primary15: string;
    primary25: string;
  };
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'light',
    labelKey: 'settings.themes.light',
    mode: 'light',
    primary: '#0f9b8e',
    secondary: '#0dbfb0',
    background: { default: '#f5f5f5', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#1a1a2e', secondary: '#6b6b80' },
    border: '#e0e0e0',
    tint: { primary15: 'rgba(15,155,142,0.15)', primary25: 'rgba(15,155,142,0.25)' },
  },
  {
    id: 'ocean',
    labelKey: 'settings.themes.ocean',
    mode: 'light',
    primary: '#1976d2',
    secondary: '#42a5f5',
    background: { default: '#f2f6fb', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#10243f', secondary: '#546e7a' },
    border: '#d5e1ef',
    tint: { primary15: 'rgba(25,118,210,0.15)', primary25: 'rgba(25,118,210,0.25)' },
  },
  {
    id: 'sunset',
    labelKey: 'settings.themes.sunset',
    mode: 'light',
    primary: '#e65100',
    secondary: '#fb8c00',
    background: { default: '#fbf6f0', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#3a2416', secondary: '#7a6a5d' },
    border: '#f0e0d0',
    tint: { primary15: 'rgba(230,81,0,0.15)', primary25: 'rgba(230,81,0,0.25)' },
  },
  {
    id: 'forest',
    labelKey: 'settings.themes.forest',
    mode: 'light',
    primary: '#2e7d32',
    secondary: '#66bb6a',
    background: { default: '#f2f7f1', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#16281a', secondary: '#546e57' },
    border: '#d9e6d7',
    tint: { primary15: 'rgba(46,125,50,0.15)', primary25: 'rgba(46,125,50,0.25)' },
  },
  {
    id: 'lavender',
    labelKey: 'settings.themes.lavender',
    mode: 'light',
    primary: '#7b1fa2',
    secondary: '#ab47bc',
    background: { default: '#f7f3fb', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#241338', secondary: '#6b5f7a' },
    border: '#e4d9ef',
    tint: { primary15: 'rgba(123,31,162,0.15)', primary25: 'rgba(123,31,162,0.25)' },
  },
  {
    id: 'rose',
    labelKey: 'settings.themes.rose',
    mode: 'light',
    primary: '#c2185b',
    secondary: '#ec407a',
    background: { default: '#fbf3f6', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#33121f', secondary: '#7d6a72' },
    border: '#f0dbe4',
    tint: { primary15: 'rgba(194,24,91,0.15)', primary25: 'rgba(194,24,91,0.25)' },
  },
  {
    id: 'slate',
    labelKey: 'settings.themes.slate',
    mode: 'light',
    primary: '#455a64',
    secondary: '#78909c',
    background: { default: '#f3f5f6', paper: '#ffffff', drawer: '#ffffff' },
    text: { primary: '#1c2830', secondary: '#60757f' },
    border: '#dbe2e6',
    tint: { primary15: 'rgba(69,90,100,0.15)', primary25: 'rgba(69,90,100,0.25)' },
  },
  {
    id: 'dark',
    labelKey: 'settings.themes.dark',
    mode: 'dark',
    primary: '#0f9b8e',
    secondary: '#0dbfb0',
    background: { default: '#0c0c0c', paper: '#1a1a1a', drawer: '#121212' },
    text: { primary: '#f0f0f0', secondary: '#a8a8a8' },
    border: '#2f2f2f',
    tint: { primary15: 'rgba(15,155,142,0.15)', primary25: 'rgba(15,155,142,0.25)' },
  },
];

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function isThemeId(value: string | null): value is ThemeId {
  return value !== null && THEMES.some((theme) => theme.id === value);
}

/** Semantic colors shared across all themes. */
export const COLORS = {
  info: '#3498db',
  error: '#e74c3c',
  success: '#2ecc71',
  warning: '#f39c12',
  tint: {
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
  alert: {
    info: '#0288d1',
    warning: '#ed6c02',
  },
} as const;

export const SHADOWS = {
  SOFT_LIGHT: '0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.05)',
  SOFT_DARK: '0 1px 2px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)',
  SOFT_HOVER_LIGHT: '0 2px 4px rgba(0, 0, 0, 0.05), 0 6px 18px rgba(0, 0, 0, 0.08)',
  SOFT_HOVER_DARK: '0 2px 4px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(0, 0, 0, 0.2)',
} as const;
