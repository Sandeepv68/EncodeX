import { styled } from '@mui/material/styles';
import { Box, Chip, Paper, Typography, Alert } from '@mui/material';
import { SHADOWS, COLORS } from '../colors';

export const AccelAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.info,
}));

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '& .MuiTypography-root': {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
  },
}));

export const SectionsStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const SectionPaper = styled(Paper)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
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
