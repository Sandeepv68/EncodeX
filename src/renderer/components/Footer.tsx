/**
 * @fileoverview Application footer bar.
 *
 * Renders the bottom footer of the app showing the localized application name
 * and current version (read from package.json), alongside a localized
 * "powered by" label and the FFmpeg banner image.
 *
 * The footer is rendered once in the root layout and provides a lightweight,
 * always-visible attribution strip. It has no props and no state.
 */

import { useTranslation } from 'react-i18next';
import ffmpegBanner from '../../../assets/ffmpeg_banner.png';
import pkg from '../../../package.json';
import { FooterBox, FooterVersionText, FooterRight, FfmpegBanner } from '../styles/Footer.styles';

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
  return (
    <FooterBox>
      <FooterVersionText variant="caption" color="text.secondary">
        {t('app.name')} {t('footer.version', { version: pkg.version })}
      </FooterVersionText>
      <FooterRight>
        <FooterVersionText variant="caption" color="text.secondary">
          {t('footer.poweredBy')}
        </FooterVersionText>
        <FfmpegBanner src={ffmpegBanner} alt="FFmpeg" />
      </FooterRight>
    </FooterBox>
  );
}
