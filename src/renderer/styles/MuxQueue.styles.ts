import { styled } from '@mui/material/styles';
import { Button } from '@mui/material';
import { BaseAlert } from './alerts.styles';

/**
 * Alert box that surfaces the mux queue status on the Remux and Demux pages.
 * It carries the queue counters as its message and the "View queue" link as
 * its trailing action, styled like the inline page alerts.
 * @const MuxQueueAlert
 */
export const MuxQueueAlert = styled(BaseAlert)({
  '& .MuiAlert-message': {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

/**
 * Trailing "View queue" action rendered inside the mux queue status alert.
 * @const MuxQueueAlertAction
 */
export const MuxQueueAlertAction = styled(Button)({
  fontWeight: 600,
});
