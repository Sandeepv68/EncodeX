import type { ElementType } from 'react';
import { styled } from '@mui/material/styles';
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

/** Headline of the empty-state prompt. */
export const WelcomeTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Supporting copy of the empty-state prompt. */
export const WelcomeSubtitle = styled(Typography)(({ theme }) => ({
  maxWidth: theme.typography.pxToRem(480),
}));
