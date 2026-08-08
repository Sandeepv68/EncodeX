import { styled } from '@mui/material/styles';
import { Typography, Paper, Stack, Box } from '@mui/material';
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

export const FilterRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

export const DropOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  zIndex: theme.zIndex.modal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
  pointerEvents: 'none',
}));
