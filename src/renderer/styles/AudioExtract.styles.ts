import { styled } from '@mui/material/styles';
import { Box, Stack } from '@mui/material';
import type { ElementType } from 'react';

/** Selected-file name emphasized inside the preview caption. @const SelectedFileName */
export const SelectedFileName = styled(Box)<{ component?: ElementType }>({
  fontWeight: 700,
});

/** Action buttons row that wraps onto new lines on narrow screens. @const ActionRow */
export const ActionRow = styled(Stack)({
  flexWrap: 'wrap',
});
