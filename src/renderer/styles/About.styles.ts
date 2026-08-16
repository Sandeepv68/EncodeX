import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

/** Centered application logo rendered at the top of the About page. @const AboutLogo */
export const AboutLogo = styled('img')(({ theme }) => ({
  display: 'block',
  maxWidth: '100%',
  maxHeight: theme.spacing(14),
  margin: '0 auto',
  objectFit: 'contain',
  userSelect: 'none',
}));

/** Bulleted list of the app's feature highlights. @const AboutFeatureList */
export const AboutFeatureList = styled('ul')(({ theme }) => ({
  margin: 0,
  paddingInlineStart: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

/** Single bullet in the feature highlight list. @const AboutFeatureItem */
export const AboutFeatureItem = styled('li')(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  lineHeight: theme.typography.body2.lineHeight,
  color: theme.palette.text.secondary,
}));

/** Label + value row for the version / built-with meta entries. @const AboutMetaRow */
export const AboutMetaRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

/** Fixed-width label shown beside each meta value. @const AboutMetaLabel */
export const AboutMetaLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  width: theme.spacing(12),
  color: theme.palette.text.primary,
}));
