import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/** Vertically centres the empty-state prompt in the conversation area. */
export const WelcomeRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  height: '100%',
  paddingBlock: theme.spacing(4),
  paddingInline: theme.spacing(2),
}));
