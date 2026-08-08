import { styled } from '@mui/material/styles';
import { Stack, TextField, Typography } from '@mui/material';

export const ReviewList = styled(Stack)(({ theme }) => ({
  maxHeight: theme.typography.pxToRem(320),
  overflowY: 'auto',
}));

export const ReviewRow = styled(Stack)(() => ({
  alignItems: 'center',
}));

export const ReviewFileName = styled(Typography)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  fontSize: theme.typography.pxToRem(13),
}));

export const ReviewOperationSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(160),
}));
