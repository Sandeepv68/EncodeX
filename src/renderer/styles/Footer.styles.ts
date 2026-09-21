import { styled } from '@mui/material/styles';
import { Box, Typography, CircularProgress, LinearProgress, Button, IconButton } from '@mui/material';
import { FOOTER_HEIGHT } from '../../shared/app-constants';

export const FooterBox = styled('footer')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
  height: theme.typography.pxToRem(FOOTER_HEIGHT),
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingInline: theme.spacing(2),
  borderTop: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
  boxSizing: 'border-box',
}));

export const FooterVersionText = styled(Typography)({ fontWeight: 'bold' });

export const FooterLeft = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  minWidth: 0,
}));

export const FooterRight = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const FfmpegBanner = styled('img')(({ theme }) => ({ height: theme.typography.pxToRem(30) }));

export const UpdateLoader = styled(CircularProgress)(({ theme }) => ({
  color: theme.palette.text.secondary,
  width: theme.typography.pxToRem(14),
  height: theme.typography.pxToRem(14),
}));

export const UpdateLink = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  cursor: 'pointer',
  fontSize: theme.typography.pxToRem(11),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

export const UpdateWidget = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  minWidth: 0,
  overflow: 'hidden',
}));

export const UpdateWidgetText = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

export const UpdateProgressTrack = styled(LinearProgress)(({ theme }) => ({
  width: theme.typography.pxToRem(110),
  height: theme.typography.pxToRem(6),
  borderRadius: theme.typography.pxToRem(3),
  flexShrink: 0,
}));

export const UpdateActionButton = styled(Button)(({ theme }) => ({
  minWidth: 0,
  paddingInline: theme.spacing(1),
  paddingTop: theme.spacing(0.25),
  paddingBottom: theme.spacing(0.25),
  fontSize: theme.typography.pxToRem(11),
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
}));

export const UpdateIconButton = styled(IconButton)(({ theme }) => ({
  padding: 0,
  fontSize: theme.typography.pxToRem(13),
  color: theme.palette.text.secondary,
  flexShrink: 0,
}));
