import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

export const FieldBox = styled(Box)({ flex: 1 });

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
}));
