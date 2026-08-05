import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { THEME_STORAGE_KEY } from '../shared/app-constants';
import { createAppTheme } from './theme';
import { getTheme, isThemeId } from './colors';
import type { ColorMode, ColorModeContextValue, ThemeId } from './types';

const ColorModeContext = createContext<ColorModeContextValue>({
  themeId: 'light',
  mode: 'light',
  direction: 'ltr',
  setDirection: () => {},
  setTheme: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(saved)) return saved;
    return 'light';
  });
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  const mode: ColorMode = getTheme(themeId).mode;
  const setTheme = (next: ThemeId) => setThemeId(next);

  const theme = useMemo(() => createAppTheme(themeId, direction), [themeId, direction]);

  return (
    <ColorModeContext.Provider value={{ themeId, mode, direction, setDirection, setTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
}
