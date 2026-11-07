import { describe, it, expect } from 'vitest';
import type { Theme } from '@mui/material/styles';
import { createAppTheme } from '../../shared/theme/theme';

type StyleMap = Record<string, Record<string, unknown>>;

function scrollbarStyles(theme: Theme): StyleMap {
  const overrides = theme.components?.MuiCssBaseline?.styleOverrides;
  if (typeof overrides !== 'function') {
    throw new Error('MuiCssBaseline styleOverrides must be a function');
  }
  return overrides(theme) as StyleMap;
}

describe('theme scrollbar styles', () => {
  it('applies the unified scrollbar geometry to every scrollable element', () => {
    const theme = createAppTheme('light', 'ltr');
    const styles = scrollbarStyles(theme);

    expect(styles['*::-webkit-scrollbar']).toMatchObject({
      width: theme.typography.pxToRem(10),
      height: theme.typography.pxToRem(10),
    });
    expect(styles['*::-webkit-scrollbar-thumb']).toMatchObject({
      borderRadius: theme.typography.pxToRem(10),
      backgroundClip: 'content-box',
    });
    expect(styles['*::-webkit-scrollbar-button']).toMatchObject({ display: 'none' });
    expect(styles['@supports not selector(::-webkit-scrollbar)']).toMatchObject({
      '*': { scrollbarWidth: 'thin' },
    });
  });

  it('uses distinct light and dark scrollbar variants', () => {
    const light = scrollbarStyles(createAppTheme('light', 'ltr'));
    const dark = scrollbarStyles(createAppTheme('dark', 'ltr'));

    expect(light['*::-webkit-scrollbar-track'].backgroundColor).not.toBe(dark['*::-webkit-scrollbar-track'].backgroundColor);
    expect(light['*::-webkit-scrollbar-thumb'].backgroundColor).not.toBe(dark['*::-webkit-scrollbar-thumb'].backgroundColor);
    expect(light['*::-webkit-scrollbar-thumb:hover'].backgroundColor).not.toBe(dark['*::-webkit-scrollbar-thumb:hover'].backgroundColor);
  });
});
