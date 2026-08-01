import { styled } from '@mui/material/styles';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { QUEUE_STATUS } from '../../shared/media-options';
import { SHADOWS } from '../colors';

export const JobCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$status',
})<{ $status: string }>(({ theme, $status }) => ({
  padding: theme.spacing(1.5),
  borderColor:
    $status === QUEUE_STATUS.ERROR
      ? theme.palette.error.main
      : $status === QUEUE_STATUS.DONE
        ? theme.palette.success.main
        : theme.palette.divider,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const CardHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
}));

export const JobNameText = styled(Typography)({ fontWeight: 600 });

export const CardActionsStack = styled(Stack)({ flexWrap: 'wrap', alignItems: 'center' });

export const OutputText = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginBottom: theme.spacing(0.5),
}));
