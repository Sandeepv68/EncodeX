import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MainContent } from '../App.styles';

const theme = createTheme();

describe('MainContent $flush', () => {
  it('keeps the normal bottom padding and margin by default', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MainContent />
      </ThemeProvider>,
    );
    const el = container.querySelector('main') as HTMLElement;
    const style = getComputedStyle(el);
    expect(style.paddingBottom).toBe(theme.spacing(2));
    expect(style.marginBottom).toBe(theme.spacing(2));
  });

  it('removes the bottom padding and margin when flush', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MainContent $flush />
      </ThemeProvider>,
    );
    const el = container.querySelector('main') as HTMLElement;
    const style = getComputedStyle(el);
    expect(style.paddingBottom).toBe('0px');
    expect(style.marginBottom).toBe('0px');
    expect(style.paddingTop).toBe(theme.spacing(2));
  });
});
