import type { ElementType } from 'react';
import { styled } from '@mui/material/styles';
import { Alert, Box, Button, Chip, ListItem, ListItemIcon, Typography } from '@mui/material';
import { SHADOWS } from '../../../shared/theme/colors';

/**
 * Typographic container for assistant message content. Applies consistent
 * spacing and hierarchy to semantic headings, paragraphs and lists while
 * leaving MUI's icon-led List layout untouched.
 */
export const AssistantBody = styled(Box)(({ theme }) => ({
  width: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    margin: 0,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: theme.typography.h6.lineHeight,
    '&:first-of-type': { marginTop: 0 },
  },
  '& p': {
    margin: 0,
    marginBottom: theme.spacing(1),
    lineHeight: theme.typography.body1.lineHeight,
    '&:last-child': { marginBottom: 0 },
  },
  '& ul:not(.MuiList-root), & ol:not(.MuiList-root)': {
    margin: 0,
    marginBottom: theme.spacing(1),
    paddingInlineStart: theme.spacing(3),
  },
  '& ul:not(.MuiList-root) > li, & ol:not(.MuiList-root) > li': {
    marginBottom: theme.spacing(0.5),
    '&:last-child': { marginBottom: 0 },
  },
}));

/** Inline alert used for assistant errors and notices. */
export const AssistantAlert = styled(Alert)(({ theme }) => ({
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
}));

/** Warning alert that is separated from the content below it. */
export const AssistantWarningAlert = styled(AssistantAlert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

/** Chip announcing which operation the assistant routed the request to. */
export const RoutedChip = styled(Chip)(({ theme }) => ({
  maxWidth: '100%',
  height: 'auto',
  marginBottom: theme.spacing(1),
  '& .MuiChip-label': {
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
}));

/** Heading of a section inside the assistant plan. */
export const SectionHeading = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Inline label showing the estimated savings of a single action. */
export const SavingsText = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  marginLeft: theme.spacing(1),
  [theme.breakpoints.down('sm')]: {
    display: 'block',
    marginLeft: 0,
  },
}));

/** Block listing the target settings a planned action will encode with. */
export const TargetRow = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  display: 'block',
  marginTop: theme.spacing(0.5),
  overflowWrap: 'anywhere',
}));

/** List row of a plan section, flush with the container edges. */
export const PlanListItem = styled(ListItem)({
  paddingInline: 0,
  alignItems: 'flex-start',
  '& .MuiListItemText-root': {
    minWidth: 0,
  },
  '& .MuiListItemText-primary, & .MuiListItemText-secondary': {
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
});

/** Leading icon slot of an action row. */
export const ActionListItemIcon = styled(ListItemIcon)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(36),
  [theme.breakpoints.up('sm')]: {
    minWidth: theme.typography.pxToRem(44),
  },
}));

/** Leading icon slot of a rationale row. */
export const RationaleListItemIcon = styled(ListItemIcon)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(32),
}));

/** Block that separates the sections of an assistant plan. */
export const SectionBlock = styled(Box)(({ theme }) => ({
  minWidth: 0,
  marginTop: theme.spacing(2),
}));

/** Primary "add to queue" action at the end of an assistant plan. */
export const ApplyQueueButton = styled(Button)(({ theme }) => ({
  maxWidth: '100%',
  [theme.breakpoints.down('sm')]: {
    width: '100%',
  },
}));

/** Block that holds a single rendered MCP app view. */
export const McpViewBlock = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$last',
})<{ $last: boolean }>(({ theme, $last }) => ({
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflowX: 'auto',
  marginBottom: $last ? 0 : theme.spacing(2),
}));

/** Note shown under the "add to queue" button. */
export const ApplyNoteText = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginTop: theme.spacing(0.5),
  overflowWrap: 'anywhere',
}));
