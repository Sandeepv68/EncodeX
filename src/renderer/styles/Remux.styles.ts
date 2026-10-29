import { styled } from '@mui/material/styles';
import { Box, Stack, TextField, Typography } from '@mui/material';

/** Row holding the "select all" / "select none" stream buttons, right-aligned. @const StreamsHeaderBox */
export const StreamsHeaderBox = styled(Box)({
  display: 'flex',
  justifyContent: 'flex-end',
});

/** Button row of the stream table header, sitting above the table. @const StreamsSelectStack */
export const StreamsSelectStack = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Stack listing the added subtitle/audio tracks. @const AddedTrackList */
export const AddedTrackList = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

/** One added track row: its name, its codec/delay field, and the remove button. @const AddedTrackRow */
export const AddedTrackRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/** Track name that grows to fill the free space of its row. @const FlexibleText */
export const FlexibleText = styled(Typography)({
  flex: 1,
});

/** Codec picker of an added subtitle track. @const SubtitleCodecField */
export const SubtitleCodecField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(140),
}));

/** Numeric audio-delay field of an added audio track. @const SyncOffsetField */
export const SyncOffsetField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(130),
  maxWidth: theme.typography.pxToRem(170),
}));

/** Column holding the chapter import controls. @const ChaptersColumn */
export const ChaptersColumn = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

/** One compatibility warning line in the warnings panel. @const WarningRow */
export const WarningRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
}));
