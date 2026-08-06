import { alpha, styled, keyframes } from '@mui/material/styles';
import { Divider, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { COLORS } from '../colors';

export const DrawerDivider = styled(Divider)(({ theme }) => ({
  borderColor: theme.palette.divider,
}));

export const NavList = styled(List)(({ theme }) => ({
  flex: 1,
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
}));

const navItemIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
`;

export const NavItemButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  animation: `${navItemIn} 0.3s ease-out backwards`,
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

const rippleKeyframes = keyframes`
  0% { box-shadow: 0 0 0 0 ${COLORS.tint.error45}; }
  100% { box-shadow: 0 0 0 14px ${COLORS.tint.error0}; }
`;

export const NavBlip = styled('span')(({ theme }) => ({
  width: theme.spacing(1),
  height: theme.spacing(1),
  borderRadius: '50%',
  backgroundColor: theme.palette.error.main,
  marginInlineStart: 'auto',
  flexShrink: 0,
  animation: `${blinkKeyframes} 1.2s ease-in-out infinite, ${rippleKeyframes} 1.2s ease-out infinite`,
}));
