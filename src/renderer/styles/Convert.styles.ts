import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, Alert, Paper, Divider, Button } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';
import type { ElementType } from 'react';

/** Unboxed form section: heading + fields stacked with the card gap. @const PageSection */
export const PageSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const AccelAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
}));

export const CompatAlert = styled(Alert)(({}) => ({
  fontWeight: 500,
}));

export const ActionStack = styled(Stack)({ flexWrap: 'wrap' });

/** Centered loading-spinner container in the media-info preview. @const LoadingBox */
export const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(2),
}));

/** Selected input file shown beside the "change file" and "show preview" buttons. @const SelectedFileRow */
export const SelectedFileRow = styled(Stack)({
  alignItems: 'center',
  flexWrap: 'wrap',
});

/** Selected input file path, allowed to break onto multiple lines. @const SelectedFileName */
export const SelectedFileName = styled(Typography)({
  wordBreak: 'break-all',
});

/** "Show Preview" button shown inline beside the "change file" button. @const ShowPreviewButton */
export const ShowPreviewButton = styled(Button)({});

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

/** Row holding the "view more" / "view less" toggle under the file summary. @const PreviewActionsStack */
export const PreviewActionsStack = styled(Stack)({
  justifyContent: 'center',
});

/**
 * Chevron glyph of the "view more" / "view less" toggle. Rotates 180 degrees
 * while the stream list is expanded.
 * @param {boolean} [$expanded] - True while the stream list is expanded.
 */
export const ChevronIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$expanded',
})<{ $expanded: boolean; component?: ElementType }>(({ theme, $expanded }) => ({
  display: 'inline-flex',
  transform: $expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: theme.transitions.create('transform', { duration: theme.transitions.duration.short }),
}));

/** Inline notice shown under the transcoder selector (BMF availability). @const BmfNoticeText */
export const BmfNoticeText = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginTop: theme.spacing(0.5),
}));
