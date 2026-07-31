import { styled } from '@mui/material/styles';
import { Alert } from '@mui/material';

export const SnackbarAlert = styled(Alert)({ maxWidth: 600 });

export const AlertMessage = styled('div')({ fontWeight: 600, fontSize: 13 });

export const AlertDetail = styled('div')({ fontSize: 12, opacity: 0.9, marginTop: 2 });
