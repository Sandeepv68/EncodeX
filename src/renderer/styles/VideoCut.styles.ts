import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  "& .MuiTypography-root": {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
  }
}));
