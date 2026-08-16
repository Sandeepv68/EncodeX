import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { IconButton, Paper, TextField, Box, FormControlLabel } from '@mui/material';
import { SHADOWS } from '../colors';
import { FieldBox } from './form.styles';
import { AccelAlert } from './BatchQueue.styles';

export const ControlsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const OutlinedIconButton = styled(IconButton)(({ theme }) => ({
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[600],
  },
}));

export const OperationSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(140),
}));

export const TranscoderSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(110),
}));

export const ConcurrencySelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(130),
}));

export const SuffixField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(120),
}));

export const OutputDirField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(220),
}));

export const WhenDoneSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(130),
}));

/**
 * Vertical offset aligning a label-less control (icon button or checkbox) with
 * the input of a labeled FieldBox. Labeled fields are taller than the controls
 * because of the FieldLabel caption above the input; nudging the label-less
 * siblings down by the caption block height centers them on the field instead
 * of the whole label+field block.
 * @param {Theme} theme - The MUI theme (provides spacing/typography units).
 * @returns {string} A CSS calc() expression matching the FieldLabel height.
 */
const fieldLabelOffset = (theme: Theme): string => `calc(${theme.spacing(0.5)} + ${theme.typography.pxToRem(12)} * 1.2)`;

/** Hardware-acceleration alert with bottom spacing above the grid. @const ToolbarAlert */
export const ToolbarAlert = styled(AccelAlert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

/** Icon/checkbox action row that wraps onto new lines on narrow screens. @const ToolbarRow */
export const ToolbarRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/** Output-folder field sized to one sixth of the toolbar row. @const OutputDirFieldBox */
export const OutputDirFieldBox = styled(FieldBox)(({ theme }) => ({
  flex: '0 0 16.6667%',
  minWidth: theme.typography.pxToRem(220),
}));

/** "When done" action select kept at its content width. @const WhenDoneFieldBox */
export const WhenDoneFieldBox = styled(FieldBox)({
  flex: '0 0 auto',
});

/** Browse button aligned to the output-folder field's input. @const BrowseButton */
export const BrowseButton = styled(OutlinedIconButton)(({ theme }) => ({
  marginTop: fieldLabelOffset(theme),
}));

/** Inline checkbox (with leading margin) aligned to a labeled field's input. @const AlignedCheckbox */
export const AlignedCheckbox = styled(FormControlLabel)(({ theme }) => ({
  whiteSpace: 'nowrap',
  marginLeft: theme.spacing(1),
  marginTop: fieldLabelOffset(theme),
}));

/** Force-quit checkbox aligned to a labeled field's input. @const ForceCheckbox */
export const ForceCheckbox = styled(FormControlLabel)(({ theme }) => ({
  whiteSpace: 'nowrap',
  marginTop: fieldLabelOffset(theme),
}));
