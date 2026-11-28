import { styled } from '@mui/material/styles';
import { Box, Grid, Typography } from '@mui/material';
import type { ElementType } from 'react';

/** Left-aligned column holding the Quick Links panel. */
export const QuickLinksPanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: '100%',
});

/** Section title for the Quick Links panel. */
export const QuickLinksPanelTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(2),
  color: theme.palette.primary.main,
  fontWeight: 700,
  textAlign: 'left',
}));

/** Grid of quick link cards. */
export const QuickLinksGrid = styled(Grid)({
  width: '100%',
  justifyContent: 'flex-start',
});

/** Grid cell for one quick link card. */
export const QuickLinksGridItem = styled(Grid)({
  display: 'flex',
});
