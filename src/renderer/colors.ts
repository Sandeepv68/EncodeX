/**
 * @fileoverview Theme palette definitions and shared color constants.
 *
 * This module is the single source of truth for the color system used by the
 * MUI theme (see theme.ts). It defines:
 *  - `ThemeDefinition`, the shape of one selectable theme palette.
 *  - `THEMES`, the registry of all built-in palettes (light, ocean, sunset,
 *    forest, lavender, rose, slate, dark). Light themes all share the 'light'
 *    color mode but differ in their accent colors, text colors, borders, and
 *    subtle background tints; the 'dark' theme is the sole 'dark' mode entry.
 *  - `getTheme()` / `isThemeId()` helpers to look palettes up by id and to
 *    validate unknown ids (e.g. values read back from localStorage).
 *  - `COLORS`, the semantic colors shared across every theme (info/error/
 *    success/warning, log console colors, video player colors, alert colors).
 *  - `HISTOGRAM_COLORS` / `OVERLAY_COLORS` / `TIMELINE_COLORS` /
 *    `TITLEBAR_COLORS`, the fixed component-level colors that stay identical
 *    across every theme.
 *  - `SHADOWS(theme)`, the shared CSS box-shadow factory for light and dark
 *    surfaces, sized with `theme.typography.pxToRem()`.
 */

import type { ColorMode, ThemeId } from './types';
import type { Theme } from '@mui/material/styles';

/**
 * A theme palette definition. Light themes share the same color mode but use
 * different accent colors and subtle background tints.
 * @interface ThemeDefinition
 * @property {ThemeId} id - Unique identifier of the theme, used in settings
 *   and persisted to localStorage.
 * @property {string} labelKey - i18n key used to display the theme name in the
 *   settings page.
 * @property {ColorMode} mode - Underlying MUI palette mode ('light' | 'dark').
 * @property {string} primary - Primary accent color (hex).
 * @property {string} secondary - Secondary accent color (hex).
 * @property {Object} background - Background color group.
 * @property {string} background.default - Default page background color.
 * @property {string} background.paper - Surface/paper background color.
 * @property {string} background.drawer - Drawer (sidebar) background color.
 * @property {Object} text - Text color group.
 * @property {string} text.primary - Primary text color.
 * @property {string} text.secondary - Secondary/muted text color.
 * @property {string} border - Divider / border color for hairlines and outlines.
 * @property {Object} tint - Translucent primary-color tints used for subtle
 *   highlights and selected states.
 * @property {string} tint.primary15 - Primary color at 15% opacity.
 * @property {string} tint.primary25 - Primary color at 25% opacity.
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

/**
 * Registry of all built-in theme palettes. Seven light themes (light, ocean,
 * sunset, forest, lavender, rose, slate) share the 'light' color mode with
 * distinct accent/border/tint colors, plus one dark theme ('dark').
 * @const {readonly ThemeDefinition[]} THEMES
 */
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

/**
 * Looks up a theme definition by its id.
 * Returns the first palette (the 'light' theme) when no palette matches, so a
 * stale or unknown id never produces undefined.
 * @param {ThemeId} id - The theme id to look up.
 * @returns {ThemeDefinition} The matching theme definition, or the 'light'
 *   theme as a fallback.
 */
export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

/**
 * Type guard that checks whether a value (e.g. a value read from
 * localStorage) is a valid registered theme id.
 * @param {string | null} value - The value to test; null is rejected.
 * @returns {boolean} True when `value` is a string matching a known theme id.
 */
export function isThemeId(value: string | null): value is ThemeId {
  return value !== null && THEMES.some((theme) => theme.id === value);
}

/**
 * Semantic colors shared across all themes. These are fixed brand/status
 * colors (info, error, success, warning), their 10% translucent tints, the
 * log console palette, the video player surface colors, and alert colors.
 * @const {Object} COLORS
 * @property {string} info - Info status color.
 * @property {string} error - Error status color.
 * @property {string} success - Success status color.
 * @property {string} warning - Warning status color.
 * @property {Object} tint - 10% translucent tints for error/warning/info.
 * @property {string} tint.error10 - Error color at 10% opacity.
 * @property {string} tint.warning10 - Warning color at 10% opacity.
 * @property {string} tint.info10 - Info color at 10% opacity.
 * @property {Object} log - Colors for the log console view.
 * @property {string} log.background - Log console background.
 * @property {string} log.text - Default log text color.
 * @property {string} log.muted - Muted log text color.
 * @property {string} log.debug - DEBUG level log color.
 * @property {string} log.info - INFO level log color.
 * @property {string} log.warn - WARN level log color.
 * @property {string} log.error - ERROR level log color.
 * @property {Object} player - Video player surface colors.
 * @property {string} player.background - Player backdrop color.
 * @property {string} player.control - Player control icon color.
 * @property {Object} alert - Material-UI alert palette colors.
 * @property {string} alert.info - Alert info color.
 * @property {string} alert.warning - Alert warning color.
 */
