import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/** Scrollable viewport for the conversation transcript. */
export const ConversationScroll = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingInline: theme.spacing(1),
  paddingBlock: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(2) },
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(3) },
}));

/** Inner column that stacks the message rows. */
export const ConversationStream = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});
