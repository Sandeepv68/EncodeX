/**
 * @fileoverview Type definitions for the renderer application layer.
 * Defines color mode and color mode context value types.
 *
 * `ColorMode` and `ThemeId` are the discriminated values used across the color
 * system (colors.ts, theme.ts, ColorModeContext.tsx). `ColorModeContextValue`
 * is the shape exposed to consumers of the color mode context hook
 * `useColorMode`.
 */

/**
 * Supported UI color modes. Drives the MUI palette mode and the overall
 * light/dark appearance of the application.
 * @typedef {'light' | 'dark'} ColorMode
 */
export type ColorMode = 'light' | 'dark';

/**
 * Supported theme palettes. Each theme carries its own accent colors and
 * a light or dark color mode. The 'light' palette is the default fallback.
 * @typedef {'light' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose' | 'slate' | 'dark'} ThemeId
 */
export type ThemeId = 'light' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose' | 'slate' | 'dark';

/**
 * Value exposed by the color mode context (see ColorModeContext.tsx).
 * @interface ColorModeContextValue
 * @property {ThemeId} themeId - Currently selected theme palette id.
 * @property {ColorMode} mode - Light/dark mode derived from the active theme.
 * @property {'ltr' | 'rtl'} direction - Current text layout direction.
 * @property {(dir: 'ltr' | 'rtl') => void} setDirection - Sets the text layout
 *   direction ('ltr' or 'rtl').
 * @property {(themeId: ThemeId) => void} setTheme - Switches to the given
 *   theme palette id.
 */
export interface ColorModeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl') => void;
  setTheme: (themeId: ThemeId) => void;
}
