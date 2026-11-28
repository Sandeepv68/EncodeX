import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QUICK_LINKS } from '../constants/dashboard';
import { useFeatureFlag } from '../hooks/useFeatureFlags';
import { quickLinkIcons } from '../pageIcons';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { CardBody, CardDescription, CardLink, CardTitleText, FeatureCard, FeatureIconBox } from '../styles/Dashboard.styles';
import { QuickLinksGrid, QuickLinksGridItem, QuickLinksPanelRoot, QuickLinksPanelTitle } from '../styles/QuickLinks.styles';

/** Renders the Quick Links panel that replaces only the dashboard card grid. */
export default function QuickLinksPanel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const automationsEnabled = useFeatureFlag('automations_page', import.meta.env.DEV);
  const visibleLinks = QUICK_LINKS.filter((link) => automationsEnabled || link.to !== '/automations');

  return (
    <QuickLinksPanelRoot data-testid="quick-links-panel">
      <QuickLinksPanelTitle variant="h6" component="h2">
        {t('quickLinks.title')}
      </QuickLinksPanelTitle>
      <QuickLinksGrid container spacing={2}>
        {visibleLinks.map((link, index) => (
          <QuickLinksGridItem size={{ xs: 12, sm: 6, md: 3 }} key={link.id}>
            <FeatureCard gradientAngle={index * 60}>
              <CardLink
                aria-label={t('quickLinks.cardAria', { title: t(link.labelKey) })}
                data-testid={`quick-link-${link.id}`}
                onClick={() => {
                  recordAnalyticsEvent(createAnalyticsEvent('quick_link_clicked', { route: link.to }));
                  navigate(link.to);
                }}
              >
                <FeatureIconBox>{quickLinkIcons[link.iconKey]}</FeatureIconBox>
                <CardBody>
                  <CardTitleText variant="h6" component="h3">
                    {t(link.labelKey)}
                  </CardTitleText>
                  <CardDescription variant="body2" color="text.secondary">
                    {t(link.descriptionKey)}
                  </CardDescription>
                </CardBody>
              </CardLink>
            </FeatureCard>
          </QuickLinksGridItem>
        ))}
      </QuickLinksGrid>
    </QuickLinksPanelRoot>
  );
}
