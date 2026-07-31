import { styled } from '@mui/material/styles';
import { Alert } from '@mui/material';

export const ToastAlert = styled(Alert)({ maxWidth: 600 });

export const ToastMessage = styled('div')({ fontWeight: 600, fontSize: 13 });

export const ToastDetail = styled('div')({ fontSize: 12, opacity: 0.9, marginTop: 2 });
