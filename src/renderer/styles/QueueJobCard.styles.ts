import { styled, alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Chip, IconButton, Paper, Stack, Table, TableCell, Typography } from '@mui/material';
import { QUEUE_STATUS } from '../../shared/media-options';
import { SHADOWS, OVERLAY_COLORS } from '../../shared/theme/colors';
import { framedTableCellStyle } from './StreamTable.styles';

/**
 * Job card surface.
 *
 * The drag-and-drop styles (transform, transition, opacity, will-change) live
 * here rather than in an inline `style` prop: the sortable logic only supplies
 * the runtime values, while the CSS rules themselves belong to the stylesheet.
 * @const JobCard
 */
export const JobCard = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== '$status' && prop !== '$dragOverlay' && prop !== '$transform' && prop !== '$dragActive' && prop !== '$dragging',
})<{ $status: string; $dragOverlay?: boolean; $transform?: string; $dragActive?: boolean; $dragging?: boolean }>(
  ({ theme, $status, $dragOverlay, $transform, $dragActive, $dragging }) => ({
    padding: 0,
    overflow: 'hidden',
    borderColor:
      $status === QUEUE_STATUS.ERROR
        ? theme.palette.error.main
        : $status === QUEUE_STATUS.DONE
          ? theme.palette.success.main
          : theme.palette.divider,
    boxShadow: $dragOverlay ? theme.shadows[8] : theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
    transform: $transform,
    transition: $dragActive && !$dragging ? 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)' : undefined,
    opacity: $dragging ? 0 : undefined,
    willChange: $dragActive ? 'transform' : undefined,
  }),
);

export const CardBody = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'stretch',
});

export const CardContent = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: theme.spacing(1.5),
}));

/**
 * Fixed-width thumbnail column. Its own height never influences the card's
 * height (it has no in-flow content), so it is stretched by the flex row to
 * match the card content column instead of the other way around. This keeps a
 * tall/vertical video preview from inflating the card.
 * @const ThumbWrap
 */
export const ThumbWrap = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: theme.typography.pxToRem(112),
  flexShrink: 0,
  alignSelf: 'stretch',
  overflow: 'hidden',
}));

/**
 * Fills the {@link ThumbWrap} column exactly, cropping via `objectFit: cover`
 * so the preview always matches the card height regardless of aspect ratio.
 * @const ThumbImg
 */
export const ThumbImg = styled('img')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

export const CardHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
}));

export const JobNameText = styled(Typography)({
  fontWeight: 600,
  flex: '1 1 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

/** Wrapper letting the job name shrink inside the header row. @const JobTitleWrapper */
export const JobTitleWrapper = styled(Box)({
  flex: '1 1 0',
  minWidth: 0,
});

/** Non-interactive "customized" indicator icon. @const CustomizedIconButton */
export const CustomizedIconButton = styled(IconButton)({
  pointerEvents: 'none',
});

export const StatusChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(0.75),
  height: theme.typography.pxToRem(28),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  '& .MuiChip-label': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1,
    textTransform: 'uppercase',
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.pxToRem(11),
  },
  '&.MuiChip-colorPrimary': {
    backgroundColor: alpha(theme.palette.primary.main, 0.18),
  },
  '&.MuiChip-colorSuccess': {
    backgroundColor: alpha(theme.palette.success.main, 0.18),
  },
  '&.MuiChip-colorWarning': {
    backgroundColor: alpha(theme.palette.warning.main, 0.18),
  },
  '&.MuiChip-colorError': {
    backgroundColor: alpha(theme.palette.error.main, 0.18),
  },
  '&.MuiChip-colorInfo': {
    backgroundColor: alpha(theme.palette.info.main, 0.18),
  },
  '&.MuiChip-colorDefault': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const CardActionsStack = styled(Stack)({ flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 });

export const DragHandleButton = styled(IconButton)(({ theme }) => ({
  cursor: 'grab',
  color: theme.palette.text.secondary,
  borderRadius: theme.typography.pxToRem(4),
  padding: theme.spacing(0.5),
  '&:hover': {
    color: theme.palette.text.primary,
  },
  '&:active': {
    cursor: 'grabbing',
  },
  '& .MuiTouchRipple-child': {
    borderRadius: theme.typography.pxToRem(4),
  },
}));

export const DetailsBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderTop: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'dark' ? OVERLAY_COLORS.white02 : OVERLAY_COLORS.black02,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).INSET_DARK : SHADOWS(theme).INSET_LIGHT,
}));

