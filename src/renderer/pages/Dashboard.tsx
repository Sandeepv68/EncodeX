import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Typography } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import { Logger } from '../../shared/logger';
import { NAV_ITEMS } from '../../shared/app-constants';
import {
  WelcomeTitle,
  DashboardSubtitle,
  FeatureCard,
  CardLink,
  FeatureIconBox,
  CardTitleText,
  CardBody,
} from '../styles/Dashboard.styles';

const log = new Logger('renderer/pages/Dashboard');

const featureIcons: Record<string, React.ReactNode> = {
  '/convert': <SwapHorizIcon fontSize="inherit" />,
  '/media-info': <InfoIcon fontSize="inherit" />,
  '/image-compress': <ImageIcon fontSize="inherit" />,
  '/audio-extract': <MusicNoteIcon fontSize="inherit" />,
  '/video-cut': <ContentCutIcon fontSize="inherit" />,
  '/batch': <QueueIcon fontSize="inherit" />,
};

const descKeys: Record<string, string> = {
  '/convert': 'descConvert',
  '/media-info': 'descMediaInfo',
  '/image-compress': 'descImage',
  '/audio-extract': 'descAudio',
  '/video-cut': 'descCut',
  '/batch': 'descBatch',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    log.debug('Dashboard rendered');
  }, []);
  return (
    <Box>
      <WelcomeTitle variant="h4">{t('dashboard.welcome')}</WelcomeTitle>
      <DashboardSubtitle color="text.secondary">{t('dashboard.subtitle')}</DashboardSubtitle>
      <Grid container spacing={2}>
        {NAV_ITEMS.filter((item) => item.to !== '/' && item.to !== '/logs').map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.to}>
            <FeatureCard>
              <CardLink onClick={() => navigate(item.to)}>
                <FeatureIconBox>{featureIcons[item.to]}</FeatureIconBox>
                <CardBody>
                  <CardTitleText variant="h6">
                    {t(
                      `nav.${item.to === '/convert' ? 'convert' : item.to === '/media-info' ? 'mediaInfo' : item.to === '/image-compress' ? 'image' : item.to === '/audio-extract' ? 'audio' : item.to === '/video-cut' ? 'cut' : 'batchQueue'}`,
                    )}
                  </CardTitleText>
                  <Typography variant="body2" color="text.secondary">
                    {t(`dashboard.${descKeys[item.to]}`)}
                  </Typography>
                </CardBody>
              </CardLink>
            </FeatureCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
