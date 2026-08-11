import { styled } from '@mui/material/styles';
import { Button, Stack, TextField } from '@mui/material';

export const FieldStack = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  flexWrap: 'wrap',
  [theme.breakpoints.down('sm')]: {
    alignItems: 'stretch',
  },
}));

export const PathField = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(200),
  flex: 1,
}));

export const BrowseButton = styled(Button)(({ theme }) => ({
  height: theme.typography.pxToRem(36),
  flexShrink: 0,
}));
