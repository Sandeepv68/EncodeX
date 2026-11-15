import { styled } from '@mui/material/styles';

/** Filled snackbar alert; shares the toast surface. */
export { ToastAlert as SnackbarAlert } from './alerts.styles';

export const AlertMessage = styled('div')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13),
}));

export const AlertDetail = styled('div')(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 400,
  opacity: 0.9,
  marginTop: theme.typography.pxToRem(2),
}));
