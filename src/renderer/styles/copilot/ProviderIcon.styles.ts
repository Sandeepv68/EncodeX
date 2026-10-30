import { styled } from '@mui/material/styles';

/**
 * Brand logo of an AI provider, rendered as an image and sized to the
 * requested edge length.
 */
export const ProviderLogo = styled('img', {
  shouldForwardProp: (prop) => prop !== '$size',
})<{ $size: number }>(({ theme, $size }) => ({
  width: theme.typography.pxToRem($size),
  height: theme.typography.pxToRem($size),
  flexShrink: 0,
}));

/** Generic robot glyph shown when a provider has no bundled logo. */
export const ProviderGlyph = styled('span', {
  shouldForwardProp: (prop) => prop !== '$size',
})<{ $size: number }>(({ theme, $size }) => ({
  display: 'inline-flex',
  fontSize: theme.typography.pxToRem($size),
  flexShrink: 0,
}));
