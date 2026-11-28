import { alpha, styled } from '@mui/material/styles';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';
import { FeatureGrid, FeatureGridItem } from './Dashboard.styles';
import { InlineAlert } from './alerts.styles';

/** Grid cell carrying dnd-kit's visual transform while a card is dragged. */
export const SortableGridItem = styled(FeatureGridItem, {
  shouldForwardProp: (prop) => prop !== '$transform' && prop !== '$transition' && prop !== '$dragging' && prop !== '$sorting',
})<{ $transform?: string; $transition?: string; $dragging?: boolean; $sorting?: boolean }>(
  ({ theme, $transform, $transition, $dragging, $sorting }) => ({
    transform: $transform,
    transition: $transition,
    opacity: $dragging ? 0 : 1,
    willChange: $sorting ? 'transform' : undefined,
    borderColor: $dragging ? theme.palette.primary.main : undefined,
  }),
);

export const DropPlaceholder = styled('div', { shouldForwardProp: (prop) => prop !== '$rect' })<{
  $rect: { top: number; left: number; width: number; height: number };
}>(({ theme, $rect }) => ({
  position: 'fixed',
  top: $rect.top,
  left: $rect.left,
  width: $rect.width,
  height: $rect.height,
  boxSizing: 'border-box',
  border: `${theme.typography.pxToRem(2)} dashed ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.55 : 0.45)}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
  boxShadow: `0 0 ${theme.typography.pxToRem(8)} ${alpha(theme.palette.primary.main, 0.1)}`,
  pointerEvents: 'none',
  zIndex: 3,
}));

/** Horizontal bar with group chips and layout actions in edit mode. */
export const GroupBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  alignSelf: 'center',
  gap: theme.spacing(1),
  width: 'fit-content',
  maxWidth: '100%',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
}));

/** Group chip with even padding around both the icon and the count label. */
export const GroupChip = styled(Chip)(({ theme }) => ({
  paddingBlock: theme.spacing(0.25),
  paddingInline: theme.spacing(1),
  gap: theme.spacing(0.25),
  '& .MuiChip-icon': {
    marginInline: 0,
  },
  '& .MuiChip-label': {
    paddingInline: 0,
  },
}));

/** Dismissible instruction alert shown above the grouped card sections. */
export const EditHintAlert = styled(InlineAlert)(({ theme }) => ({
  alignSelf: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  marginBottom: theme.spacing(1),
  '& .MuiAlert-message': {
    textAlign: 'left',
  },
}));

/** One grouped section of the card grid. */
export const GroupSection = styled(Box)(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(2),
  textAlign: 'left',
}));

/** Left-aligned card grid used inside grouped sections. */
export const GroupCardsGrid = styled(FeatureGrid)({
  justifyContent: 'flex-start',
});

/** Header row above a group's cards. */
export const GroupHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
  paddingLeft: theme.spacing(0.5),
}));

/** Group name and card count. */
export const GroupTitle = styled(Typography)({
  fontWeight: 600,
});

/** Standalone field label for the group name in the create/rename dialog. */
export const GroupNameLabel = styled('label')(({ theme }) => ({
  display: 'block',
  ...theme.typography.body2,
  fontWeight: 500,
  marginBottom: theme.spacing(0.5),
}));

/** Drag handle shown on each card while editing. */
export const DragHandle = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  zIndex: 2,
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  cursor: 'grab',
  touchAction: 'none',
  '&:active': {
    cursor: 'grabbing',
  },
}));

/** Group menu button shown next to the drag handle while editing. */
export const CardGroupButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.typography.pxToRem(44),
  zIndex: 2,
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.background.paper,
}));

/** Container for the edit controls overlaying a card. */
export const CardEditControls = styled(Box)({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 2,
  '& > *': {
    pointerEvents: 'auto',
  },
});
