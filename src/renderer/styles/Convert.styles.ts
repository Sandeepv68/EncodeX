import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, Alert, Paper } from '@mui/material';
import { COLORS, SHADOWS } from '../colors';

export const AccelAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.info,
}));

export const CompatAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.warning,
}));

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '& .MuiTypography-root.MuiTypography-caption': {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
  },
}));

export const FieldBox = styled(Box)({ flex: 1 });

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const ActionStack = styled(Stack)({ flexWrap: 'wrap' });

export const ConvertLayout = styled(Stack)(({ theme }) => ({
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: theme.spacing(2),
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
}));

export const FormColumn = styled(Box)(({ theme }) => ({
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const PreviewPanel = styled(Paper)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
  [theme.breakpoints.up('md')]: {
    width: 380,
    flexShrink: 0,
    alignSelf: 'flex-start',
    position: 'sticky',
    top: theme.spacing(2),
  },
}));

export const PreviewHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

export const PreviewSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  marginBottom: theme.spacing(1),
}));
