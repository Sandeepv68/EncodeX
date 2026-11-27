import { styled } from '@mui/material/styles';
import { Box, Grid, Paper, Tab, Tabs, Typography } from '@mui/material';
import type { ElementType } from 'react';
import { SHADOWS } from '../../shared/theme/colors';

/** Centered column holding the Quick Links panel. */
export const QuickLinksPanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
});

/** Section title for the Quick Links panel. */
export const QuickLinksPanelTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(2),
  color: theme.palette.primary.main,
  fontWeight: 700,
}));

/** Category tabs spanning the available width. */
export const QuickLinksTabs = styled(Tabs)(({ theme }) => ({
  width: '100%',
  borderBottom: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  marginBottom: theme.spacing(2),
}));

/** Category tab label. */
export const QuickLinksTab = styled(Tab)({
  textTransform: 'none',
});

/** Grid of quick link cards. */
export const QuickLinksGrid = styled(Grid)({
  width: '100%',
  justifyContent: 'center',
});

/** Grid cell for one quick link card. */
export const QuickLinksGridItem = styled(Grid)({
  display: 'flex',
});

/** Placeholder shown while the quick link list is empty. */
export const QuickLinksEmpty = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: theme.typography.pxToRem(560),
  padding: theme.spacing(4),
  textAlign: 'center',
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));
