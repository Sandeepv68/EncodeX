import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

export const ExifTitle = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  marginBottom: theme.spacing(1),
}));

export const HistogramBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

export const HistogramTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(1),
}));

export const HistogramRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

export const HistogramLabel = styled(Typography)(({ theme }) => ({
  width: theme.spacing(6),
  flexShrink: 0,
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(12),
  color: theme.palette.text.secondary,
}));
