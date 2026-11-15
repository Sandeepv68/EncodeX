import { styled } from '@mui/material/styles';
import { Typography } from '@mui/material';

/** Primary message line of the error banner. */
export const BannerMessageText = styled(Typography)({
  fontWeight: 500,
});

/** Technical detail line shown under the message when available. */
export const BannerDetailText = styled(Typography)(({ theme }) => ({
  display: 'block',
  opacity: 0.85,
  marginTop: theme.spacing(0.3),
}));
