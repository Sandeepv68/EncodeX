import { styled } from '@mui/material/styles';
import { Stack } from '@mui/material';

/**
 * Row that places the mux queue status text and its "View queue" link next to
 * each other, aligned to the baseline.
 * @const StatusRow
 */
export const StatusRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
});
