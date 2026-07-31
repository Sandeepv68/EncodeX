import { styled } from '@mui/material/styles';
import { Box, Typography, IconButton } from '@mui/material';

export const BannerRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$tone' && prop !== '$tint',
})<{ $tone: string; $tint: string }>(({ theme, $tone, $tint }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $tint,
  border: `${theme.typography.pxToRem(1)} solid ${$tone}33`,
}));

export const BannerIconBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: string }>(({ theme, $tone }) => ({
  color: $tone,
  marginTop: theme.spacing(0.3),
  display: 'flex',
}));

export const BannerMessageBox = styled(Box)({ flex: 1 });

export const BannerMessageText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: string }>(({ $tone }) => ({ fontWeight: 600, color: $tone }));

export const BannerDetailText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: string }>(({ theme, $tone }) => ({
  color: $tone,
  opacity: 0.8,
  display: 'block',
  marginTop: theme.spacing(0.3),
}));

export const BannerCloseButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: string }>(({ theme, $tone }) => ({
  color: $tone,
  marginTop: theme.spacing(-0.3),
}));
