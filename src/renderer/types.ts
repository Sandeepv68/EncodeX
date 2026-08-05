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
 * Value exposed by the color mode context.
 * @interface ColorModeContextValue
 */
export interface ColorModeContextValue {
  mode: ColorMode;
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl') => void;
  toggleColorMode: () => void;
}
