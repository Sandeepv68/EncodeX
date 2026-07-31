import { styled } from '@mui/material/styles';
import { Typography, Paper } from '@mui/material';

export const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const QueuePaper = styled(Paper)(({ theme }) => ({ padding: theme.spacing(2) }));

export const EmptyText = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));
