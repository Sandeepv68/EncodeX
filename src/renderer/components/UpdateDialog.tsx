/**
 * @fileoverview In-app update dialog.
 */

import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@mui/material';
import { faArrowUp, faCircleCheck, faCloudArrowDown, faDownload, faStopwatch, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AppDialog from './AppDialog';
import { useUpdateStore } from '../stores/updateStore';
import { formatBytes } from '../utils/formatters';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import {
  UpdateCheckingSpinner,
  UpdateDialogContent,
  UpdateProgressBar,
  UpdateProgressText,
  UpdateReleaseNotes,
  UpdateReleaseNotesLink,
  UpdateStatusMessage,
  UpdateVersionText,
} from '../styles/UpdateDialog.styles';

/**
 * Renders the update dialog.
 * @returns {JSX.Element} The update dialog.
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

  const actions =
    status === 'idle' || status === 'checking' ? (
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
    ) : null;

  return (
    <AppDialog
      open={dialogOpen}
      onClose={handleClose}
      title={t('update.title')}
      icon={<FontAwesomeIcon icon={faCloudArrowDown} />}
      showCloseButton
      closeButtonAriaLabel={t('update.close')}
      maxWidth="sm"
      fullWidth
      paperTestId="update-dialog"
      actions={actions}
    >
      <UpdateDialogContent>
        {status === 'idle' || status === 'checking' ? (
          <UpdateStatusMessage>
            <UpdateCheckingSpinner size={24} aria-label={t('update.checking')} />
            {t('update.checking')}
          </UpdateStatusMessage>
        ) : status === 'not-available' ? (
          <UpdateStatusMessage>{t('update.upToDate')}</UpdateStatusMessage>
        ) : status === 'available' && info ? (
          <>
            <Typography variant="body1">{t('update.newVersionAvailable')}</Typography>
            <UpdateVersionText variant="h6">v{info.version}</UpdateVersionText>
            {info.releaseNotes && <UpdateReleaseNotes>{info.releaseNotes}</UpdateReleaseNotes>}
            <UpdateReleaseNotesLink component="button" variant="body2" underline="hover" onClick={() => openReleaseNotes(info.releaseUrl)}>
              {t('update.viewReleaseNotes')}
            </UpdateReleaseNotesLink>
          </>
        ) : status === 'downloading' ? (
          <>
            <Typography variant="body1">{t('update.downloading')}</Typography>
            {progress && (
              <>
                <UpdateProgressBar variant="determinate" value={progress.percent} />
                <UpdateProgressText variant="body2" color="text.secondary">
                  {progress.percent}% — {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                </UpdateProgressText>
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
    </AppDialog>
  );
}
