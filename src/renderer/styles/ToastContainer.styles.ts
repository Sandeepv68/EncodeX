import { styled } from '@mui/material/styles';
import { Button } from '@mui/material';

/** Filled toast alert; shared with the error snackbar. */
export { ToastAlert } from './alerts.styles';

export const ToastMessage = styled('div')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13),
}));

export const ToastDetail = styled('div')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 400,
  opacity: 0.9,
  marginTop: theme.typography.pxToRem(2),
}));

/** Action button rendered inside a toast. */
export const ToastActionButton = styled(Button)({
  fontWeight: 600,
});
