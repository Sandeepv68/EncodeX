import { styled } from '@mui/material/styles';
import { Box, Dialog, Typography } from '@mui/material';

export const ShortcutsDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: theme.typography.pxToRem(480),
    maxWidth: '90vw',
  },
}));

export const ShortcutsContent = styled(Box)(({ theme }) => ({
  maxHeight: theme.typography.pxToRem(480),
  overflowY: 'auto',
  paddingRight: theme.spacing(1),
}));

export const ShortcutsSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: theme.typography.pxToRem(11),
  letterSpacing: theme.typography.pxToRem(0.8),
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(2.5),
  marginBottom: theme.spacing(0.5),
}));

export const ShortcutRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(0.75, 0),
}));

export const ShortcutLabel = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13.5),
}));

export const ShortcutKey = styled(Box)(({ theme }) => ({
  fontFamily: "ui-monospace, 'Cascadia Mono', 'Consolas', monospace",
  fontSize: theme.typography.pxToRem(12),
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.action.hover,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
  boxShadow: `inset 0 -${theme.typography.pxToRem(1)} 0 ${theme.palette.divider}`,
  whiteSpace: 'nowrap',
}));
