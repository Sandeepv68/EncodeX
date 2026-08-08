import { styled } from '@mui/material/styles';
import { Paper, Stack, Typography } from '@mui/material';
import { SHADOWS } from '../colors';

export const EncodingPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const EncodingStack = styled(Stack)({ flexWrap: 'wrap' });

export const EncodingTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));
