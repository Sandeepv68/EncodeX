/**
 * @fileoverview Color mode / theme context provider for the renderer.
 *
 * Owns the currently selected theme palette (`ThemeId`), the derived color
 * `mode` ('light' | 'dark'), and the UI text `direction` ('ltr' | 'rtl').
 * The selected theme id is persisted to `localStorage` under
 * THEME_STORAGE_KEY and restored on startup (invalid/stale values fall back to
 * the 'light' theme). The provider builds the MUI theme via `createAppTheme`
 * and supplies it through the MUI `ThemeProvider` so every descendant
 * component can consume palette colors, direction, and typography.
 *
 * Exports:
 *  - useColorMode()     - hook to read the current context value
 *  - ColorModeProvider  - context provider that also installs the MUI ThemeProvider
 */

import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { THEME_STORAGE_KEY } from '../shared/app-constants';
import { createAppTheme } from './theme';
import { getTheme, isThemeId } from './colors';
import type { ColorMode, ColorModeContextValue, ThemeId } from './types';

/**
 * React context carrying the color mode state. Defaults to a no-op value so
 * consumers outside the provider render in a benign state.
 * @const {Context<ColorModeContextValue>}
 */
const ColorModeContext = createContext<ColorModeContextValue>({
  themeId: 'light',
  mode: 'light',
  direction: 'ltr',
  setDirection: () => {},
  setTheme: () => {},
});

/**
 * Hook to access the current color mode context value.
 * Must be used inside a ColorModeProvider subtree.
 * @returns {ColorModeContextValue} The current theme id, mode, direction, and
 *   the `setTheme` / `setDirection` setters.
 */
export function useColorMode() {
  return useContext(ColorModeContext);
}

/**
 * Provider component that owns the theme and direction state and installs the
 * MUI ThemeProvider for its children.
 *
 * On mount it reads the persisted theme id from localStorage (falling back to
 * 'light' when the stored value is missing or not a known theme), and writes
 * the id back to localStorage whenever it changes. The MUI theme is
 * recomputed with `createAppTheme(themeId, direction)` only when either value
 * changes.
 *
 * @param {Object} props - Component props.
 * @param {ReactNode} props.children - React subtree that consumes the theme
 *   and color mode context.
 * @returns {React.JSX.Element} A ColorModeContext.Provider nested inside the
 *   MUI ThemeProvider, wrapping `children`.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  /** Currently selected theme palette id, restored from localStorage. @type {ThemeId} */
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(saved)) return saved;
    return 'light';
  });
  /** Text layout direction, 'ltr' or 'rtl'. @type {'ltr' | 'rtl'} */
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  /** Light/dark mode derived from the active theme definition. @type {ColorMode} */
  const mode: ColorMode = getTheme(themeId).mode;
  const setTheme = (next: ThemeId) => setThemeId(next);

  const theme = useMemo(() => createAppTheme(themeId, direction), [themeId, direction]);

  return (
    <ColorModeContext.Provider value={{ themeId, mode, direction, setDirection, setTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
}
