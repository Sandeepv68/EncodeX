import { styled } from '@mui/material/styles';
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

export const NavItemButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  '&.Mui-selected': {
    backgroundColor: COLORS.tint.primary15,
    '&:hover': { backgroundColor: COLORS.tint.primary25 },
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
