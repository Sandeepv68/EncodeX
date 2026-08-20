/**
 * @fileoverview Application footer bar.
 *
 * Renders the bottom footer of the app showing the localized application name
 * and current version (read from package.json), alongside a localized
 * "powered by" label and the FFmpeg banner image.
 *
 * The footer also displays a small update indicator next to the version: a
 * spinner while checking for updates, and a link when an update is available.
 *
 * The footer is rendered once in the root layout and provides a lightweight,
 * always-visible attribution strip. It has no props and no state.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ffmpegBanner from '../../../assets/ffmpeg_banner.png';
import pkg from '../../../package.json';
import { useUpdateStore } from '../stores/updateStore';
import { useToastStore } from '../stores/toastStore';
import { FooterBox, FooterVersionText, FooterLeft, FooterRight, FfmpegBanner, UpdateLoader, UpdateLink } from '../styles/Footer.styles';

/**
 * Renders the application footer.
 *
 * Displays the localized app name joined with the installed version from
 * `package.json` on the left, and on the right the localized "powered by" text
 * followed by the FFmpeg banner image. Both sides use the caption variant with
 * secondary text color via the shared FooterVersionText style.
 *
 * @returns {JSX.Element} The footer bar.
 */
export default function Footer() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const info = useUpdateStore((s) => s.info);
  const openDialog = useUpdateStore((s) => s.openDialog);
  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const shownToastRef = useRef(false);

  useEffect(() => {
    if (status === 'available' && info && !shownToastRef.current) {
      shownToastRef.current = true;
      useToastStore.getState().info(t('toast.updateAvailable', { version: info.version }), undefined, 8000, {
        label: t('toast.updateNow'),
        onClick: () => {
          openDialog();
          downloadUpdate();
        },
      });
    }
    if (status === 'idle' || status === 'checking') {
      shownToastRef.current = false;
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
                version: info?.version,
              })}
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
