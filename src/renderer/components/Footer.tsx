import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import ffmpegBanner from '../../../assets/ffmpeg_banner.png';
import pkg from '../../../package.json';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <Box
      component="footer"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mt: 'auto',
        py: 1,
        px: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
        {t('app.name')} {t('footer.version', { version: pkg.version })}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
          {t('footer.poweredBy')}
        </Typography>
        <Box component="img" src={ffmpegBanner} alt="FFmpeg" sx={{ height: 30 }} />
      </Box>
    </Box>
  );
}
