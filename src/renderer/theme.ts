/**
 * @fileoverview Material-UI theme configuration and customization.
 * Builds a theme from a predefined palette definition (see colors.ts).
 */

import { createTheme } from '@mui/material/styles';
import { COLORS, getTheme } from './colors';
import type { ThemeId } from './types';

const FONT_FAMILY = '"Roboto","Helvetica","Arial",sans-serif';

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
