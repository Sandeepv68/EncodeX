import { styled } from '@mui/material/styles';
import { Paper, Typography } from '@mui/material';
import { SHADOWS } from '../colors';

export const EncodingPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const EncodingTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));
