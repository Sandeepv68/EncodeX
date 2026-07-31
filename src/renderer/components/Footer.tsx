import { useTranslation } from 'react-i18next';
import ffmpegBanner from '../../../assets/ffmpeg_banner.png';
import pkg from '../../../package.json';
import { FooterBox, FooterVersionText, FooterRight, FfmpegBanner } from '../styles/Footer.styles';

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
