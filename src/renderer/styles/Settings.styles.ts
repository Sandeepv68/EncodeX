import { alpha, styled } from '@mui/material/styles';
import { Alert, Box, TextField, Typography } from '@mui/material';
import type { ElementType } from 'react';
import { SHADOWS } from '../colors';

export const SettingsRoot = styled(Box)(({ theme }) => ({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }));

export const SettingsHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

export const SettingsTitle = styled(Typography)<{ component?: ElementType }>({ display: 'flex', alignItems: 'center', fontWeight: 600 });

export const SettingsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

export const SettingsLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

export const SettingsLabelRow = styled(Box)({ display: 'flex', alignItems: 'center' });

export const ModeSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.spacing(26),
  [theme.breakpoints.down('sm')]: {
    minWidth: 0,
    width: '100%',
  },
}));

export const McpField = styled(TextField)(({ theme }) => ({
  minWidth: theme.spacing(26),
  [theme.breakpoints.down('sm')]: {
    minWidth: 0,
    width: '100%',
  },
}));

export const McpValueRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: theme.spacing(26),
  [theme.breakpoints.down('sm')]: {
    minWidth: 0,
    width: '100%',
  },
}));

export const ModeSettingsSection = styled(SettingsSection)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
}));

export const AiSettingsSection = styled(SettingsSection)({
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
});

export const AiHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

export const AiWell = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  width: '100%',
}));

export const ProviderGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.spacing(15)}, 1fr))`,
  gap: theme.spacing(1.5),
}));

export const ProviderButton = styled('button', {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  minHeight: theme.spacing(12),
  padding: theme.spacing(2),
  border: `${theme.typography.pxToRem(2)} solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(32),
  color: $selected ? theme.palette.primary.main : theme.palette.text.primary,
  transition: theme.transitions.create(['border-color', 'background-color', 'color']),
  '&:hover': {
    borderColor: $selected ? theme.palette.primary.main : theme.palette.text.primary,
    backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.18) : theme.palette.action.hover,
  },
  '&:focus-visible': {
    outline: `${theme.typography.pxToRem(2)} solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ProviderName = styled('span')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 600,
  lineHeight: 1.2,
  textAlign: 'center',
}));

export const ProviderLogo = styled('img')({
  width: '1em',
  height: '1em',
  display: 'block',
  objectFit: 'contain',
});

export const AiKeyHelper = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

export const AiActionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  paddingTop: theme.spacing(1),
  borderTop: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

export const AiAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

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
