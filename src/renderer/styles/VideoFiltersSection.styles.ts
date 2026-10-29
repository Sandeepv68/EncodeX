import { styled } from '@mui/material/styles';
import { Box, Stack, TextField } from '@mui/material';

/** Row holding the preset picker, the custom chain field and the add button. @const FiltersTopRow */
export const FiltersTopRow = styled(Stack)({
  flexWrap: 'wrap',
  alignItems: 'center',
});

/** Preset picker select with a fixed minimum width. @const PresetSelect */
export const PresetSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(220),
}));

/** Custom chain input that grows to fill the remaining row width. @const CustomChainInput */
export const CustomChainInput = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(320),
  flexGrow: 1,
}));

/** Stack holding the pending preset parameters and its add button. @const PendingPresetPanel */
export const PendingPresetPanel = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

/** Row of pending preset parameter inputs. @const ParamRow */
export const ParamRow = styled(Stack)({
  flexWrap: 'wrap',
});

/** Column wrapper for a single parameter input. @const ParamField */
export const ParamField = styled(Box)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(140),
}));

/** Wrapper around the list of applied filter entries. @const FilterEntriesBox */
export const FilterEntriesBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

/** Row holding one filter entry chip and its reorder/remove buttons. @const FilterEntryRow */
export const FilterEntryRow = styled(Stack)({
  alignItems: 'center',
});
