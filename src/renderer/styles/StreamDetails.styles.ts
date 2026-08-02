import { alpha, styled } from '@mui/material/styles';
import { Box, Chip, Paper, Typography } from '@mui/material';

export const StreamTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

export const StreamCountChip = styled(Chip)(({ theme }) => ({
  borderRadius: '8px',
  fontWeight: 600,
  height: theme.spacing(2.5),
  color: theme.palette.text.secondary,
  backgroundColor: alpha(theme.palette.text.secondary, 0.12),
  '& .MuiChip-label': { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
}));

export const StreamPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.default,
}));

export const StreamTypeChip = styled(Chip)<{ tone: 'video' | 'audio' }>(({ theme, tone }) => {
  const main = tone === 'video' ? theme.palette.primary.main : theme.palette.warning.main;
  return {
    borderRadius: '6px',
    fontWeight: 600,
    color: main,
    borderColor: 'transparent',
    backgroundColor: alpha(main, 0.12),
    '& .MuiChip-label': { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
  };
});

export const StreamHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

export const StreamName = styled(Typography)({ fontWeight: 600 });

export const DispositionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(1),
}));

export const DispositionChip = styled(Chip)(({ theme }) => ({
  borderRadius: '6px',
  fontSize: theme.typography.pxToRem(11),
  height: theme.spacing(2.25),
  color: theme.palette.text.secondary,
  borderColor: theme.palette.divider,
  backgroundColor: 'transparent',
  '& .MuiChip-label': { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
}));
