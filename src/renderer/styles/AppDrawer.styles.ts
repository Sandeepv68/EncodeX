import { alpha, styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Divider, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { COLORS } from '../colors';

export const DrawerDivider = styled(Divider)(({ theme }) => ({
  borderColor: theme.palette.divider,
}));

export const NavList = styled(List)(({ theme }) => ({
  flex: 1,
  paddingInline: theme.spacing(1),
}));

const navItemIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(-8)}); }
  to { opacity: 1; transform: translateX(0); }
`;

export const NavItemButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  animation: `${navItemIn(theme)} 0.3s ease-out backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  '&.Mui-selected': {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.25) },
  },
}));

export const NavItemIcon = styled(ListItemIcon, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  minWidth: theme.typography.pxToRem(36),
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
}));

export const NavItemText = styled(ListItemText)(({ theme }) => ({
  '& .MuiListItemText-primary': { fontSize: theme.typography.pxToRem(14), fontWeight: 500, color: theme.palette.text.secondary },
}));

const blinkKeyframes = keyframes`
  0%, 60% { opacity: 1; }
  100% { opacity: 0.15; }
`;

const rippleKeyframes = (theme: Theme) => keyframes`
  0% { box-shadow: 0 0 0 0 ${COLORS.tint.error45}; }
  100% { box-shadow: 0 0 0 ${theme.typography.pxToRem(14)} ${COLORS.tint.error0}; }
`;

export const NavBlip = styled('span')(({ theme }) => ({
  width: theme.spacing(1),
  height: theme.spacing(1),
  borderRadius: '50%',
  backgroundColor: theme.palette.error.main,
  marginInlineStart: 'auto',
  flexShrink: 0,
  animation: `${blinkKeyframes} 1.2s ease-in-out infinite, ${rippleKeyframes(theme)} 1.2s ease-out infinite`,
}));

export const NavCountBadge = styled('span')(({ theme }) => ({
  minWidth: theme.spacing(2.5),
  height: theme.spacing(2.5),
  paddingInline: theme.spacing(0.75),
  borderRadius: theme.spacing(1.25),
  backgroundColor: theme.palette.error.main,
  color: theme.palette.error.contrastText,
  fontSize: theme.typography.pxToRem(11),
  fontWeight: 700,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  boxSizing: 'border-box',
  marginInlineStart: 'auto',
  flexShrink: 0,
  animation: `${blinkKeyframes} 1.2s ease-in-out infinite, ${rippleKeyframes(theme)} 1.2s ease-out infinite`,
}));
