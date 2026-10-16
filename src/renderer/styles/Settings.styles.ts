/**
 * @fileoverview Shared styled primitives for the Settings page and its sections.
 *
 * Section-specific tokens live next to their components: the theme picker's in
 * `settings/ThemeSettingsSection.styles.ts` and the AI-provider editor's in
 * `settings/AiProviderSettingsSection.styles.ts`. Everything here is reused by
 * the page shell or by more than one section.
 */

import { styled } from '@mui/material/styles';
import { Box, TextField, Typography } from '@mui/material';
import type { ElementType } from 'react';

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
  fontSize: theme.typography.pxToRem(14),
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
