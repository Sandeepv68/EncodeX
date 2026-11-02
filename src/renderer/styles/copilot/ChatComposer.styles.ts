import { styled } from '@mui/material/styles';
import { Box, Chip, IconButton, LinearProgress, Paper, Popper } from '@mui/material';
import { COLORS, SHADOWS } from '../../../shared/theme/colors';

/**
 * Bottom-pinned composer bar. Sits below the conversation scroller and owns the
 * attachment chips, the Lexical input, and the action row.
 */
export const ComposerBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: theme.spacing(1),
  maxWidth: '80%',
  marginInline: 'auto',
  paddingInline: theme.spacing(1),
  paddingBottom: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(2) },
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(3) },
  // The primary accent sits below the WCAG AA 4.5:1 minimum on the default background
  // (about 4.4:1 in light mode, 4.1:1 in dark). Use the darker shade on light surfaces
  // and the lighter shade on dark surfaces so the text buttons clear the threshold.
  '& .MuiButton-text': {
    color: theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light,
  },
}));

/**
 * Stacks the attachment cards over the input field. The wrapper is the
 * positioning context for the cards so they can float above the composer while
 * the input stays the topmost layer.
 */
export const ComposerStack = styled(Box)({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
});

/**
 * The removable attachment cards. They are centred on the input field, and the
 * input is pulled up over their lower edge so the two read as a stack of
 * sheets: the card's own bottom padding keeps a visible gap between the file
 * name and the input field.
 */
export const AttachmentRow = styled(Box)(({ theme }) => ({
  position: 'relative',
  zIndex: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  width: '100%',
  maxWidth: theme.typography.pxToRem(750),
  marginInline: 'auto',
  // Pull the row up so the input sheet overlaps the cards' lower edge.
  marginBottom: `-${theme.spacing(1.5)}`,
}));
/**
 * Wrapper around the input field. It sits above the cards in the stacking
 * order so the input sheet covers the cards' lower edge and the two read as a
 * stack of paper.
 */
export const InputLayer = styled(Box)({
  position: 'relative',
  zIndex: 1,
  width: '100%',
});
/** Row holding the attachment/settings actions below the input. */
export const ActionsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(0.5),
  flexWrap: 'wrap',
}));

/** Left-hand cluster of secondary actions (files, folder, advanced, AI settings). */
export const LeftActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

