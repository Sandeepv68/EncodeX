import { styled } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export const FallbackBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  padding: theme.spacing(4),
}));

export const FallbackPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 480,
  textAlign: 'center',
}));

export const WarningIcon = styled(WarningAmberIcon)(({ theme }) => ({
  fontSize: 48,
  color: theme.palette.error.main,
  marginBottom: theme.spacing(2),
}));

export const FallbackTitle = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(1) }));

export const FallbackDescription = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(2) }));
