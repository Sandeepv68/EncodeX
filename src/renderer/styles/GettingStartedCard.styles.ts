/**
 * @fileoverview Styled components for the first-run "Getting Started" card.
 * Mirrors the softened card look used elsewhere on the Dashboard while staying
 * visually distinct (tinted surface + compact goal chips).
 */

import type { ElementType } from 'react';
import { Paper, Box, Typography, IconButton, Chip, styled } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { SHADOWS } from '../colors';

const fadeSlideUp = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateY(${theme.typography.pxToRem(12)}); }
  to { opacity: 1; transform: translateY(0); }
`;

/** Card container — a rounded, slightly tinted surface with hairline border. */
export const GettingStartedRoot = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2, 2, 2, 2.5),
  marginBottom: theme.spacing(3),
  background: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.85) : alpha(theme.palette.primary.main, 0.07),
  border: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  animation: `${fadeSlideUp(theme)} 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/** Top row holding the title block and the dismiss button. */
export const GettingStartedHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
}));

/** Optional spark-label above the title. */
export const GettingStartedHint = styled(Typography)<{ component?: ElementType }>(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: theme.typography.pxToRem(11.5),
    fontWeight: 600,
    color: alpha(isDark ? theme.palette.primary.light : theme.palette.primary.dark, 0.7),
    marginBottom: theme.spacing(0.5),
  };
});

/** Title text of the card. */
export const GettingStartedTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    fontWeight: 600,
    color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
    marginBottom: theme.spacing(0.5),
  };
});

/** Subtitle explaining the card. */
export const GettingStartedBody = styled(Typography)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    color: alpha(isDark ? theme.palette.primary.light : theme.palette.primary.dark, 0.72),
    marginBottom: theme.spacing(1),
  };
});

/** Row of goal chips. */
export const GoalRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

/** Goal-selection chip — soft accent-tinted fill with an accent border. */
export const GoalChip = styled(Chip)(({ theme }) => {
  const accent = theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark;
  return {
    fontWeight: 600,
    color: accent,
    backgroundColor: alpha(accent, 0.12),
    border: `${theme.typography.pxToRem(1)} solid ${alpha(accent, 0.22)}`,
    transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
    '&:hover': {
      backgroundColor: alpha(accent, 0.2),
      borderColor: accent,
    },
    '&:active': {
      transform: `scale(${0.98})`,
    },
  };
});

/** Dismiss ("skip") icon button. */
export const DismissButton = styled(IconButton)(({ theme }) => ({
  padding: 4,
  color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
}));
