/**
 * @fileoverview Dashboard page. The landing/home screen that greets the user and
 * links to every tool in the app. Corresponds to the `/` route.
 *
 * Renders a welcome heading and a responsive grid of feature cards, one per
 * destination from `NAV_ITEMS` (excluding `/logs` and `/settings`). Clicking a
 * card navigates to the corresponding route via `useNavigate`. Each card shows
 * the page icon from `pageIcons` and translated title/description text keyed by
 * route through `descKeys`.
 *
 * Side effects: logs `LOG_DASHBOARD_RENDERED` once on mount for debugging.
 * No IPC calls are made from this page.
 */

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
import { LOG_DASHBOARD_RENDERED } from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Used to emit the on-mount render marker.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/Dashboard');

/**
 * Maps each feature-card route to the translation key holding its description.
 * Keys are read under the `dashboard.` namespace when rendering cards.
 * @const {Record<string, string>}
 */
const descKeys: Record<string, string> = {
  '/convert': 'descConvert',
  '/media-info': 'descMediaInfo',
  '/image-compress': 'descImage',
  '/audio-extract': 'descAudio',
  '/video-cut': 'descCut',
  '/batch': 'descBatch',
};

/**
 * Renders the Dashboard page (`/`).
 *
 * Displays a welcome title and subtitle, then a responsive `Grid` of
 * `FeatureCard`s built from `NAV_ITEMS`. The `/logs` and `/settings` items are
 * filtered out because they are reachable through the navigation bar instead.
 * Each card navigates to its route when clicked.
 *
 * Side effects: logs `LOG_DASHBOARD_RENDERED` at debug level once on mount so
 * the main-process log can confirm the renderer reached this page.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  /**
   * Emits a debug log marker once when the page is mounted.
   * @returns {void}
   */
  useEffect(() => {
    log.debug(LOG_DASHBOARD_RENDERED);
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
