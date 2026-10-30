import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/** Wrapper that pushes the generate-token button to the end of the row. */
export const McpGenerateButtonBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$push',
})<{ $push: boolean }>(({ $push }) => ({
  ...($push ? { marginLeft: 'auto' } : {}),
}));

/** Action group (copy / clear) aligned to the end of the token row. */
export const McpValueActions = styled(Box)(({ theme }) => ({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));
