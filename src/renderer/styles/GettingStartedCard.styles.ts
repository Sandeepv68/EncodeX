/**
 * @fileoverview Styled components for the first-run "Getting Started" card.
 * Mirrors the softened card look used elsewhere on the Dashboard while staying
 * visually distinct (tinted surface + compact goal chips).
 */

import type { ElementType } from 'react';
import { Paper, Box, Typography, IconButton, Button, styled } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { SHADOWS } from '../../shared/theme/colors';

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
  // Grows to the full width of the dashboard column so every action fits on
  // a single row instead of wrapping onto extra lines.
  width: '100%',
  boxSizing: 'border-box',
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
    color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
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
    color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
    marginBottom: theme.spacing(1),
  };
});

/**
 * Single row of getting-started calls to action.
 *
 * Every action (the tool goals and the two setup actions) lives here, so the
 * row never wraps onto extra lines. When the window is too narrow for the
 * full set, the row scrolls horizontally instead of breaking the layout.
 */
export const ActionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: theme.spacing(1),
  overflowX: 'auto',
  paddingBottom: theme.spacing(0.5),
  scrollbarWidth: 'thin',
}));

/**
 * The one button style used by every CTA on the card.
 *
 * Goals and setup actions share this component so the whole row reads as a
 * single, uniform set of actions.
 */
export const ActionButton = styled(Button)(({ theme }) => {
  const accent = theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark;
  return {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontWeight: 600,
    fontSize: theme.typography.pxToRem(13),
    lineHeight: 1.4,
    padding: theme.spacing(0.5, 1.25),
    color: accent,
    borderColor: alpha(accent, 0.4),
    backgroundColor: alpha(accent, 0.1),
    textTransform: 'none',
    transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
    '&:hover': {
      borderColor: accent,
      backgroundColor: alpha(accent, 0.18),
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
