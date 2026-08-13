import { alpha, styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { COLORS } from '../colors';
import { DRAWER_WIDTH_CONDENSED } from '../../shared/app-constants';

/**
 * Minimum width of a nav icon slot. The condensed drawer is
 * `DRAWER_WIDTH_CONDENSED` wide with `NAV_LIST_INLINE_PADDING` of horizontal
 * padding on each side, so each row must set its `padding-inline` to
 * `DRAWER_WIDTH_CONDENSED / 2 - NAV_LIST_INLINE_PADDING - ICON_MIN_WIDTH / 2`
 * to place the icon at the drawer's exact center. Reusing that same padding
 * while expanded keeps the icon (and any blip/badge resting on it) at a fixed
 * screen position across the toggle.
 * @const {number} ICON_MIN_WIDTH
 * @const {number} NAV_LIST_INLINE_PADDING
 */
const ICON_MIN_WIDTH = 36;
const NAV_LIST_INLINE_PADDING = 8;

export const DrawerDivider = styled(Divider)(({ theme }) => ({
  borderColor: theme.palette.divider,
}));

export const NavFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  height: theme.typography.pxToRem(52),
}));

export const CondenseButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  width: theme.typography.pxToRem(24),
  height: theme.typography.pxToRem(24),
  '& svg': { fontSize: theme.typography.pxToRem(12) },
}));

export const NavList = styled(List)(({ theme }) => ({
  flex: 1,
  paddingInline: theme.spacing(1),
}));

const navItemIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(-8)}); }
  to { opacity: 1; transform: translateX(0); }
`;

export const NavItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  paddingInline: theme.typography.pxToRem(DRAWER_WIDTH_CONDENSED / 2 - NAV_LIST_INLINE_PADDING - ICON_MIN_WIDTH / 2),
  animation: `${navItemIn(theme)} 0.3s ease-out backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  ...($condensed && {
    minHeight: theme.typography.pxToRem(52),
    marginBottom: theme.spacing(1.5),
  }),
  '&.Mui-selected': {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.25) },
  },
}));

export const NavItemIcon = styled(ListItemIcon, {
  shouldForwardProp: (prop) => prop !== '$active' && prop !== '$condensed',
})<{ $active: boolean; $condensed: boolean }>(({ theme, $active, $condensed }) => ({
  minWidth: theme.typography.pxToRem(ICON_MIN_WIDTH),
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'font-size 0.2s ease',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  ...($condensed && {
    fontSize: theme.typography.pxToRem(22),
  }),
}));

const navLabelIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(-4)}); }
  to { opacity: 1; transform: translateX(0); }
`;

export const NavItemText = styled(ListItemText)(({ theme }) => ({
  minWidth: 0,
  whiteSpace: 'nowrap',
  animation: `${navLabelIn(theme)} 0.25s ease-out backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  '& .MuiListItemText-primary': {
    fontSize: theme.typography.pxToRem(14),
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
}));

const blinkKeyframes = keyframes`
  0%, 60% { opacity: 1; }
  100% { opacity: 0.15; }
`;

const rippleKeyframes = (theme: Theme) => keyframes`
  0% { box-shadow: 0 0 0 0 ${COLORS.tint.error45}; }
  100% { box-shadow: 0 0 0 ${theme.typography.pxToRem(14)} ${COLORS.tint.error0}; }
`;

export const NavBlip = styled('span', {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => ({
  width: theme.spacing(1),
  height: theme.spacing(1),
  borderRadius: '50%',
  backgroundColor: theme.palette.error.main,
  marginInlineStart: 'auto',
  flexShrink: 0,
  animation: `${blinkKeyframes} 1.2s ease-in-out infinite, ${rippleKeyframes(theme)} 1.2s ease-out infinite`,
  ...($condensed && {
    position: 'absolute',
    top: theme.spacing(0.75),
    insetInlineEnd: theme.spacing(0.75),
    marginInlineStart: 0,
  }),
}));

export const NavCountBadge = styled('span', {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => ({
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
  ...($condensed && {
    position: 'absolute',
    top: theme.spacing(0.5),
    insetInlineEnd: theme.spacing(0.25),
    marginInlineStart: 0,
  }),
}));
