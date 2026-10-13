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

/** Circular badge behind the Copilot robot icon. */
export const WelcomeBadge = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.typography.pxToRem(64),
  height: theme.typography.pxToRem(64),
  borderRadius: '50%',
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : theme.palette.grey[100],
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));
