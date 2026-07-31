import { createTheme } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export function createAppTheme(mode: ColorMode, direction: 'ltr' | 'rtl') {
  return createTheme({
    direction,
    palette: {
      mode,
      primary: { main: '#0f9b8e' },
      secondary: { main: '#0dbfb0' },
      ...(mode === 'dark'
        ? {
            background: { default: '#1a1a2e', paper: '#1e2a4a' },
            text: { primary: '#e8e8e8', secondary: '#a0a0b0' },
          }
        : {
            background: { default: '#f5f5f5', paper: '#ffffff' },
            text: { primary: '#1a1a2e', secondary: '#6b6b80' },
          }),
      error: { main: '#e74c3c' },
      success: { main: '#2ecc71' },
      warning: { main: '#f39c12' },
    },
    typography: { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
    shape: { borderRadius: 8 },
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: {
            ...(mode === 'dark'
              ? { borderRight: '1px solid #2a3a5a', backgroundColor: '#16213e' }
              : { borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff' }),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
}
