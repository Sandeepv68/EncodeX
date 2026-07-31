import { styled } from '@mui/material/styles';
import { Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';

export const DrawerHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

export const AppTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 700,
}));

export const ThemeToggleButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

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
    backgroundColor: 'rgba(15,155,142,0.15)',
    '&:hover': { backgroundColor: 'rgba(15,155,142,0.25)' },
  },
}));

export const NavItemIcon = styled(ListItemIcon, {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  minWidth: 36,
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
}));

export const NavItemText = styled(ListItemText)({
  '& .MuiListItemText-primary': { fontSize: 14 },
});
