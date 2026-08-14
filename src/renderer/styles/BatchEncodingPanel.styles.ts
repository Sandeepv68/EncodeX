import { styled } from '@mui/material/styles';
import { Paper, Typography } from '@mui/material';
import { SHADOWS } from '../colors';
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
