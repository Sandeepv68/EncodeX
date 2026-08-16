import { styled } from '@mui/material/styles';
import { Box, Chip, Alert, Stack } from '@mui/material';
import { COLORS } from '../colors';

export const AccelAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.info,
}));

export const SectionsStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

export const HeadingGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const FileChip = styled(Chip)(({ theme }) => ({
  maxWidth: '100%',
  flexShrink: 1,
  minWidth: 0,
  borderRadius: theme.shape.borderRadius,
  '& .MuiChip-label': {
    minWidth: 0,
  },
}));

/** Cut action buttons row that wraps onto new lines on narrow screens. @const ActionRow */
export const ActionRow = styled(Stack)({
  flexWrap: 'wrap',
});
