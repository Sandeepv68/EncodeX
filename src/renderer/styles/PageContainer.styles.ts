import { styled } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import type { ElementType } from 'react';
import { SHADOWS } from '../colors';

/**
 * Root layout for a page.
 *
 * `$hasAside` uses MUI's transient-prop (`$`) convention so Emotion consumes it
 * instead of forwarding it. Without the prefix every page rendered an invalid
 * `hasaside` attribute onto the DOM element, which React warns about on each
 * mount and which is invalid HTML in the shipped app.
 */
export const PageRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$hasAside',
})<{ $hasAside?: boolean }>(({ theme, $hasAside }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: theme.spacing(2),
  ...($hasAside
    ? {
        [theme.breakpoints.up('md')]: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
      }
    : {}),
}));

export const PageBody = styled(Box)({ flex: 1, minWidth: 0 });

export const PageTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const TitleIcon = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 1,
  marginInlineEnd: theme.typography.pxToRem(8),
}));

export const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) },
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));
