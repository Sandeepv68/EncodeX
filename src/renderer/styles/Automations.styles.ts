/**
 * @fileoverview Styled building blocks for the Automations editor.
 *
 * All sizing and colours come from the MUI theme so the editor follows the
 * active palette and passes the renderer's strict style lint rules.
 */

import { alpha, styled } from '@mui/material/styles';
import { Box, Button, Paper, Stack, Typography, Chip, LinearProgress } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { AutomationRunStatus } from '../../shared/automations/types';
import { AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import type { AutomationStatusProps, KindBadgeProps, RunDetailProps } from './Automations.styles.types';

/** Resolves a run status to a palette colour. */
export function statusColor(theme: Theme, status?: AutomationRunStatus): string {
  switch (status) {
    case AUTOMATION_RUN_STATUS.RUNNING:
      return theme.palette.info.main;
    case AUTOMATION_RUN_STATUS.SUCCEEDED:
      return theme.palette.success.main;
    case AUTOMATION_RUN_STATUS.FAILED:
      return theme.palette.error.main;
    case AUTOMATION_RUN_STATUS.CANCELLED:
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
}

/** Full-height column containing the editor grid and console. */
export const EditorLayout = styled(Stack)({
  flex: 1,
  minHeight: 0,
  gap: 0,
});

/** Top-level editor grid: palette, canvas, inspector. */
export const EditorGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `minmax(${theme.spacing(18)}, ${theme.spacing(22)}) minmax(0, 1fr) minmax(${theme.spacing(24)}, ${theme.spacing(30)})`,
  gap: theme.spacing(2),
  flex: 1,
  minHeight: 0,
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
}));

/** Shared panel chrome for the palette, inspector, and bottom console. */
export const EditorPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  minHeight: 0,
  overflow: 'auto',
}));

/** Canvas wrapper that gives React Flow a definite height. */
export const CanvasPanel = styled(Paper)(({ theme }) => ({
  position: 'relative',
  flex: 1,
  minHeight: theme.spacing(40),
  overflow: 'hidden',
  display: 'flex',
}));

/** Full-size surface required by React Flow. */
export const CanvasSurface = styled(Box)({
  width: '100%',
  height: '100%',
});

/** Drawer title row. */
export const DrawerHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
}));

/** Drawer action row. */
export const DrawerActions = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(2),
}));

/** Toolbar action row. */
export const ToolbarRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/** Panel heading. */
export const PanelTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightMedium,
}));

/** Muted helper text under headings. */
export const PanelHint = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
}));

/** A single draggable palette entry. */
export const PaletteItem = styled(Button)(({ theme }) => ({
  justifyContent: 'flex-start',
  textTransform: 'none',
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
}));

/** Card used by every custom React Flow node. */
export const NodeCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$selected' && prop !== '$status' && prop !== '$hasIssue',
})<AutomationStatusProps>(({ theme, $selected, $status, $hasIssue }) => ({
  minWidth: theme.spacing(18),
  padding: theme.spacing(1.25),
  border: `${theme.typography.pxToRem(2)} solid ${
    $hasIssue ? theme.palette.error.main : $selected ? theme.palette.primary.main : alpha(statusColor(theme, $status), 0.6)
  }`,
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}));

/** Node heading row. */
export const NodeHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

/** Small status/issue chip rendered inside nodes and run rows. */
export const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== '$status',
})<AutomationStatusProps>(({ theme, $status }) => ({
  height: theme.typography.pxToRem(22),
  fontSize: theme.typography.pxToRem(11),
  color: statusColor(theme, $status),
  borderColor: statusColor(theme, $status),
}));

/** One validation issue row in the bottom console. */
export const IssueRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.5),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** One saved automation row in the library drawer. */
export const LibraryRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.5),
}));

export const LibraryActions = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

/** Run progress bar with a theme-derived accent. */
export const RunProgress = styled(LinearProgress)(({ theme }) => ({
  height: theme.typography.pxToRem(6),
  borderRadius: theme.spacing(0.5),
}));

/** Code-tagged issue label. */
export const IssueCode = styled(Typography)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(11),
  color: theme.palette.error.main,
}));

/** Small kind badge shown in node headers. */
export const KindBadge = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$code',
})<KindBadgeProps>(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(11),
}));

/** Vertical grouping inside the run console. */
export const ConsoleSection = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(0.75),
}));

/** Horizontal run-action row. */
export const RunControlRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/** Runtime override field with its adjacent action buttons. */
export const RuntimeInputRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
}));

/** One stage/status pair in the run timeline. */
export const TimelineRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.5),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** Named run detail such as output path or failure text. */
export const DetailRow = styled(Stack, {
  shouldForwardProp: (prop) => prop !== '$error',
})<RunDetailProps>(({ theme, $error }) => ({
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  color: $error ? theme.palette.error.main : theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(12),
}));

/** One timestamped entry in the run event log. */
export const EventRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.5),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** Monospaced timestamp column in the event log. */
export const EventTime = styled(Typography)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(11),
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
}));
