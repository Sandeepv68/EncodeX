import { styled } from '@mui/material/styles';
import { IconButton, Paper, Stack, TextField } from '@mui/material';
import { SHADOWS } from '../colors';

export const ControlsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const ControlsStack = styled(Stack)({ flexWrap: 'wrap' });

export const OutlinedIconButton = styled(IconButton)(({ theme }) => ({
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[600],
  },
}));

export const OperationSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(140),
}));

export const TranscoderSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(110),
}));

export const ConcurrencySelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(130),
}));

export const SuffixField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(120),
}));

export const OutputDirField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(220),
}));
