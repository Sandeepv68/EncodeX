import { styled } from '@mui/material/styles';
import { Button } from '@mui/material';

/** Filled toast alert and text primitives; shared with the error snackbar. */
export { ToastAlert, AlertMessageText as ToastMessage, AlertDetailText as ToastDetail } from './alerts.styles';

/** Action button rendered inside a toast. */
export const ToastActionButton = styled(Button)({
  fontWeight: 600,
});
