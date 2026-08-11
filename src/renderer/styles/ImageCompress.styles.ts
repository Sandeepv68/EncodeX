import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

export const ToggleSpacer = styled(Box)(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.up('sm')]: {
    display: 'block',
    height: theme.spacing(2.5),
  },
}));
