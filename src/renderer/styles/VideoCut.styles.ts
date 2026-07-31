import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));
