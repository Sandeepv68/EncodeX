import { styled } from '@mui/material/styles';
import { Stack, TextField, Typography } from '@mui/material';

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const FieldStack = styled(Stack)({ flexWrap: 'wrap', alignItems: 'flex-start' });

export const PathField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(200),
  flex: 1,
}));