export const DetailsLabel = styled(Typography)(({ theme }) => ({
  display: 'block',
  fontWeight: 600,
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
  '&:first-of-type': {
    marginTop: 0,
  },
}));

export const OptionsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${theme.typography.pxToRem(220)}, 1fr))`,
  gap: `${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(16)}`,
  marginBottom: theme.typography.pxToRem(4),
}));

export const OptionRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  columnGap: theme.typography.pxToRem(4),
}));

/**
 * A path value inside the details panel. Long paths are broken so they stay
 * inside the panel instead of running over the neighbouring text.
 */
export const DetailsPath = styled(Typography)({
  wordBreak: 'break-all',
});

/**
 * Marker class of the cell that hosts a nested table. The surrounding cell
 * padding is skipped for it, so the nested table sits flush against the frame
 * of the details table instead of floating inside a padded cell.
 * @const {string} FLUSH_CELL_CLASS
 */
export const FLUSH_CELL_CLASS = 'detailsFlushCell';

/**
 * The row and cell rules of a details table: the same single-line borders and
 * banded rows the Remux/Demux stream tables use, without the hover tone - the
 * details panel is a read-only view, so rows do not react to the pointer.
 * @param {Theme} theme - The active MUI theme.
 * @returns {object} The table rule set.
 */
function detailsTableRules(theme: Theme) {
  return {
    '& > .MuiTableBody-root > .MuiTableRow-root > .MuiTableCell-root': {
      ...framedTableCellStyle(theme),
      overflowWrap: 'anywhere',
    },
    [`& > .MuiTableBody-root > .MuiTableRow-root > .MuiTableCell-root:not(.${FLUSH_CELL_CLASS})`]: {
      padding: `${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(8)}`,
    },
    '& > .MuiTableBody-root > .MuiTableRow-root:last-of-type > .MuiTableCell-root': {
      borderBottom: 'none',
    },
    '& > .MuiTableBody-root > .MuiTableRow-root:nth-of-type(even)': {
      backgroundColor: alpha(theme.palette.primary.main, 0.04),
    },
    '& > .MuiTableHead-root > .MuiTableRow-root > .MuiTableCell-root': {
      ...framedTableCellStyle(theme),
      padding: `${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(8)}`,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      backgroundColor: alpha(theme.palette.text.secondary, 0.12),
    },
  };
}

/**
 * The job details table: a framed label/value table drawn exactly like the
 * Remux/Demux stream tables, with the label column shaded like a header.
 */
export const DetailsTable = styled(Table)(({ theme }) => ({
  borderCollapse: 'separate',
  borderSpacing: 0,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.typography.pxToRem(8),
  overflow: 'hidden',
  width: '100%',
  tableLayout: 'fixed',
  marginBottom: theme.typography.pxToRem(4),
  ...detailsTableRules(theme),
}));

/**
 * A nested details table (the extracted streams of a demux job). It shares the
 * cell styling of the Remux/Demux stream tables but has no frame of its own,
 * because it already sits inside the framed details table.
 */
export const DetailsSubTable = styled(Table)(({ theme }) => ({
  ...detailsTableRules(theme),
}));

/**
 * The cell that hosts a nested table. It carries no padding of its own, so the
 * nested table sits flush inside the details table instead of floating inside
 * a padded cell.
 */
export const DetailsCellHost = styled(TableCell)({
  padding: 0,
});

/**
 * The label cell of a details table row. Shaded like a header cell so the two
 * columns read as a label column and a value column.
 */
export const DetailsCellLabel = styled(TableCell)(({ theme }) => ({
  width: theme.typography.pxToRem(150),
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(12),
  backgroundColor: alpha(theme.palette.text.secondary, 0.12),
}));

/**
 * The value cell of a details table row.
 */
export const DetailsCellValue = styled(TableCell)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
}));

/**
 * A section heading row inside a details table.
 */
export const DetailsSectionCell = styled(TableCell)(({ theme }) => ({
  paddingTop: theme.typography.pxToRem(12),
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(12),
}));

/**
 * The header cell of a nested details table.
 */
export const DetailsHeaderCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(12),
}));

/**
 * The stream cell of a nested details table.
 */
export const DetailsStreamCell = styled(TableCell)(({ theme }) => ({
  width: '22%',
  fontSize: theme.typography.pxToRem(12),
}));

/**
 * The output path cell of a nested details table.
 */
export const DetailsOutputCell = styled(TableCell)(({ theme }) => ({
  width: '40%',
  fontSize: theme.typography.pxToRem(12),
}));
