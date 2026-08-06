/**
 * @fileoverview Material-UI theme configuration and customization.
 * Builds a theme from a predefined palette definition (see colors.ts).
 *
 * `createAppTheme` maps a `ThemeDefinition` from colors.ts onto the MUI theme
 * object: the palette (mode, primary/secondary accents, background, text,
 * divider), the Roboto font family, an 8px border radius, and global
 * component overrides:
 *  - MuiDrawer: 1px border on the paper edge and the theme's drawer background.
 *  - MuiButton: no text transform, 600 font weight, 40px medium height, and
 *    start/end icons sized to inherit the button font size.
 *  - MuiPaper: removes the default background gradient image.
 *
 * The `direction` argument controls RTL/LTR layout (used together with the
 * DirectionProvider in main.tsx).
 */

import { createTheme } from '@mui/material/styles';
import { COLORS, getTheme } from './colors';
import type { ThemeId } from './types';

/**
 * Font stack used for every MUI typography variant.
 * @const {string} FONT_FAMILY
 */
const FONT_FAMILY = '"Roboto","Helvetica","Arial",sans-serif';

/**
 * Creates a fully configured MUI theme for the given palette id and text
 * direction. The palette is derived from the matching `ThemeDefinition` in
 * colors.ts, with status colors (error/success/warning) sourced from the
 * shared COLORS constant. The returned theme carries a direction of 'ltr' or
 * 'rtl', which React/MUI consume for layout mirroring.
 *
 * @param {ThemeId} themeId - The palette id; must be one of the ids in THEMES.
 * @param {'ltr' | 'rtl'} direction - Layout direction applied to the theme.
 * @returns {Theme} A configured MUI Theme object.
 */
export function createAppTheme(themeId: ThemeId, direction: 'ltr' | 'rtl') {
  const themeDef = getTheme(themeId);
  return createTheme({
    direction,
    palette: {
      mode: themeDef.mode,
      primary: { main: themeDef.primary },
      secondary: { main: themeDef.secondary },
      background: { default: themeDef.background.default, paper: themeDef.background.paper },
      text: { primary: themeDef.text.primary, secondary: themeDef.text.secondary },
      divider: themeDef.border,
      error: { main: COLORS.error },
      success: { main: COLORS.success },
      warning: { main: COLORS.warning },
    },
    typography: { fontFamily: FONT_FAMILY },
    shape: { borderRadius: 8 },
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `${theme.typography.pxToRem(1)} solid ${themeDef.border}`,
            backgroundColor: themeDef.background.drawer,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
          sizeMedium: ({ theme }) => ({ height: theme.typography.pxToRem(40) }),
          startIcon: {
            '& > *:nth-of-type(1)': { fontSize: 'inherit' },
          },
          endIcon: {
            '& > *:nth-of-type(1)': { fontSize: 'inherit' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
}
