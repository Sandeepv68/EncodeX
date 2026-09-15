/**
 * @fileoverview Styled components for the first-run "Getting Started" card.
 * Mirrors the softened card look used elsewhere on the Dashboard while staying
 * visually distinct (tinted surface + compact goal chips).
 */

import type { ElementType } from 'react';
import { Paper, Box, Typography, IconButton, Chip, styled } from '@mui/material';
import { alpha } from '@mui/material/styles';

/** Card container — a rounded, slightly tinted surface with hairline border. */
export const GettingStartedRoot = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2, 2, 2, 2.5),
  marginBottom: theme.spacing(3),
  borderRadius: (theme.shape.borderRadius as number) * 4,
  background: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : theme.palette.primary.light,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** Top row holding the title block and the dismiss button. */
export const GettingStartedHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
}));

/** Optional spark-label above the title. */
export const GettingStartedHint = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: theme.typography.pxToRem(11.5),
  fontWeight: 600,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

/** Title text of the card. */
export const GettingStartedTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
}));

/** Subtitle explaining the card. */
export const GettingStartedBody = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Row of goal chips. */
export const GoalRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

/** Dismiss ("skip") icon button. */
export const DismissButton = styled(IconButton)({
  padding: 4,
});
