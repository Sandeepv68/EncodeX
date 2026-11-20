import { alpha, styled } from '@mui/material/styles';
import { Box, DialogContent, DialogTitle, Divider, IconButton, Typography } from '@mui/material';

export const AppDialogTitle = styled(DialogTitle)({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
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

export const AppDialogCloseButton = styled(IconButton)({
  flexShrink: 0,
});

export const AppDialogDivider = styled(Divider)(({ theme }) => ({
  borderColor: alpha(theme.palette.divider, 0.25),
}));

export const AppDialogBody = styled(DialogContent, {
  shouldForwardProp: (prop) => prop !== '$disablePadding',
})<{ $disablePadding?: boolean }>(({ $disablePadding }) => ({
  ...($disablePadding ? { padding: 0 } : {}),
}));
