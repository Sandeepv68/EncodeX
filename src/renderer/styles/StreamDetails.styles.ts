import { styled } from '@mui/material/styles';
import { Box, Paper, Typography } from '@mui/material';

export const StreamTitle = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(1) }));

export const StreamPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.default,
}));

export const StreamHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

export const StreamName = styled(Typography)({ fontWeight: 600 });