export const COLORS = {
  info: '#3498db',
  error: '#e74c3c',
  success: '#2ecc71',
  warning: '#f39c12',
  tint: {
    error10: 'rgba(231,76,60,0.1)',
    error45: 'rgba(231, 76, 60, 0.45)',
    error0: 'rgba(231, 76, 60, 0)',
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

/**
 * Channel colors for the Red/Green/Blue/Luma histogram charts in the Media Info
 * panel. They are intentionally fixed (material red/green/blue plus a neutral
 * grey for luma) so the charts read the same in every theme.
 * @const {Object} HISTOGRAM_COLORS
 * @property {string} red - Red channel color.
 * @property {string} green - Green channel color.
 * @property {string} blue - Blue channel color.
 * @property {string} luma - Luma channel color.
 */
export const HISTOGRAM_COLORS = {
  red: '#f44336',
  green: '#4caf50',
  blue: '#2196f3',
  luma: '#9e9e9e',
} as const;

/**
 * Translucent black/white overlay colors shared across components that sit on
 * top of media surfaces (timeline bubbles, trim handles, scroll shadows,
 * progress-bar stripes, move indicators). These are fixed so overlays render
 * identically in light and dark themes.
 * @const {Object} OVERLAY_COLORS
 */
export const OVERLAY_COLORS = {
  white: '#ffffff',
  white85: 'rgba(255, 255, 255, 0.85)',
  white90: 'rgba(255, 255, 255, 0.9)',
  white70: 'rgba(255, 255, 255, 0.7)',
  white30: 'rgba(255, 255, 255, 0.3)',
  white18: 'rgba(255, 255, 255, 0.18)',
  white02: 'rgba(255, 255, 255, 0.02)',
  white0: 'rgba(255, 255, 255, 0)',
  black66: 'rgb(0 0 0 / 66%)',
  black70: 'rgba(0, 0, 0, 0.7)',
  black45: 'rgba(0, 0, 0, 0.45)',
  black25: 'rgba(0, 0, 0, 0.25)',
  black20: 'rgb(0 0 0 / 20%)',
  black02: 'rgba(0, 0, 0, 0.02)',
  black0: 'rgba(0, 0, 0, 0)',
} as const;

/**
 * Video-timeline surface colors that don't map to the theme palette. The
 * light/dark background pair is shared by the track label panel and the ruler.
 * @const {Object} TIMELINE_COLORS
 * @property {string} scrollbarThumb - Timeline viewport scrollbar thumb color.
 * @property {string} labelPanelBackgroundLight - Label panel/ruler background (light).
 * @property {string} labelPanelBackgroundDark - Label panel/ruler background (dark).
 * @property {string} audioTrack - Audio track strip background.
 * @property {string} markerBubbleBackgroundDark - Marker bubble background (dark).
 * @property {string} trackInfoBubbleBackgroundDark - Track info bubble background (dark).
 */
export const TIMELINE_COLORS = {
  scrollbarThumb: 'rgba(128, 128, 128, 0.4)',
  labelPanelBackgroundLight: '#fafafa',
  labelPanelBackgroundDark: '#141414',
  audioTrack: '#809dca42',
  markerBubbleBackgroundDark: 'rgba(97, 97, 97, 0.9)',
  trackInfoBubbleBackgroundDark: 'rgba(33, 33, 33, 0.95)',
} as const;

/**
 * Fixed colors for the custom frameless-window title bar (window controls).
 * @const {Object} TITLEBAR_COLORS
 * @property {string} closeBackground - Close button hover background (macOS red).
 */
export const TITLEBAR_COLORS = {
  closeBackground: '#d70000',
} as const;

/**
 * Factory for shared CSS box-shadow strings on elevated surfaces, sized with
 * `theme.typography.pxToRem()` so they scale with the root font size.
 * SOFT_* are used for resting cards and panels, SOFT_HOVER_* for their hover
 * state, and INSET_* for inner recessed surfaces. Light variants target
 * light-mode surfaces, dark variants dark-mode surfaces.
 * @function SHADOWS
 * @param {Theme} theme - The MUI theme used to convert px to rem.
 * @returns {Object} Box-shadow strings keyed by surface variant.
 * @property {string} SOFT_LIGHT - Resting shadow for light surfaces.
 * @property {string} SOFT_DARK - Resting shadow for dark surfaces.
 * @property {string} SOFT_HOVER_LIGHT - Hover shadow for light surfaces.
 * @property {string} SOFT_HOVER_DARK - Hover shadow for dark surfaces.
 * @property {string} INSET_LIGHT - Inner recessed shadow for light surfaces.
 * @property {string} INSET_DARK - Inner recessed shadow for dark surfaces.
 */
export const SHADOWS = (theme: Theme) => ({
  SOFT_LIGHT: `${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(1)} ${theme.typography.pxToRem(2)} rgba(0, 0, 0, 0.04), ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(10)} rgba(0, 0, 0, 0.05)`,
  SOFT_DARK: `${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(1)} ${theme.typography.pxToRem(2)} rgba(0, 0, 0, 0.2), ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(8)} rgba(0, 0, 0, 0.15)`,
  SOFT_HOVER_LIGHT: `${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(4)} rgba(0, 0, 0, 0.05), ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(6)} ${theme.typography.pxToRem(18)} rgba(0, 0, 0, 0.08)`,
  SOFT_HOVER_DARK: `${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(4)} rgba(0, 0, 0, 0.25), ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(14)} rgba(0, 0, 0, 0.2)`,
  INSET_LIGHT: `inset ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(6)} ${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(-2)} rgba(0, 0, 0, 0.1)`,
  INSET_DARK: `inset ${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(6)} ${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(-2)} rgba(0, 0, 0, 0.35)`,
});
