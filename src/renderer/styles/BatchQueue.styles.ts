import { styled } from '@mui/material/styles';
import { Typography, Paper } from '@mui/material';
import { SHADOWS } from '../colors';

export const PageTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const QueuePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const EmptyText = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));
