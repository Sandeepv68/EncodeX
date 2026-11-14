/**
 * @fileoverview Reusable action that opens the detached Logs window.
 *
 * The in-app Logs page and the detached window share one log feed, so every page
 * can offer the same "view logs" action without duplicating the bridge call or
 * its error handling.
 */

import { Button, IconButton, Tooltip } from '@mui/material';
import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { ViewLogsButtonProps } from './types';
import { callBridgeVoid } from '../utils/bridge-call';

/**
 * Opens the Logs page in its own window on click.
 *
 * The bridge call is fire-and-forget; {@link callBridgeVoid} contains a
 * synchronous throw from an older or broken preload so a missing window cannot
 * take down the page that hosts the button.
 *
 * @param {ViewLogsButtonProps} props - Component props.
 * @param {boolean} [props.iconOnly] - Render only the icon.
 * @returns {JSX.Element} The action button.
 */
export default function ViewLogsButton({ iconOnly = false }: ViewLogsButtonProps) {
  const { t } = useTranslation();
  const label = t('logs.viewLogs');

  const handleOpenLogs = () => {
    callBridgeVoid(() => window.electronAPI?.openLogsWindow?.(), 'openLogsWindow');
  };

  if (iconOnly) {
    return (
      <Tooltip title={label} placement="bottom">
        <IconButton size="small" aria-label={label} onClick={handleOpenLogs} data-testid="view-logs">
          <FontAwesomeIcon icon={faFileLines} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFileLines} />} onClick={handleOpenLogs} data-testid="view-logs">
      {label}
    </Button>
  );
}