/** Right-hand cluster of the action row: the AI connection status. */
export const RightActions = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$plain',
})<{ $plain?: boolean }>(({ theme, $plain }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  marginInlineStart: 'auto',
  paddingInline: theme.spacing(0.75),
  paddingBlock: theme.spacing(0.5),
  borderRadius: theme.typography.pxToRem(999),
  backgroundColor: $plain ? 'transparent' : theme.palette.action.hover,
  border: $plain ? 0 : `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  transition: theme.transitions.create(['padding-inline']),
  '&:hover .copilot-ai-status-text': {
    maxWidth: theme.typography.pxToRem(420),
    opacity: 1,
    marginInlineStart: theme.spacing(0.75),
  },
  '&:hover': {
    paddingInline: $plain ? 0 : theme.spacing(1),
  },
}));

/** Caption naming the connected AI provider (or the disconnected state). */
export const ConnectionStatus = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

/** Status dot: green when a provider is connected, muted otherwise. */
export const ConnectionDot = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme, $connected }) => ({
  width: theme.spacing(0.75),
  height: theme.spacing(0.75),
  borderRadius: '50%',
  flexShrink: 0,
  backgroundColor: $connected ? theme.palette.success.light : theme.palette.text.disabled,
  boxShadow: $connected ? `0 0 0 ${theme.typography.pxToRem(4)} ${theme.palette.success.main}14` : 'none',
}));

/** Popover panel for the advanced controls (operation, query, target language). */
export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: theme.typography.pxToRem(280),
}));

/**
 * Paper card describing one selected file/folder. It mirrors the composer
 * shell (paper background, divider border, soft shadow) but is shorter and
 * narrower than the input field itself, and only its top corners are rounded:
 * the sheet continues behind the input, so its bottom edge is never seen.
 *
 * The surface is an off-white grey, a shade off the input's white paper, so
 * the card reads as a separate sheet lying under it.
 *
 * The card's bottom padding is the gap between the name and the input field;
 * the input overlaps the lower half of it, which keeps the row vertically
 * centred in the band that stays visible.
 */
export const AttachmentCard = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  minWidth: 0,
  width: '90%',
  paddingBlockStart: theme.spacing(1.5),
  paddingBlockEnd: theme.spacing(3),
  paddingInlineStart: theme.spacing(1.25),
  paddingInlineEnd: theme.spacing(0.25),
  borderRadius: `${theme.typography.pxToRem(16)} ${theme.typography.pxToRem(16)} 0 0`,
  backgroundColor: theme.palette.mode === 'dark' ? COLORS.composer.cardDark : COLORS.composer.cardLight,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  overflow: 'hidden',
  '&[role="button"]': {
    cursor: 'pointer',
  },
}));

/**
 * Row inside the card: the file/folder name on the left and the close button
 * on the right, both vertically centred.
 */
export const AttachmentCardRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

/** File/folder icon shown before the name inside the card. */
export const AttachmentIcon = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  fontSize: theme.typography.pxToRem(14),
  color: theme.palette.text.secondary,
}));

/** File/folder name shown inside the card. */
export const AttachmentName = styled('span')(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  fontSize: theme.typography.pxToRem(13),
  color: theme.palette.text.primary,
}));

/** Chip appended to a folder card showing how many files it contains. */
export const AttachmentCountChip = styled(Chip)(({ theme }) => ({
  flexShrink: 0,
  height: 'auto',
  fontSize: theme.typography.pxToRem(11),
  '& .MuiChip-label': {
    paddingInline: theme.spacing(0.75),
    paddingBlock: theme.spacing(0.25),
  },
}));

/** Close (remove) button shown inside the card, aligned to the right. */
export const AttachmentRemoveButton = styled(IconButton)(({ theme }) => ({
  flexShrink: 0,
  marginInlineStart: 'auto',
  padding: theme.spacing(0.25),
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

/** Caption shown while the file picker is still resolving. */
export const AttachmentLoadingLabel = styled('span')(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: theme.typography.pxToRem(13),
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
}));

/** Indeterminate progress bar shown inside the loading card. */
export const ChipProgress = styled(LinearProgress)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(4),
  borderRadius: theme.typography.pxToRem(4),
  marginBlockStart: theme.spacing(0.5),
}));

/** Panel listing the files inside a folder, shown when its card is clicked. */
export const AttachmentFileList = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  minWidth: theme.typography.pxToRem(200),
  maxWidth: theme.typography.pxToRem(360),
  maxHeight: theme.typography.pxToRem(260),
  overflowY: 'auto',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT,
}));

/**
 * Arrow tail pointing from the folder file list to its card. The popper writes
 * its positioning transform onto this outer element, so the rotated square
 * lives in the pseudo-element instead of being flattened by that transform.
 */
export const AttachmentFileListArrow = styled('span')(({ theme }) => ({
  position: 'absolute',
  width: theme.typography.pxToRem(12),
  height: theme.typography.pxToRem(12),
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundColor: theme.palette.background.paper,
    borderRight: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    transform: 'rotate(45deg)',
  },
}));

/**
 * The popper that hosts the folder file list. It is transparent to the pointer
 * and the list itself opts back in so its entries can be read and scrolled. It
 * sits above the conversation so the file names are readable against the
 * transcript text.
 */
export const AttachmentFileListPopper = styled(Popper)(({ theme }) => ({
  zIndex: 1400,
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
  '&[data-popper-placement="top"] > [data-popper-arrow]': {
    bottom: theme.typography.pxToRem(-7),
  },
  '&[data-popper-placement="bottom"] > [data-popper-arrow]': {
    top: theme.typography.pxToRem(-7),
    '&::before': {
      transform: 'rotate(225deg)',
    },
  },
}));

/** One file name inside the folder file list. */
export const AttachmentFileListItem = styled('div')(({ theme }) => ({
  display: 'block',
  flexShrink: 0,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: 1.6,
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));
