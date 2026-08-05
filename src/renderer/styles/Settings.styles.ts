import { styled } from '@mui/material/styles';
import { Box, TextField, Typography } from '@mui/material';

export const SettingsRoot = styled(Box)(({ theme }) => ({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }));

export const SettingsHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

export const SettingsTitle = styled(Typography)({ display: 'flex', alignItems: 'center', fontWeight: 600 });

export const SettingsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
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
  border: `2px solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  background: 'none',
  cursor: 'pointer',
  color: $selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    borderColor: $selected ? theme.palette.primary.main : theme.palette.text.secondary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ThemePreview = styled(Box)(({ theme }) => ({
  width: 132,
  height: 88,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
}));

export const ThemePreviewPaper = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ theme, $color }) => ({
  flex: 1,
  width: '100%',
  borderRadius: 4,
  backgroundColor: $color,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.75),
}));

export const ThemePreviewTextBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color' && prop !== '$width',
})<{ $color: string; $width: string }>(({ $color, $width }) => ({
  height: 4,
  width: $width,
  borderRadius: 2,
  backgroundColor: $color,
}));

export const ThemePreviewAccentBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({
  height: 10,
  width: '100%',
  borderRadius: 3,
  backgroundColor: $color,
}));
