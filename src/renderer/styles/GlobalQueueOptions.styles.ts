import { styled } from '@mui/material/styles';
import { Paper, TextField } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';
import { FieldBox } from './form.styles';

/**
 * Page-level bar holding the queue options that apply to every queue (all
 * tabs). It sits above the tab bar so its scope is clear: the controls are
 * not tied to the currently selected queue.
 * @const GlobalOptionsBar
 */
export const GlobalOptionsBar = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1),
  marginBottom: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

/** Select kept at its content width inside the global options bar. @const GlobalOptionsSelect */
export const GlobalOptionsSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(130),
}));

/** Field wrapper of the global options bar. @const GlobalOptionsFieldBox */
export const GlobalOptionsFieldBox = styled(FieldBox)({
  flex: '0 0 auto',
});
