import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, Alert, Paper, Divider, Button } from '@mui/material';
import { COLORS, SHADOWS } from '../colors';

/** Unboxed form section: heading + fields stacked with the card gap. @const PageSection */
export const PageSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const AccelAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.info,
}));

export const CompatAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
  color: COLORS.alert.warning,
}));

export const ActionStack = styled(Stack)({ flexWrap: 'wrap' });

/** Centered loading-spinner container in the media-info preview. @const LoadingBox */
export const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(2),
}));

/** Selected input file shown beside the "change file" button. @const SelectedFileRow */
export const SelectedFileRow = styled(Stack)({
  alignItems: 'center',
});

/** Selected input file path, allowed to break onto multiple lines. @const SelectedFileName */
export const SelectedFileName = styled(Typography)({
  wordBreak: 'break-all',
});

/** "Show Preview" button aligned to the start of the section. @const ShowPreviewButton */
export const ShowPreviewButton = styled(Button)({
  alignSelf: 'flex-start',
});

export const PreviewPanel = styled(Paper)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  [theme.breakpoints.up('md')]: {
    width: theme.typography.pxToRem(380),
    flexShrink: 0,
    alignSelf: 'flex-start',
    position: 'sticky',
    top: theme.spacing(2),
    marginTop: theme.typography.pxToRem(32.02 + 16),
  },
}));

export const PreviewHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

export const PreviewDivider = styled(Divider)(({ theme }) => ({
  marginInline: -theme.spacing(2),
}));

export const PreviewSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  marginBottom: theme.spacing(1),
}));
