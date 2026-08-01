import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightLeft, faCircleInfo, faImage, faMusic, faScissors, faListCheck } from '@fortawesome/free-solid-svg-icons';
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
  '/convert': <FontAwesomeIcon icon={faRightLeft} />,
  '/media-info': <FontAwesomeIcon icon={faCircleInfo} />,
  '/image-compress': <FontAwesomeIcon icon={faImage} />,
  '/audio-extract': <FontAwesomeIcon icon={faMusic} />,
  '/video-cut': <FontAwesomeIcon icon={faScissors} />,
  '/batch': <FontAwesomeIcon icon={faListCheck} />,
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
        {NAV_ITEMS.filter((item) => item.to !== '/' && item.to !== '/logs' && item.to !== '/settings').map((item) => (
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
