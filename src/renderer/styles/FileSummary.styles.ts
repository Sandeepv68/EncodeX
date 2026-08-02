import { styled } from '@mui/material/styles';
import { Grid, Box, Typography } from '@mui/material';

export const SummaryGrid = styled(Grid)(({ theme }) => ({ marginBottom: theme.spacing(2) }));

export const TagsBox = styled(Box)(({ theme }) => ({ marginTop: theme.spacing(0.5) }));

export const TagsTitle = styled(Typography)(({ theme }) => ({ display: 'block', fontWeight: 600, marginBottom: theme.spacing(0.5) }));

export const TagItem = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

export const TagKey = styled(Typography)(({ theme }) => ({ fontWeight: 600 }));

export const TagValue = styled(Typography)(({ theme }) => ({ minWidth: 0 }));
