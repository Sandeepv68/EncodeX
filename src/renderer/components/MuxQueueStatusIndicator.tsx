/**
 * @fileoverview Compact mux queue status shown on the Remux and Demux pages.
 *
 * The indicator answers the question a user asks after clicking "Add to
 * Queue": "did it work, and where is it?". It is rendered as an alert box
 * that shows the queue's state (empty, queued, running, or finished) and
 * links to the mux queue tab.
 */

import type { AlertColor } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMuxQueueStatus } from '../hooks/useMuxQueueStatus';
import { navigateToMuxQueue } from '../utils/mux-queue-navigation';
import { MuxQueueAlert, MuxQueueAlertAction } from '../styles/MuxQueue.styles';

/**
 * Renders the mux queue status for the Remux and Demux pages.
 * @returns {JSX.Element} The status alert.
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
    return t('muxQueue.stats', { queued: status.queued, running: status.running, done: status.done, failed: status.failed });
  };

  /**
   * The alert severity matching the queue's current state.
   * @returns {AlertColor} The severity for the alert box.
   */
  const severity = (): AlertColor => {
    if (status.failed > 0) return 'error';
    if (status.running > 0) return 'info';
    if (status.queued > 0) return 'info';
    if (status.done > 0) return 'success';
    return 'info';
  };

  return (
    <MuxQueueAlert
      severity={severity()}
      data-testid="mux-queue-status"
      action={
        <MuxQueueAlertAction size="small" color="inherit" variant="text" onClick={() => navigateToMuxQueue()}>
          {t('muxQueue.viewQueue')}
        </MuxQueueAlertAction>
      }
    >
      {describe()}
    </MuxQueueAlert>
  );
}
