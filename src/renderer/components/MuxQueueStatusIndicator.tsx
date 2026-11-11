/**
 * @fileoverview Compact mux queue status shown on the Remux and Demux pages.
 *
 * The indicator answers the question a user asks after clicking "Add to
 * Queue": "did it work, and where is it?". It shows the queue's state
 * (empty, queued, running, or finished) and links to the mux queue tab.
 */

import { Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMuxQueueStatus } from '../hooks/useMuxQueueStatus';
import { navigateToMuxQueue } from '../utils/mux-queue-navigation';
import { StatusRow } from '../styles/MuxQueue.styles';

/**
 * Renders the mux queue status for the Remux and Demux pages.
 * @returns {JSX.Element} The status indicator.
 */
export default function MuxQueueStatusIndicator() {
  const { t } = useTranslation();
  const status = useMuxQueueStatus();

  /**
   * The short status text for the queue's current state.
   * @returns {string} The localized status text.
   */
  const describe = (): string => {
    if (status.empty) return t('muxQueue.empty');
    if (status.running > 0)
      return t('muxQueue.stats', { queued: status.queued, running: status.running, done: status.done, failed: status.failed });
    if (status.queued > 0)
      return t('muxQueue.stats', { queued: status.queued, running: status.running, done: status.done, failed: status.failed });
    return t('muxQueue.stats', { queued: status.queued, running: status.running, done: status.done, failed: status.failed });
  };

  return (
    <StatusRow data-testid="mux-queue-status">
      <Typography variant="body2" color="text.secondary">
        {describe()}
      </Typography>
      <Button size="small" variant="text" onClick={() => navigateToMuxQueue()}>
        {t('muxQueue.viewQueue')}
      </Button>
    </StatusRow>
  );
}
