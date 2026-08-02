import { styled } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import { SHADOWS } from '../colors';

export const PageTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const ContentBox = styled(Box)({ width: '100%' });

export const ErrorBox = styled(Box)(({ theme }) => ({ marginBottom: theme.spacing(2) }));

export const LoadingBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginTop: theme.spacing(2),
}));

export const InfoPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const InfoTitle = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(1) }));
