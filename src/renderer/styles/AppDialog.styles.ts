import { styled } from '@mui/material/styles';
import { Box, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';

export const AppDialogTitle = styled(DialogTitle)({
  paddingRight: 16,
});

export const AppDialogHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

export const AppDialogIcon = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.palette.common.black,
  fontSize: theme.typography.pxToRem(17.6),
}));

export const AppDialogTitleText = styled(Typography)({
  flex: 1,
  minWidth: 0,
  fontWeight: 600,
}) as typeof Typography;

export const AppDialogCloseButton = styled(IconButton)({});

export const AppDialogBody = styled(DialogContent, {
  shouldForwardProp: (prop) => prop !== '$disablePadding',
})<{ $disablePadding?: boolean }>(({ $disablePadding }) => ({
  ...($disablePadding ? { padding: 0 } : {}),
}));
