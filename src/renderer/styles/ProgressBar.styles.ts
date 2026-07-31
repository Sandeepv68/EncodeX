import { styled } from '@mui/material/styles';
import { Box, LinearProgress } from '@mui/material';

export const ProgressTrack = styled(LinearProgress)(({ theme }) => ({
  height: theme.typography.pxToRem(8),
  borderRadius: theme.shape.borderRadius,
}));

export const ProgressInfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: theme.spacing(0.5),
}));
