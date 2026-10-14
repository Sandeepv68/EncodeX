/**
 * @fileoverview Styled primitives for the Settings theme picker section.
 *
 * Split out of `Settings.styles.ts` so the theme section owns its layout
 * tokens. The container extends the shared {@link SettingsSection} frame.
 */

import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { SettingsSection } from '../Settings.styles';

export const ThemeSettingsSection = styled(SettingsSection)({
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
});

export const ThemeSwitcher = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
}));

export const ThemeCard = styled('button', {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  border: `${theme.typography.pxToRem(2)} solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  background: 'none',
  cursor: 'pointer',
  color: $selected
    ? theme.palette.mode === 'dark'
      ? theme.palette.primary.light
      : theme.palette.primary.main
    : theme.palette.text.secondary,
  '&:hover': {
    borderColor: $selected ? theme.palette.primary.main : theme.palette.text.secondary,
  },
  '&:focus-visible': {
    outline: `${theme.typography.pxToRem(2)} solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ThemePreview = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$backgroundColor',
})<{ $backgroundColor: string }>(({ theme, $backgroundColor }) => ({
  width: theme.typography.pxToRem(132),
  height: theme.typography.pxToRem(88),
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  backgroundColor: $backgroundColor,
}));

export const ThemePreviewPaper = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ theme, $color }) => ({
  flex: 1,
  width: '100%',
  borderRadius: theme.typography.pxToRem(4),
  backgroundColor: $color,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.75),
}));

export const ThemePreviewTextBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color' && prop !== '$width',
})<{ $color: string; $width: string }>(({ theme, $color, $width }) => ({
  height: theme.typography.pxToRem(4),
  width: $width,
  borderRadius: theme.typography.pxToRem(2),
  backgroundColor: $color,
}));

export const ThemePreviewAccentBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ theme, $color }) => ({
  height: theme.typography.pxToRem(10),
  width: '100%',
  borderRadius: theme.typography.pxToRem(3),
  backgroundColor: $color,
}));
