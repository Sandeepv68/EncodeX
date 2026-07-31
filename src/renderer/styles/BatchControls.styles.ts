import { styled } from '@mui/material/styles';
import { Paper, Stack, TextField } from '@mui/material';

export const ControlsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

export const ControlsStack = styled(Stack)({ flexWrap: 'wrap' });

export const OperationSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(140),
}));

export const TranscoderSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(110),
}));

export const SuffixField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(120),
}));
