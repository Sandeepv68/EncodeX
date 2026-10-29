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
 * @property {Object} input - Derived input/control tokens.
 * @property {string} input.surface - Input field background (resting).
 * @property {string} input.surfaceHover - Input field background on hover.
 * @property {string} input.border - Input outline color (resting).
 * @property {string} input.borderFocus - Input outline color on hover/focus.
 * @property {string} focusRing - Translucent primary-tinted focus ring.
 * @property {string} surfaceSubtle - Subtle tinted panel background.
 * @property {Object} menu - Dropdown/popover surface styling.
 * @property {string} menu.surface - Dropdown menu background.
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
  /** Derived input/control tokens so every theme gets a coherent modern look. */
  input: {
    /** Input field background (resting state). */
    surface: string;
    /** Input field background on hover. */
    surfaceHover: string;
    /** Input outline color (resting state). */
    border: string;
    /** Input outline color on hover/focus. */
    borderFocus: string;
  };
  /** Translucent primary-tinted focus ring around focused controls. */
  focusRing: string;
  /** Subtle tinted panel background for section headers and chips. */
  surfaceSubtle: string;
  /** Dropdown / popover surface styling. */
  menu: {
    /** Dropdown menu background. */
    surface: string;
  };
}
