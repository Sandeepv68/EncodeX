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
  borderTop: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
}));

export const FooterVersionText = styled(Typography)({ fontWeight: 'bold' });

export const FooterRight = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const FfmpegBanner = styled('img')({ height: 30 });
