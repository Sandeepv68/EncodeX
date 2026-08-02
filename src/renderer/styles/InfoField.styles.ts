import { styled } from '@mui/material/styles';
import { Typography } from '@mui/material';

export const FieldLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  display: 'block',
  fontWeight: 500,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.25),
}));

export const FieldValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: 600,
  color: theme.palette.text.primary,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
