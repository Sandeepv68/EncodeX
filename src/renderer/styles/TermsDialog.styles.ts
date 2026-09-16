import { styled } from '@mui/material/styles';
import { Box, Dialog, Typography } from '@mui/material';

export const TermsDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: theme.typography.pxToRem(560),
    maxWidth: '92vw',
  },
}));

export const TermsContent = styled(Box)(({ theme }) => ({
  maxHeight: theme.typography.pxToRem(520),
  overflowY: 'auto',
  paddingRight: theme.spacing(1),
}));

export const TermsSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: theme.typography.pxToRem(14),
  color: theme.palette.text.primary,
  marginTop: theme.spacing(2.5),
  marginBottom: theme.spacing(0.5),
}));

export const TermsSectionBody = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(13),
  lineHeight: theme.typography.body2.lineHeight,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.75),
}));
