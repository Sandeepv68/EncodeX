/**
 * @fileoverview Application footer bar.
 *
 * Renders the bottom footer of the app showing the localized application name
 * and current version (read from package.json), alongside a localized
 * "powered by" label and the FFmpeg banner image.
 *
 * The footer also hosts the always-visible update widget next to the version:
 *  - a spinner while checking for updates,
 *  - a link when an update is available (reopens the dialog),
 *  - a thin live progress bar with a cancel button while a background download
 *    is running,
 *  - a ready-to-install banner with "Install & Restart" / "Install on Next
 *    Restart" actions once the installer is downloaded,
 *  - a pending-install notice with a cancel action when a restart install is
 *    armed.
 *
 * The footer is rendered once in the root layout and provides a lightweight,
 * always-visible attribution strip. It has no props and no state.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ffmpegBanner from '../../../assets/ffmpeg_banner.png';
import pkg from '../../../package.json';
import { useUpdateStore } from '../stores/updateStore';
import { useToastStore } from '../stores/toastStore';
import {
  FooterBox,
  FooterVersionText,
  FooterLeft,
  FooterRight,
  FfmpegBanner,
  UpdateLoader,
  UpdateLink,
  UpdateWidget,
  UpdateWidgetText,
  UpdateProgressTrack,
  UpdateActionButton,
  UpdateIconButton,
} from '../styles/Footer.styles';

/**
 * Renders the application footer.
 *
 * Displays the localized app name joined with the installed version from
 * `package.json` on the left, and on the right the localized "powered by" text
 * followed by the FFmpeg banner image. Both sides use the caption variant with
 * secondary text color via the shared FooterVersionText style. The update
 * widget is inline with the left side and reflects the update store status.
 *
 * @returns {JSX.Element} The footer bar.
 */
export default function Footer() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const info = useUpdateStore((s) => s.info);
  const progress = useUpdateStore((s) => s.progress);
  const scheduledVersion = useUpdateStore((s) => s.scheduledVersion);
  const openDialog = useUpdateStore((s) => s.openDialog);
  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const cancelDownload = useUpdateStore((s) => s.cancelDownload);
  const installUpdate = useUpdateStore((s) => s.installUpdate);
  const installOnRestart = useUpdateStore((s) => s.installOnRestart);
  const cancelRestartInstall = useUpdateStore((s) => s.cancelRestartInstall);
  const shownAvailableToastRef = useRef(false);
  const shownDownloadedToastRef = useRef(false);

  useEffect(() => {
    if (status !== 'available') {
      shownAvailableToastRef.current = false;
    }
    if (status !== 'downloaded') {
      shownDownloadedToastRef.current = false;
    }
    if (status === 'available' && info && !shownAvailableToastRef.current) {
      shownAvailableToastRef.current = true;
      useToastStore.getState().info(t('toast.updateAvailable', { version: info.version }), undefined, 8000, {
        label: t('toast.updateNow'),
        onClick: () => {
          openDialog();
          downloadUpdate();
        },
      });
    }
    if (status === 'downloaded' && info && !shownDownloadedToastRef.current) {
      shownDownloadedToastRef.current = true;
      useToastStore.getState().info(t('toast.updateDownloaded', { version: info.version }), undefined, 10000, {
        label: t('toast.viewUpdate'),
        onClick: () => {
          openDialog();
        },
      });
    }
  }, [status, info, t, openDialog, downloadUpdate]);

  return (
    <FooterBox>
      <FooterLeft>
        <FooterVersionText variant="caption" color="text.secondary">
          {t('app.name')} {t('footer.version', { version: pkg.version })}
        </FooterVersionText>
        {status === 'checking' && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateLoader size={14} />
            <FooterVersionText variant="caption" color="text.secondary">
              {t('footer.checkingForUpdates')}
            </FooterVersionText>
          </>
        )}
        {status === 'available' && info && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateLink variant="caption" onClick={openDialog}>
              {t('footer.updateAvailable', {
                version: info.version,
              })}
            </UpdateLink>
          </>
        )}
        {status === 'downloading' && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateWidget data-testid="footer-update-downloading">
              <UpdateProgressTrack variant="determinate" value={progress?.percent ?? 0} />
              <UpdateLink variant="caption" onClick={openDialog}>
                {t('footer.downloading', {
                  version: info?.version,
                  percent: progress?.percent ?? 0,
                })}
              </UpdateLink>
              <Tooltip title={t('update.cancelDownload')}>
                <UpdateIconButton size="small" onClick={cancelDownload} aria-label={t('update.cancelDownload')}>
                  <FontAwesomeIcon icon={faXmark} />
                </UpdateIconButton>
              </Tooltip>
            </UpdateWidget>
          </>
        )}
        {status === 'downloaded' && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateWidget data-testid="footer-update-ready">
              <UpdateWidgetText variant="caption" color="text.secondary">
                {t('footer.updateReady', {
                  version: info?.version,
                })}
              </UpdateWidgetText>
              <UpdateActionButton size="small" variant="contained" onClick={installUpdate}>
                {t('update.installRestart')}
              </UpdateActionButton>
              <UpdateActionButton size="small" onClick={installOnRestart}>
                {t('update.installOnRestart')}
              </UpdateActionButton>
            </UpdateWidget>
          </>
        )}
        {status === 'restart-scheduled' && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateWidget data-testid="footer-restart-scheduled">
              <UpdateWidgetText variant="caption" color="text.secondary">
                {t('footer.installScheduled', {
                  version: scheduledVersion || info?.version,
                })}
              </UpdateWidgetText>
              <UpdateActionButton size="small" onClick={cancelRestartInstall}>
                {t('update.cancelRestartInstall')}
              </UpdateActionButton>
            </UpdateWidget>
          </>
        )}
        {status === 'error' && (
          <>
            <FooterVersionText variant="caption" color="text.secondary">
              |
            </FooterVersionText>
            <UpdateLink variant="caption" onClick={openDialog}>
              {t('update.error')}
            </UpdateLink>
          </>
        )}
      </FooterLeft>
      <FooterRight>
        <FooterVersionText variant="caption" color="text.secondary">
          {t('footer.poweredBy')}
        </FooterVersionText>
        <FfmpegBanner src={ffmpegBanner} alt="FFmpeg" />
      </FooterRight>
    </FooterBox>
  );
}
