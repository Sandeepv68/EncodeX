import { createTheme } from '@mui/material/styles';
import { COLORS } from './colors';

export type ColorMode = 'light' | 'dark';

const FONT_FAMILY = '"Roboto","Helvetica","Arial",sans-serif';

export function createAppTheme(mode: ColorMode, direction: 'ltr' | 'rtl') {
  return createTheme({
    direction,
    palette: {
      mode,
      primary: { main: COLORS.primary },
      secondary: { main: COLORS.secondary },
      ...(mode === 'dark'
        ? {
            background: { default: COLORS.background.dark, paper: COLORS.background.darkPaper },
            text: { primary: COLORS.text.darkPrimary, secondary: COLORS.text.darkSecondary },
          }
        : {
            background: { default: COLORS.background.light, paper: COLORS.background.lightPaper },
            text: { primary: COLORS.text.lightPrimary, secondary: COLORS.text.lightSecondary },
          }),
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
            ...(mode === 'dark'
              ? {
                  borderRight: `${theme.typography.pxToRem(1)} solid ${COLORS.border.dark}`,
                  backgroundColor: COLORS.background.drawerDark,
                }
              : {
                  borderRight: `${theme.typography.pxToRem(1)} solid ${COLORS.border.light}`,
                  backgroundColor: COLORS.background.lightPaper,
                }),
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
