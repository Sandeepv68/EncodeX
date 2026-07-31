import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { THEME_STORAGE_KEY } from '../shared/ui-constants';

type ColorMode = 'light' | 'dark';

interface ColorModeContextValue {
  mode: ColorMode;
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl') => void;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'dark',
  direction: 'ltr',
  setDirection: () => {},
  toggleColorMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return prefersDark ? 'dark' : 'light';
  });
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const theme = useMemo(
    () =>
      createTheme({
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
      }),
    [mode, direction],
  );

  return (
    <ColorModeContext.Provider value={{ mode, direction, setDirection, toggleColorMode }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
}
