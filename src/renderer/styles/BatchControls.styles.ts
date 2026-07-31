import { styled } from '@mui/material/styles';
import { Paper, Stack, TextField } from '@mui/material';

export const ControlsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

export const ControlsStack = styled(Stack)({ flexWrap: 'wrap' });

export const OperationSelect = styled(TextField)({ minWidth: 140 });

export const TranscoderSelect = styled(TextField)({ minWidth: 110 });

export const SuffixField = styled(TextField)({ minWidth: 120 });
