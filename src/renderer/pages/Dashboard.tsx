import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Typography } from '@mui/material';
import { Logger } from '../../shared/logger';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import { TitleIcon } from '../styles/PageContainer.styles';
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
      <WelcomeTitle variant="h4">
        <TitleIcon>{pageIcons['/']}</TitleIcon>
        {t('dashboard.welcome')}
      </WelcomeTitle>
      <DashboardSubtitle color="text.secondary">{t('dashboard.subtitle')}</DashboardSubtitle>
      <Grid container spacing={2}>
        {NAV_ITEMS.filter((item) => item.to !== '/' && item.to !== '/logs' && item.to !== '/settings').map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.to}>
            <FeatureCard>
              <CardLink onClick={() => navigate(item.to)}>
                <FeatureIconBox>{pageIcons[item.to]}</FeatureIconBox>
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
