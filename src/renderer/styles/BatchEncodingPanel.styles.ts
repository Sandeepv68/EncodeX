import { styled } from '@mui/material/styles';
import { Box, Paper, Typography } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';
import { AccelAlert, LockedAlert } from './BatchQueue.styles';

export const EncodingPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const EncodingTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Options-locked warning alert with bottom spacing above the grid. @const OptionsLockedAlert */
export const OptionsLockedAlert = styled(LockedAlert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

/** Options-editable info alert with bottom spacing above the grid. @const OptionsEditableAlert */
export const OptionsEditableAlert = styled(AccelAlert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

/** Wrapper around the profile selector block. @const ProfileSection */
export const ProfileSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Row holding the horizontal and vertical mirror switches. @const MirrorRow */
export const MirrorRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  minHeight: theme.typography.pxToRem(40),
}));

/** Inline pair of a mirror switch and its caption. @const MirrorToggle */
export const MirrorToggle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
});

/** Row holding the demux stream-kind switches. @const DemuxKindRow */
export const DemuxKindRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  flexWrap: 'wrap',
}));
