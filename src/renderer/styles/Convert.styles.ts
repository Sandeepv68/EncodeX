import { styled } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  "& .MuiTypography-root.MuiTypography-caption": {
     fontWeight:  theme.typography.fontWeightBold,
  }
}));

export const FieldBox = styled(Box)({ flex: 1 });

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight:  theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const ActionStack = styled(Stack)({ flexWrap: 'wrap' });
