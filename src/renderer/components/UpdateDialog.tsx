/**
 * @fileoverview In-app update dialog.
 *
 * Renders a modal MUI Dialog that guides the user through the update lifecycle:
 * checking for updates, displaying availability with release notes and a download
 * button, showing download progress, and offering to install the downloaded
 * installer. The download can be pushed to the background at any time by closing
 * the dialog (the footer widget keeps showing progress). Once downloaded the user
 * picks between installing & restarting now, scheduling the install for the next
 * app restart, or doing nothing for now.
 *
 * The dialog is controlled by the `useUpdateStore` Zustand store and subscribes to
 * main-process events via the preload bridge. Mounted once inside `AppLayout` so it
 * persists across route changes.
 */

import { useTranslation } from 'react-i18next';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  Typography,
} from '@mui/material';
import { faArrowUp, faDownload, faXmark, faCircleCheck, faStopwatch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useUpdateStore } from '../stores/updateStore';
import { formatBytes } from '../utils/formatters';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { UpdateDialogContent, UpdateVersionText, UpdateReleaseNotes, UpdateStatusMessage } from '../styles/UpdateDialog.styles';

/**
 * Renders the update dialog.
 *
 * The dialog is fully controlled by the useUpdateStore state machine. Each
 * status renders a distinct content area; action buttons drive the next step.
 * Closing the dialog never stops work: a running download continues in the
 * background and its progress is shown in the app footer.
 *
 * @returns {JSX.Element} The update dialog, rendered only when open.
 */
export default function UpdateDialog() {
  const { t } = useTranslation();
  const {
    status,
    info,
    progress,
    errorMessage,
    scheduledVersion,
    dialogOpen,
    closeDialog,
    checkForUpdates,
    downloadUpdate,
    cancelDownload,
    installUpdate,
    installOnRestart,
    cancelRestartInstall,
    openReleaseNotes,
    reset,
  } = useUpdateStore();

  const handleClose = () => {
    closeDialog();
  };

  const handleRetry = () => {
    reset();
    checkForUpdates();
    recordAnalyticsEvent(createAnalyticsEvent('update_retry', {}));
  };

  return (
    <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { 'data-testid': 'update-dialog' } }}>
      <DialogTitle>{t('update.title')}</DialogTitle>
      <DialogContent>
        <UpdateDialogContent>
          {status === 'idle' || status === 'checking' ? (
            <UpdateStatusMessage>
              <CircularProgress size={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('update.checking')}
            </UpdateStatusMessage>
          ) : status === 'not-available' ? (
            <UpdateStatusMessage>{t('update.upToDate')}</UpdateStatusMessage>
          ) : status === 'available' && info ? (
            <>
              <Typography variant="body1">{t('update.newVersionAvailable')}</Typography>
              <UpdateVersionText variant="h6">v{info.version}</UpdateVersionText>
              {info.releaseNotes && <UpdateReleaseNotes>{info.releaseNotes}</UpdateReleaseNotes>}
              <Link
                component="button"
                variant="body2"
                underline="hover"
                onClick={() => openReleaseNotes(info.releaseUrl)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('update.viewReleaseNotes')}
              </Link>
            </>
          ) : status === 'downloading' ? (
            <>
              <Typography variant="body1">{t('update.downloading')}</Typography>
              {progress && (
                <>
                  <LinearProgress variant="determinate" value={progress.percent} sx={{ height: 8, borderRadius: 4 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {progress.percent}% — {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  </Typography>
                </>
              )}
              <UpdateStatusMessage>{t('update.downloadInBackground')}</UpdateStatusMessage>
            </>
          ) : status === 'downloaded' ? (
            <UpdateStatusMessage>{t('update.readyToInstall', { version: info?.version })}</UpdateStatusMessage>
          ) : status === 'restart-scheduled' ? (
            <UpdateStatusMessage>{t('update.installScheduled', { version: info?.version || scheduledVersion })}</UpdateStatusMessage>
          ) : status === 'error' ? (
            <UpdateStatusMessage color="error">{errorMessage || t('update.error')}</UpdateStatusMessage>
          ) : null}
        </UpdateDialogContent>
      </DialogContent>
      <DialogActions>
        {status === 'idle' || status === 'checking' ? (
          <Button onClick={handleClose} startIcon={<FontAwesomeIcon icon={faXmark} />}>
            {t('update.cancel')}
          </Button>
        ) : status === 'not-available' ? (
          <Button onClick={handleClose} startIcon={<FontAwesomeIcon icon={faXmark} />}>
            {t('update.close')}
          </Button>
        ) : status === 'available' ? (
          <>
            <Button onClick={handleClose} startIcon={<FontAwesomeIcon icon={faXmark} />}>
              {t('update.later')}
            </Button>
            <Button variant="contained" onClick={downloadUpdate} startIcon={<FontAwesomeIcon icon={faDownload} />}>
              {t('update.download')}
            </Button>
          </>
        ) : status === 'downloading' ? (
          <>
            <Button
              onClick={() => {
                cancelDownload();
                closeDialog();
              }}
              startIcon={<FontAwesomeIcon icon={faXmark} />}
              color="warning"
            >
              {t('update.cancelDownload')}
            </Button>
            <Button variant="contained" onClick={handleClose} startIcon={<FontAwesomeIcon icon={faStopwatch} />}>
              {t('update.background')}
            </Button>
          </>
        ) : status === 'downloaded' ? (
          <>
            <Button onClick={handleClose} startIcon={<FontAwesomeIcon icon={faXmark} />}>
              {t('update.later')}
            </Button>
            <Button onClick={installOnRestart} startIcon={<FontAwesomeIcon icon={faStopwatch} />}>
              {t('update.installOnRestart')}
            </Button>
            <Button variant="contained" onClick={installUpdate} startIcon={<FontAwesomeIcon icon={faCircleCheck} />}>
              {t('update.installRestart')}
            </Button>
          </>
        ) : status === 'restart-scheduled' ? (
          <>
            <Button onClick={cancelRestartInstall} startIcon={<FontAwesomeIcon icon={faXmark} />} color="warning">
              {t('update.cancelRestartInstall')}
            </Button>
            <Button variant="contained" onClick={installUpdate} startIcon={<FontAwesomeIcon icon={faCircleCheck} />}>
              {t('update.installRestart')}
            </Button>
          </>
        ) : status === 'error' ? (
          <>
            <Button onClick={handleClose} startIcon={<FontAwesomeIcon icon={faXmark} />}>
              {t('update.close')}
            </Button>
            <Button onClick={handleRetry} startIcon={<FontAwesomeIcon icon={faArrowUp} />} variant="contained">
              {t('update.retry')}
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
