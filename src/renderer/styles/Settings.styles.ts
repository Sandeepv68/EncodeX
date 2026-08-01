import { styled } from '@mui/material/styles';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import { COLORS } from '../colors';

export const SettingsRoot = styled(Box)(({ theme }) => ({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }));

export const SettingsHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

export const SettingsTitle = styled(Typography)({ fontWeight: 600 });

export const SettingsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${COLORS.border.light}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

export const SettingsLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

export const SettingsLabelRow = styled(Box)({ display: 'flex', alignItems: 'center' });

export const ThemeToggleButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  border: `1px solid ${COLORS.border.light}`,
  borderRadius: theme.shape.borderRadius,
}));

export const ModeSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.spacing(26),
}));
