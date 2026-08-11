import { styled } from '@mui/material/styles';
import { Box, MenuItem } from '@mui/material';

export const GroupHeader = styled(MenuItem)(({ theme }) => ({
  fontWeight: 700,
  opacity: '1 !important',
  cursor: 'default',
  fontSize: theme.typography.pxToRem(12.8),
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.primary.main,
  paddingTop: theme.spacing(0.75),
  paddingBottom: theme.spacing(0.75),
  borderBottom: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: theme.palette.action.selected,
    color: theme.palette.primary.main,
  },
}));

export const GroupLabel = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

export const GroupHeaderIconBox = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
  display: 'inline-flex',
}));
