import { alpha, styled } from '@mui/material/styles';
import { Box, Chip, Paper, Typography } from '@mui/material';

export const StreamTitle = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(1) }));

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
