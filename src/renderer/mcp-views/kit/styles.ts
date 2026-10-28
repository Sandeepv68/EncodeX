/**
 * @fileoverview Styled primitives shared by every MCP App view.
 *
 * The kit deliberately lives in one stylesheet: the views are rendered inside a
 * sandboxed iframe (external hosts) or inside the Copilot transcript (in-app),
 * and both need the *same* set of primitives. Keeping them together makes the
 * "the views look like the app" guarantee a single-file check.
 *
 * Every value is derived from the MUI theme, so the views follow the active
 * palette, spacing scale and dark mode without any hardcoded literals.
 */

import { Box, LinearProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/** Container for a single logical block of a view. */
export const ViewCardRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.75),
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

/** Header row inside a card: title on the left, actions on the right. */
export const ViewCardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
}));

/** Card title. */
export const ViewCardTitle = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
  fontWeight: theme.typography.fontWeightBold,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

/** Uppercase section heading used inside a card. */
export const ViewSectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: theme.typography.pxToRem(0.5),
  marginTop: theme.spacing(1.5),
  marginBottom: theme.spacing(0.75),
}));

/** Two-column grid of label/value pairs. */
export const ViewDefinitionGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: theme.spacing(0.5),
  alignItems: 'baseline',
}));

/** Label cell of a definition row. */
export const ViewDefinitionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
}));

/** Value cell of a definition row; long values are ellipsized. */
export const ViewDefinitionValue = styled(Typography)(({ theme }) => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

/** Small pill used for statuses and confidence badges. */
export const ViewBadgeRoot = styled(Box)<{ tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' }>(({ theme, tone }) => {
  const tones = {
    neutral: { bg: theme.palette.action.hover, fg: theme.palette.text.secondary },
    ok: { bg: alpha(theme.palette.success.main, 0.16), fg: theme.palette.success.dark },
    warn: { bg: alpha(theme.palette.warning.main, 0.16), fg: theme.palette.warning.dark },
    danger: { bg: alpha(theme.palette.error.main, 0.16), fg: theme.palette.error.dark },
    info: { bg: alpha(theme.palette.info.main, 0.16), fg: theme.palette.info.dark },
  } as const;
  const { bg, fg } = tones[tone];
  return {
    flex: 'none',
    padding: `${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(8)}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: bg,
    color: fg,
    fontSize: theme.typography.pxToRem(12),
    whiteSpace: 'nowrap',
  };
});

/** Determinate progress track used by the job, queue and batch views. */
export const ViewProgressTrack = styled(LinearProgress)(({ theme }) => ({
  height: theme.typography.pxToRem(6),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.action.hover,
  '& .MuiLinearProgress-bar': {
    borderRadius: theme.shape.borderRadius,
    transition: 'transform 240ms ease',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiLinearProgress-bar': {
      transition: 'none',
    },
  },
}));

/** Left-rail card used for inspector findings. */
export const ViewFindingRoot = styled(Box)<{ severity: 'info' | 'warning' | 'error' }>(({ theme, severity }) => {
  const rails = {
    info: theme.palette.info.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  } as const;
  return {
    padding: theme.spacing(1),
    borderInlineStart: `${theme.typography.pxToRem(3)} solid ${rails[severity]}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  };
});

/** Severity tag rendered inside a finding. */
export const ViewFindingTag = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(11),
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: theme.typography.pxToRem(0.5),
}));

/** Placeholder shown while the host has not delivered any data yet. */
export const ViewEmptyRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3, 1.5),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

/** List of steps with an arrow marker. */
export const ViewStepsList = styled(Box)(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(0.75),
  margin: 0,
  padding: 0,
  listStyle: 'none',
}));

/** A single step row. */
export const ViewStepsItem = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.spacing(1.25),
}));

/** Circular index badge of a step row. */
export const ViewStepsIndex = styled(Box)(({ theme }) => ({
  width: theme.typography.pxToRem(22),
  height: theme.typography.pxToRem(22),
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  fontSize: theme.typography.pxToRem(12),
}));

/** Horizontal scroll container for wide tables. */
export const ViewTableScroll = styled(Box)({
  overflowX: 'auto',
});

/** Vertical stack of blocks with a consistent gap. */
export const ViewStack = styled(Box)(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(1),
}));

/** One row of a list: a flexible label, a status and an action. */
export const ViewRow = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.25),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

/** Full-width slot under a row, used for the progress track. */
export const ViewRowFooter = styled(Box)({
  gridColumn: '1 / -1',
});

/** Inline list of label/value facts. */
export const ViewFactsList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.75, 2.25),
  listStyle: 'none',
  margin: 0,
  padding: 0,
}));

/** One fact of the facts list. */
export const ViewFact = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(0.5),
}));

/** Responsive grid of form fields. */
export const ViewFieldGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.typography.pxToRem(200)}, 1fr))`,
  gap: theme.spacing(1.25),
}));

/** Bullet list with an arrow marker. */
export const ViewBulletList = styled(Box)(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: theme.spacing(0.5),
  '& > li': {
    position: 'relative',
    paddingInlineStart: theme.spacing(2.25),
    '&::before': {
      content: '"→"',
      position: 'absolute',
      insetInlineStart: 0,
      color: theme.palette.text.secondary,
    },
  },
}));

/** Bullet list with a dot marker. */
export const ViewDotList = styled(Box)(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: theme.spacing(0.5),
  '& > li': {
    position: 'relative',
    paddingInlineStart: theme.spacing(1.75),
    '&::before': {
      content: '"·"',
      position: 'absolute',
      insetInlineStart: theme.spacing(0.5),
      color: theme.palette.text.secondary,
    },
  },
}));

/** Plain block of body text. */
export const ViewParagraph = styled(Typography)(({ theme }) => ({
  margin: 0,
  color: theme.palette.text.secondary,
  overflowWrap: 'anywhere',
}));

/** Monospaced error detail. */
export const ViewDetail = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  color: theme.palette.text.secondary,
  overflowWrap: 'anywhere',
}));
