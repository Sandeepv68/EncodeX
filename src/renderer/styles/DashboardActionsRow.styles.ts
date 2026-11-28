import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/** Row holding the ghost icon buttons for panel switching and editing. */
export const ActionsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  width: '100%',
  marginBottom: theme.spacing(2),
}));
