/**
 * @fileoverview Design-system types shared by the app shell and the MCP App views.
 *
 * `ColorMode` and `ThemeId` are the discriminated values used across the color
 * system (`colors.ts`, `theme.ts`, `ColorModeContext.tsx`). They live here — not
 * in the renderer — so the standalone MCP App bundle can build the same theme
 * as the Electron renderer without importing renderer code.
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
