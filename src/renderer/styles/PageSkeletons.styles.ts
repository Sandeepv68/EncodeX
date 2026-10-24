import { styled } from '@mui/material/styles';
import { Box, Skeleton } from '@mui/material';

export const LoadingRegion = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
});

export const SkeletonPageHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
}));

export const SkeletonPageIcon = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(24),
  height: theme.typography.pxToRem(24),
  borderRadius: theme.typography.pxToRem(6),
}));

export const SkeletonPageTitle = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(180),
  height: theme.typography.pxToRem(28),
  borderRadius: theme.typography.pxToRem(6),
}));

export const SkeletonStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const SkeletonRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: 0,
  [theme.breakpoints.up('sm')]: { flexDirection: 'row' },
}));

export const SkeletonFieldGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.typography.pxToRem(160)}, 1fr))`,
  gap: theme.spacing(2),
}));

export const SkeletonField = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  flex: 1,
  minWidth: 0,
}));

export const SkeletonToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const SkeletonPushEnd = styled(Box)({
  marginInlineStart: 'auto',
});

export const SkeletonFilePathRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const SkeletonDivider = styled(Box)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(1),
  backgroundColor: theme.palette.divider,
}));

export const SkeletonTable = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  overflow: 'hidden',
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export const SkeletonTableRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  '& > *': { flex: 1 },
}));

export const SkeletonMetaRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

export const SkeletonChipRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const SkeletonLogRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(0.25),
}));

export const SkeletonPlayer = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  aspectRatio: '16 / 9',
  borderRadius: theme.shape.borderRadius,
}));

export const SkeletonTimeline = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(64),
  borderRadius: theme.shape.borderRadius,
}));

export const SkeletonDropZone = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(150),
  borderRadius: theme.typography.pxToRem(12),
}));

export const SkeletonInput = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(40),
  borderRadius: theme.typography.pxToRem(8),
  flex: 1,
}));

export const SkeletonButton = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(148),
  height: theme.typography.pxToRem(40),
  borderRadius: theme.typography.pxToRem(8),
  flexShrink: 0,
}));

export const SkeletonProgress = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(8),
  borderRadius: theme.typography.pxToRem(4),
}));

export const SkeletonIconButton = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(36),
  height: theme.typography.pxToRem(36),
  borderRadius: theme.typography.pxToRem(8),
}));

export const SkeletonIconButtonSmall = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(24),
  height: theme.typography.pxToRem(24),
  borderRadius: theme.typography.pxToRem(6),
}));

export const SkeletonSwitch = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(42),
  height: theme.typography.pxToRem(24),
  borderRadius: theme.typography.pxToRem(12),
  flexShrink: 0,
}));

export const SkeletonThemeCard = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(148),
  height: theme.typography.pxToRem(116),
  borderRadius: theme.shape.borderRadius,
}));

export const SkeletonSettingsLabelBlock = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  flex: 1,
  minWidth: 0,
}));

export const SkeletonSearchField = styled(Skeleton)(({ theme }) => ({
  flex: 1,
  minWidth: theme.typography.pxToRem(160),
  maxWidth: theme.typography.pxToRem(420),
  height: theme.typography.pxToRem(28),
  borderRadius: theme.typography.pxToRem(6),
}));

export const SkeletonCopilotLayout = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
});

export const SkeletonChatArea = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(3),
}));

export const SkeletonComposer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(2),
  paddingBottom: theme.spacing(2),
}));

export const SkeletonComposerShell = styled(Skeleton)(({ theme }) => ({
  width: '100%',
  height: theme.typography.pxToRem(56),
  borderRadius: theme.typography.pxToRem(24),
}));

export const SkeletonLogo = styled(Skeleton)(({ theme }) => ({
  width: theme.typography.pxToRem(160),
  height: theme.typography.pxToRem(112),
  marginInline: 'auto',
  borderRadius: theme.shape.borderRadius,
}));

export const SkeletonThumb = styled(Skeleton)({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  borderRadius: 0,
});
