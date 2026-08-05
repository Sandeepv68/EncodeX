/**
 * @fileoverview Type definitions for the renderer application layer.
 * Defines color mode and color mode context value types.
 */

/**
 * Supported UI color modes.
 * @typedef {string} ColorMode
 */
export type ColorMode = 'light' | 'dark';

/**
 * Supported theme palettes. Each theme carries its own accent colors and
 * a light or dark color mode.
 * @typedef {string} ThemeId
 */
export type ThemeId = 'light' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose' | 'slate' | 'dark';

/**
 * Value exposed by the color mode context.
 * @interface ColorModeContextValue
 */
export interface ColorModeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl') => void;
  setTheme: (themeId: ThemeId) => void;
}
