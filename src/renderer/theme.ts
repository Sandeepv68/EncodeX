/**
 * @fileoverview Material-UI theme configuration and customization.
 * Builds a theme from a predefined palette definition (see colors.ts).
 *
 * `createAppTheme` maps a `ThemeDefinition` from colors.ts onto the MUI theme
 * object: the palette (mode, primary/secondary accents, background, text,
 * divider), the Roboto font family, an 8px border radius, and global
 * component overrides:
 *  - MuiDrawer: 1px border on the paper edge and the theme's drawer background.
 *  - MuiButton: no text transform, 600 font weight, 40px medium height,
 *    rounded corners, and start/end icons sized to inherit the button font size.
 *  - MuiOutlinedInput / MuiInputBase: the modern input look — tinted surface,
 *    rounded corners, theme-colored hover/focus borders and a focus ring.
 *  - MuiMenu / MuiMenuItem: rounded dropdown paper with the theme's menu
 *    surface/shadow and primary-tinted hover/selected states.
 *  - MuiSwitch / MuiChip / MuiTooltip / MuiAlert: rounded, theme-consistent
 *    control styling. Number-input spinners are hidden for a clean look.
 *  - MuiPaper: removes the default background gradient image.
 *
 * The `direction` argument controls RTL/LTR layout (used together with the
 * DirectionProvider in main.tsx).
 */

import { createTheme } from '@mui/material/styles';
import { COLORS, getTheme, SHADOWS } from './colors';
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
      MuiInputBase: {
        styleOverrides: {
          input: {
            '&[type=number]::-webkit-outer-spin-button, &[type=number]::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            '&[type=number]': {
              MozAppearance: 'textfield',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.typography.pxToRem(10),
            backgroundColor: themeDef.input.surface,
            transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
            '&:hover': {
              backgroundColor: themeDef.input.surfaceHover,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: themeDef.input.borderFocus,
              },
            },
            '&.Mui-focused': {
              backgroundColor: themeDef.input.surfaceHover,
              boxShadow: `0 0 0 ${theme.typography.pxToRem(4)} ${themeDef.focusRing}`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: themeDef.primary,
                borderWidth: theme.typography.pxToRem(2),
              },
            },
            '&.Mui-error': {
              '&:hover .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: COLORS.error,
              },
            },
          }),
          input: ({ theme, ownerState }) => ({
            boxSizing: 'border-box',
            height: theme.typography.pxToRem(ownerState.size === 'small' ? 36 : 44),
            paddingTop: 0,
            paddingBottom: 0,
            // MUI's SelectInput forces `height: auto` on `.MuiSelect-select`
            // with the same specificity as the rule above and injects it later,
            // so it wins the tie and collapses selects to auto height. Repeating
            // the class raises our specificity so selects match text inputs
            // (36px small / 44px medium).
            '&.MuiSelect-select.MuiSelect-select': {
              height: theme.typography.pxToRem(ownerState.size === 'small' ? 36 : 44),
              minHeight: theme.typography.pxToRem(ownerState.size === 'small' ? 36 : 44),
              paddingTop: 0,
              paddingBottom: 0,
              display: 'flex',
              alignItems: 'center',
            },
          }),
          notchedOutline: ({ theme }) => ({
            borderColor: themeDef.input.border,
            borderRadius: theme.typography.pxToRem(10),
          }),
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            fontWeight: 500,
            '&.Mui-focused': { color: themeDef.primary },
            '&.Mui-error': { color: COLORS.error },
          }),
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: ({ theme }) => ({
            fontSize: theme.typography.pxToRem(12),
            marginInlineStart: theme.typography.pxToRem(2),
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: theme.typography.pxToRem(10),
            transition: 'box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease',
            '&:hover': {
              boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT,
            },
          }),
          sizeMedium: ({ theme }) => ({ height: theme.typography.pxToRem(40) }),
          sizeLarge: ({ theme }) => ({ height: theme.typography.pxToRem(48) }),
          startIcon: {
            '& > *:nth-of-type(1)': { fontSize: 'inherit' },
          },
          endIcon: {
            '& > *:nth-of-type(1)': { fontSize: 'inherit' },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: theme.typography.pxToRem(10),
            backgroundColor: themeDef.menu.surface,
            boxShadow: themeDef.menu.shadow,
            border: `${theme.typography.pxToRem(1)} solid ${themeDef.border}`,
            padding: theme.typography.pxToRem(6),
          }),
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.typography.pxToRem(8),
            margin: `${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(6)}`,
            '&:hover': {
              backgroundColor: themeDef.tint.primary15,
            },
            '&.Mui-selected': {
              backgroundColor: themeDef.tint.primary15,
              color: themeDef.primary,
              '&:hover': { backgroundColor: themeDef.tint.primary25 },
            },
          }),
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: themeDef.primary,
              '& + .MuiSwitch-track': {
                backgroundColor: themeDef.primary,
                opacity: 0.6,
              },
            },
          },
          track: ({ theme }) => ({ borderRadius: theme.typography.pxToRem(10) }),
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            '&.Mui-checked': { color: themeDef.primary },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.typography.pxToRem(8),
            backgroundColor: themeDef.surfaceSubtle,
            '&:hover': { backgroundColor: themeDef.tint.primary15 },
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            borderRadius: theme.typography.pxToRem(8),
            fontSize: theme.typography.pxToRem(12),
            padding: `${theme.typography.pxToRem(6)} ${theme.typography.pxToRem(10)}`,
          }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ theme }) => ({ borderRadius: theme.typography.pxToRem(10) }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderInlineEnd: `${theme.typography.pxToRem(1)} solid ${themeDef.border}`,
            backgroundColor: themeDef.background.drawer,
          }),
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
}
