import { styled, keyframes, alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, LinearProgress } from '@mui/material';
import { OVERLAY_COLORS, SHADOWS } from '../colors';

const gradientSlide = (theme: Theme) => keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(${theme.typography.pxToRem(-400)}); }
`;

export const ProgressTrack = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'paused' && prop !== 'shadowed',
})<{ paused?: boolean; shadowed?: boolean }>(({ theme, paused, shadowed }) => ({
  height: theme.typography.pxToRem(8),
  borderRadius: theme.shape.borderRadius,
  boxShadow: shadowed ? (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT) : undefined,
  backgroundColor: paused ? alpha(theme.palette.warning.main, 0.3) : undefined,
  transition: 'background-color 0.5s ease',
  '& .MuiLinearProgress-bar': {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    willChange: 'transform',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      insetInlineStart: 0,
      width: `calc(100% + ${theme.typography.pxToRem(400)})`,
      backgroundImage: `repeating-linear-gradient(45deg, ${OVERLAY_COLORS.white18} ${theme.typography.pxToRem(0)}, ${OVERLAY_COLORS.white18} ${theme.typography.pxToRem(17.6777)}, ${OVERLAY_COLORS.white0} ${theme.typography.pxToRem(17.6777)}, ${OVERLAY_COLORS.white0} ${theme.typography.pxToRem(35.3553)}), repeating-linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.success.main}, ${theme.palette.primary.main} ${theme.typography.pxToRem(400)})`,
      animation: `${gradientSlide(theme)} 8s linear infinite`,
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      insetInlineStart: 0,
      width: `calc(100% + ${theme.typography.pxToRem(400)})`,
      backgroundImage: `repeating-linear-gradient(45deg, ${OVERLAY_COLORS.white18} ${theme.typography.pxToRem(0)}, ${OVERLAY_COLORS.white18} ${theme.typography.pxToRem(17.6777)}, ${OVERLAY_COLORS.white0} ${theme.typography.pxToRem(17.6777)}, ${OVERLAY_COLORS.white0} ${theme.typography.pxToRem(35.3553)}), repeating-linear-gradient(90deg, ${theme.palette.warning.light}, ${theme.palette.warning.main}, ${theme.palette.warning.dark}, ${theme.palette.warning.light} ${theme.typography.pxToRem(400)})`,
      animation: `${gradientSlide(theme)} 8s linear infinite`,
      opacity: paused ? 1 : 0,
      transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiLinearProgress-bar::before': {
      animation: 'none',
    },
    '& .MuiLinearProgress-bar::after': {
      animation: 'none',
    },
  },
}));

export const ProgressInfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: theme.spacing(0.5),
}));

/** Visually hidden completion announcement for screen readers. @const SrOnlyStatus */
export const SrOnlyStatus = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: theme.typography.pxToRem(1),
  height: theme.typography.pxToRem(1),
  margin: theme.spacing(-1),
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
}));
