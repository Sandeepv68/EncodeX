import { styled } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';

/** One compatibility warning line in the warnings panel. @const WarningRow */
export const WarningRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
}));

/** One extraction-target row in the summary list. @const TargetRow */
export const TargetRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/** Target file name that grows to fill the free space of its row. @const FlexibleText */
export const FlexibleText = styled(Typography)({
  flex: 1,
});

/** Stack holding the new-folder name field and its destination preview. @const FolderFieldsStack */
export const FolderFieldsStack = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));
