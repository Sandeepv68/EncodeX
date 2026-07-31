import { styled } from '@mui/material/styles';
import { Box, MenuItem } from '@mui/material';

export const GroupHeader = styled(MenuItem)(({ theme }) => ({
  fontWeight: 700,
  opacity: '1 !important',
  cursor: 'default',
  fontSize: '0.8rem',
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.primary.main,
  paddingTop: theme.spacing(0.75),
  paddingBottom: theme.spacing(0.75),
  borderBottom: '1px solid',
  borderColor: theme.palette.divider,
}));

export const GroupLabel = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

export const GroupHeaderIconBox = styled(Box)({ fontSize: 16, display: 'inline-flex' });
