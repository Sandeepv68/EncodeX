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
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.spacing(18)}, 1fr))`,
  gap: theme.spacing(1.5),
}));

export const ProviderButton = styled('button', {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1.5),
  minHeight: theme.spacing(8),
  padding: theme.spacing(1.5, 2),
  border: `${theme.typography.pxToRem(2)} solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(14),
  color: $selected ? theme.palette.primary.main : theme.palette.text.primary,
  transition: theme.transitions.create(['border-color', 'background-color', 'color']),
  '& > svg': {
    width: theme.spacing(6),
    height: theme.spacing(6),
    flexShrink: 0,
  },
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
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  lineHeight: 1.2,
  textAlign: 'left',
}));

export const ProviderSeparator = styled('span')(({ theme }) => ({
  alignSelf: 'stretch',
  width: theme.typography.pxToRem(1),
  flexShrink: 0,
  backgroundColor: theme.palette.divider,
}));

export const ProviderLogo = styled('img')(({ theme }) => ({
  width: theme.spacing(6),
  height: theme.spacing(6),
  display: 'block',
  flexShrink: 0,
  objectFit: 'contain',
}));

export const AiField = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  width: '100%',
  minWidth: 0,
}));

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

export const AiKeyHelper = styled('span', {
  shouldForwardProp: (prop) => prop !== '$saved',
})<{ $saved: boolean }>(({ theme, $saved }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  color: $saved ? theme.palette.success.main : theme.palette.warning.main,
  fontWeight: 600,
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

/**
 * The small green dot that marks a provider tile (and the collapsed header
 * status) as connected. Decorative only; the connected state is also announced
 * by the success alert inside the expanded editor.
 */
export const ConnectedDot = styled('span')(({ theme }) => ({
  width: theme.spacing(0.75),
  height: theme.spacing(0.75),
  borderRadius: '50%',
  backgroundColor: theme.palette.success.main,
  flexShrink: 0,
}));

/**
 * Right-hand cluster of the collapsed section header: the cached connection
 * summary (when known) next to the Configure button.
 */
export const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));
