import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

export const FooterBox = styled('footer')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  borderTop: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
}));

export const FooterVersionText = styled(Typography)({ fontWeight: 'bold' });

export const FooterRight = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const FfmpegBanner = styled('img')(({ theme }) => ({ height: theme.typography.pxToRem(30) }));
