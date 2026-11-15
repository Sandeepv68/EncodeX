/**
 * @fileoverview Shared styled primitives for the Settings page and its sections.
 *
 * Section-specific tokens live next to their components: the theme picker's in
 * `settings/ThemeSettingsSection.styles.ts` and the AI-provider editor's in
 * `settings/AiProviderSettingsSection.styles.ts`. Everything here is reused by
 * the page shell or by more than one section.
 */

import { styled } from '@mui/material/styles';
import { Box, Tabs, TextField, Typography } from '@mui/material';
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

/**
 * Tab strip for the Settings page, matched to the batch-queue tab bar so both
 * pages share the same tab sizing and spacing. Uses the `inherit` text colour
 * instead of MUI's primary tint, which sits just under the 4.5:1 contrast ratio
 * axe requires; unselected tabs keep the secondary text colour at full opacity.
 * @const SettingsTabs
 */
export const SettingsTabs = styled(Tabs)(({ theme }) => ({
  '&&& .MuiTab-root': {
    minWidth: theme.typography.pxToRem(140),
    whiteSpace: 'nowrap',
    opacity: 1,
    color: theme.palette.text.secondary,
    textTransform: 'none',
  },
  '&&& .MuiTab-root.Mui-selected': {
    color: theme.palette.text.primary,
    fontWeight: theme.typography.fontWeightBold,
  },
}));

/**
 * Row wrapper keeping a tab's icon and label on one line. The icon is part of
 * the label rather than MUI's `icon` prop, which would switch the tab to the
 * taller icon-and-label layout and break the sizing the queue tab bar uses.
 * @const SettingsTabLabel
 */
export const SettingsTabLabel = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

/**
 * Panel that holds one tab's settings sections. All panels stay mounted; the
 * `hidden` attribute removes inactive ones from the accessibility tree. The
 * explicit `&[hidden]` rule is required because the `display: flex` below would
 * otherwise beat the user agent's `[hidden] { display: none }` style.
 * @const SettingsTabPanel
 */
export const SettingsTabPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  '&[hidden]': { display: 'none' },
}));
