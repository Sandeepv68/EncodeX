import { styled } from '@mui/material/styles';
import { Box, Paper, TextField, Typography } from '@mui/material';

/** Highlighted search match span */
export const HighlightMark = styled('span')(({ theme }) => ({
  backgroundColor: theme.palette.warning.light,
  color: theme.palette.warning.contrastText,
  borderRadius: theme.typography.pxToRem(2),
  paddingInline: theme.typography.pxToRem(2),
}));

/** Icon wrapper in each profile option row */
export const OptionIcon = styled(Box)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(30),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.typography.pxToRem(18),
  marginTop: theme.typography.pxToRem(3),
  flexShrink: 0,
}));

/** Inline SVG used to render `simple-icons` brand logos (fill via attribute). */
export const BrandSvg = styled('svg')({
  display: 'block',
  flexShrink: 0,
  width: '1em',
  height: '1em',
});

/**
 * Small monochrome "format badge" used for codecs/containers/formats that have no
 * official logo (MP4, MKV, FLAC, JPEG, ...). The format's brand color is applied
 * to the text and border so the family of badges stays consistent across themes.
 */
export const FormatBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color' && prop !== '$large',
})<{ $color: string; $large?: boolean }>(({ theme, $color, $large }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.typography.pxToRem($large ? 40 : 28),
  height: theme.typography.pxToRem($large ? 30 : 20),
  paddingInline: theme.typography.pxToRem($large ? 6 : 4),
  marginRight: theme.typography.pxToRem($large ? 8 : 6),
  borderRadius: theme.typography.pxToRem($large ? 7 : 5),
  border: `${theme.typography.pxToRem(1)} solid ${$color}`,
  color: $color,
  fontSize: theme.typography.pxToRem($large ? 14 : 10),
  fontWeight: 700,
  letterSpacing: theme.typography.pxToRem(0.2),
  lineHeight: 1,
  textTransform: 'uppercase',
}));

/** Content wrapper (name + description) in each profile option row */
export const OptionContent = styled(Box)({
  minWidth: 0,
  flex: 1,
});

/**
 * The option row itself (list item rendered inside the Autocomplete listbox).
 * `position: relative` anchors the absolutely positioned check/delete icons,
 * and `alignItems: flex-start` keeps multi-line content top-aligned.
 * @const OptionItem
 */
export const OptionItem = styled('li')({
  position: 'relative',
  alignItems: 'flex-start',
});

/** Description line below the profile name */
export const OptionDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

/** Active profile checkmark — position varies for builtin vs custom profiles */
export const ActiveCheck = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$inlineEndPx',
})<{ $inlineEndPx: number }>(({ theme, $inlineEndPx }) => ({
  position: 'absolute',
  insetInlineEnd: theme.typography.pxToRem($inlineEndPx),
  top: '50%',
  transform: 'translateY(-50%)',
  color: theme.palette.primary.main,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 'bold',
  lineHeight: 1,
}));

/** Delete button icon on custom profiles */
export const DeleteIcon = styled(Box)(({ theme }) => ({
  position: 'absolute',
  insetInlineEnd: theme.typography.pxToRem(14),
  top: '50%',
  transform: 'translateY(-50%)',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12.8),
  lineHeight: 1,
  cursor: 'pointer',
  padding: theme.spacing(0.5),
  borderRadius: theme.spacing(1),
  display: 'flex',
  '&:hover': { color: theme.palette.error.main },
}));

/** Category group header bar */
export const GroupHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  fontWeight: 700,
  cursor: 'default',
  fontSize: theme.typography.pxToRem(12.8),
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.primary.main,
  borderRadius: theme.typography.pxToRem(8),
  marginInline: theme.typography.pxToRem(6),
  marginBlock: theme.typography.pxToRem(2),
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(0.75),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  '&:hover': { backgroundColor: theme.palette.action.selected },
}));

/** Category icon in the group header */
export const GroupIcon = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
  display: 'inline-flex',
}));

/** "Create Custom Profile" card appended to the bottom of the dropdown */
export const CreateNewCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginInline: theme.typography.pxToRem(6),
  marginBlock: theme.typography.pxToRem(2),
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(1),
  borderRadius: theme.typography.pxToRem(8),
  border: `${theme.typography.pxToRem(1)} dashed ${theme.palette.divider}`,
  cursor: 'pointer',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 500,
  transition: 'background-color 120ms ease, border-color 120ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
}));

/** Popup chevron icon */
export const PopupIcon = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  fontSize: theme.typography.pxToRem(12),
}));

/** Small icon inside the create-new card */
export const CreateNewIcon = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  fontSize: theme.typography.pxToRem(12),
}));

/** Unstyled list wrapper for autocomplete group children */
export const GroupList = styled('ul')({
  padding: 0,
  listStyle: 'none',
});

/** Search text field inside the Autocomplete */
export const SearchTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
    paddingLeft: theme.typography.pxToRem(14),
  },
  '& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiOutlinedInput-input': {
    paddingLeft: theme.typography.pxToRem(14),
  },
}));

/** Full-width wrapper around the profile autocomplete */
export const SelectorAutocompleteBox = styled(Box)(({ theme }) => ({
  width: '100%',
  // The popup indicator is rendered inside the Autocomplete root, so it can be
  // targeted from the wrapper instead of reaching into the component's slots.
  '& .MuiAutocomplete-popupIndicator': {
    color: theme.palette.text.secondary,
    padding: theme.spacing(0.5),
  },
}));

/** Full-width wrapper around the active-profile chip */
export const SelectorFullWidthBox = styled(Box)({
  width: '100%',
});

/** Row that holds the active-profile chip */
export const ActiveProfileRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

/** Dropdown surface of the profile autocomplete (list + create-new card) */
export const DropdownPaper = styled(Paper)(({ theme }) => ({
  '& .MuiAutocomplete-listbox': {
    maxHeight: theme.typography.pxToRem(360),
  },
}));
