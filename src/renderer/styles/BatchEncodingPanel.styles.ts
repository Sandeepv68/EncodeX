import { styled } from '@mui/material/styles';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { SHADOWS } from '../colors';

export const EncodingPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const EncodingStack = styled(Stack)({ flexWrap: 'wrap' });

export const EncodingTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

export const FieldBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

export const FieldLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  lineHeight: 1.2,
}));
