import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QUICK_LINKS, QUICK_LINK_CATEGORIES } from '../constants/dashboard';
import { pageIcons } from '../pageIcons';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { CardBody, CardDescription, CardLink, CardTitleText, FeatureCard, FeatureIconBox } from '../styles/Dashboard.styles';
import {
  QuickLinksEmpty,
  QuickLinksGrid,
  QuickLinksGridItem,
  QuickLinksPanelRoot,
  QuickLinksPanelTitle,
  QuickLinksTab,
  QuickLinksTabs,
} from '../styles/QuickLinks.styles';

/** Renders the Quick Links panel that replaces only the dashboard card grid. */
export default function QuickLinksPanel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>(QUICK_LINK_CATEGORIES[0]);
  const links = QUICK_LINKS.filter((link) => category === 'all' || link.category === category);

  useEffect(() => {
    recordAnalyticsEvent(createAnalyticsEvent('quick_links_tab_viewed', { category }));
  }, [category]);

  return (
    <QuickLinksPanelRoot data-testid="quick-links-panel">
      <QuickLinksPanelTitle variant="h6" component="h2">
        {t('quickLinks.title')}
      </QuickLinksPanelTitle>
      <QuickLinksTabs value={category} onChange={(_event, next: string) => setCategory(next)} aria-label={t('quickLinks.title')}>
        {QUICK_LINK_CATEGORIES.map((id) => (
          <QuickLinksTab key={id} value={id} label={t(`quickLinks.tabs.${id}`)} data-testid={`quick-links-tab-${id}`} />
        ))}
      </QuickLinksTabs>
      {links.length === 0 ? (
        <QuickLinksEmpty data-testid="quick-links-empty">{t('quickLinks.empty')}</QuickLinksEmpty>
      ) : (
        <QuickLinksGrid container spacing={2}>
          {links.map((link, index) => (
            <QuickLinksGridItem size={{ xs: 12, sm: 6, md: 4 }} key={link.to}>
              <FeatureCard gradientAngle={index * 60}>
                <CardLink
                  aria-label={t('quickLinks.cardAria', { title: t(`nav.${link.labelKey}`) })}
                  data-testid={`quick-link-${link.to}`}
                  onClick={() => {
                    recordAnalyticsEvent(createAnalyticsEvent('quick_link_clicked', { route: link.to }));
                    navigate(link.to);
                  }}
                >
                  <FeatureIconBox>{pageIcons[link.to]}</FeatureIconBox>
                  <CardBody>
                    <CardTitleText variant="h6" component="h3">
                      {t(`nav.${link.labelKey}`)}
                    </CardTitleText>
                    {link.descriptionKey && (
                      <CardDescription variant="body2" color="text.secondary">
                        {t(`dashboard.${link.descriptionKey}`)}
                      </CardDescription>
                    )}
                  </CardBody>
                </CardLink>
              </FeatureCard>
            </QuickLinksGridItem>
          ))}
        </QuickLinksGrid>
      )}
    </QuickLinksPanelRoot>
  );
}
