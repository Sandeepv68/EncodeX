import type { ElementType } from 'react';
import { alpha, styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

/** Vertically centres the empty-state prompt in the conversation area. */
export const WelcomeRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  height: '100%',
  paddingBlock: theme.spacing(4),
  paddingInline: theme.spacing(2),
}));

/** Soft drop shadow that lifts the welcome copy off the drifting glow. */
const welcomeTextShadow = (theme: Theme): string => {
  const color = alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.55 : 0.12);
  return `${theme.typography.pxToRem(0)} ${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(8)} ${color}`;
};

/** Headline of the empty-state prompt. */
export const WelcomeTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(1),
  textShadow: welcomeTextShadow(theme),
}));

/** Supporting copy of the empty-state prompt. */
export const WelcomeSubtitle = styled(Typography)(({ theme }) => ({
  maxWidth: theme.typography.pxToRem(480),
  textShadow: welcomeTextShadow(theme),
}));
