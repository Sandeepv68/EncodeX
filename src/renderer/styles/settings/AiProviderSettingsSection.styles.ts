/**
 * @fileoverview Styled primitives for the Settings AI-provider section.
 *
 * Split out of `Settings.styles.ts` so the AI-provider editor owns its layout
 * tokens. The container extends the shared {@link SettingsSection} frame.
 */

import { alpha, styled } from '@mui/material/styles';
import { Alert, Box } from '@mui/material';
import { SHADOWS } from '../../colors';
import { SettingsSection } from '../Settings.styles';

export const AiSettingsSection = styled(SettingsSection)({
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
});

export const AiHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

export const AiWell = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  width: '100%',
}));

export const ProviderGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.spacing(15)}, 1fr))`,
  gap: theme.spacing(1.5),
}));

export const ProviderButton = styled('button', {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  minHeight: theme.spacing(12),
  padding: theme.spacing(2),
  border: `${theme.typography.pxToRem(2)} solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(32),
  color: $selected ? theme.palette.primary.main : theme.palette.text.primary,
  transition: theme.transitions.create(['border-color', 'background-color', 'color']),
  '&:hover': {
    borderColor: $selected ? theme.palette.primary.main : theme.palette.text.primary,
    backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.18) : theme.palette.action.hover,
  },
  '&:focus-visible': {
    outline: `${theme.typography.pxToRem(2)} solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ProviderName = styled('span')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 600,
  lineHeight: 1.2,
  textAlign: 'center',
}));

export const ProviderLogo = styled('img')({
  width: '1em',
  height: '1em',
  display: 'block',
  objectFit: 'contain',
});

export const AiKeyRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(1),
  flexWrap: 'nowrap',
  '& .MuiTextField-root': {
    flex: 1,
    minWidth: 0,
  },
  '& .MuiButton-root': {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  [theme.breakpoints.down('sm')]: {
    flexWrap: 'wrap',
    '& .MuiTextField-root': {
      width: '100%',
    },
  },
}));

export const AiKeyHelper = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  paddingTop: theme.spacing(1),
  borderTop: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

export const AiAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));
