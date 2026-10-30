import { styled } from '@mui/material/styles';
import { Alert, Button } from '@mui/material';

export const ToastAlert = styled(Alert)(({ theme }) => ({
  maxWidth: theme.typography.pxToRem(600),
  color: theme.palette.common.white,
}));

export const ToastMessage = styled('div')(({ theme }) => ({
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(13),
}));

export const ToastDetail = styled('div')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  opacity: 0.9,
  marginTop: theme.typography.pxToRem(2),
}));

/** Action button rendered inside a toast. */
export const ToastActionButton = styled(Button)({
  fontWeight: 600,
});
