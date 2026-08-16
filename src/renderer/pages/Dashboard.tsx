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
 * The welcome icon is resolved through `resolveDashboardAppIcon`, which swaps
 * the default app icon for a festival logo when a seasonal easter-egg window is
 * active.
 *
 * Side effects: logs `LOG_DASHBOARD_RENDERED` once on mount for debugging.
 * No IPC calls are made from this page.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logger } from '../../shared/logger';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import { resolveDashboardAppIcon } from '../utils/easter-egg-assets';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUTS, SHORTCUT_BY_ID, formatShortcut } from '../constants/shortcuts';

import {
  WelcomeTitle,
  WelcomeIcon,
  DashboardSubtitle,
  FeatureCard,
  CardLink,
  FeatureIconBox,
  CardTitleText,
  CardBody,
  DashboardRoot,
  FeatureGrid,
  FeatureGridItem,
  CardDescription,
  CardBackgroundSvg,
  DashboardFooter,
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

/** One cluster of concentric rings. @interface RingGroup */
interface RingGroup {
  /** Stable key for the cluster within the card. */
  id: number;
  /** Horizontal center of the rings in viewBox units. */
  cx: number;
  /** Vertical center of the rings in viewBox units. */
  cy: number;
  /** Radii of the concentric circles, smallest first. */
  radii: number[];
}

/** Hashes a string into a 32-bit seed for the deterministic PRNG. @function hashSeed */
function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Mulberry32 PRNG; returns a function yielding floats in [0, 1). @function mulberry32 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic set of concentric-ring clusters for a card, seeded by
 * its route key so the same card always gets the same background while
 * different cards get different placements.
 * @param {string} key - Route key used to seed the randomness.
 * @returns {RingGroup[]} Ring clusters to render in the card background.
 */
function buildCardRings(key: string): RingGroup[] {
  const rand = mulberry32(hashSeed(key));
  const groupCount = 2 + Math.floor(rand() * 3);
  const groups: RingGroup[] = [];
  for (let i = 0; i < groupCount; i += 1) {
    const cx = 20 + Math.round(rand() * 160);
    const cy = 20 + Math.round(rand() * 160);
    const ringCount = 3 + Math.floor(rand() * 3);
    const base = 10 + rand() * 12;
    const step = 9 + rand() * 6;
    const radii: number[] = [];
    for (let r = 0; r < ringCount; r += 1) {
      radii.push(Math.round(base + r * step));
    }
    groups.push({ id: i, cx, cy, radii });
  }
  return groups;
}

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
  const appIcon = resolveDashboardAppIcon(new Date());

  /**
   * Emits a debug log marker once when the page is mounted.
   * @returns {void}
   */
  useEffect(() => {
    log.debug(LOG_DASHBOARD_RENDERED);
  }, []);

  /**
   * Registers the dashboard keyboard shortcuts (1-6), one per feature card,
   * navigating to each spec's target route.
   * @returns {void}
   */
  useHotkeys(
    SHORTCUTS.filter((spec) => spec.section === 'dashboard' && spec.to).map((spec) => ({
      id: spec.id,
      handler: () => navigate(spec.to!),
    })),
  );

  return (
    <DashboardRoot>
      <WelcomeTitle variant="h4" component="h1">
        <WelcomeIcon src={appIcon} alt="" draggable={false} />
        {t('dashboard.welcome')} 👋
      </WelcomeTitle>
      <DashboardSubtitle color="text.secondary">{t('dashboard.subtitle')}</DashboardSubtitle>
      <FeatureGrid container spacing={2}>
        {NAV_ITEMS.filter((item) => item.to !== '/' && item.to !== '/logs' && item.to !== '/settings').map((item, index) => (
          <FeatureGridItem size={{ xs: 12, sm: 6, md: 4 }} key={item.to}>
            <FeatureCard gradientAngle={index * 60} sx={{ animationDelay: `${0.3 + index * 0.08}s` }}>
              <CardBackgroundSvg aria-hidden="true" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
                {buildCardRings(item.to).map((ring) => (
                  <g key={ring.id} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
                    {ring.radii.map((r) => (
                      <circle key={r} cx={ring.cx} cy={ring.cy} r={r} />
                    ))}
                  </g>
                ))}
              </CardBackgroundSvg>
              <CardLink onClick={() => navigate(item.to)}>
                <FeatureIconBox>{pageIcons[item.to]}</FeatureIconBox>
                <CardBody>
                  <CardTitleText variant="h6" component="h2">
                    {t(
                      `nav.${item.to === '/convert' ? 'convert' : item.to === '/media-info' ? 'mediaInfo' : item.to === '/image-compress' ? 'image' : item.to === '/audio-extract' ? 'audio' : item.to === '/video-cut' ? 'cut' : 'batchQueue'}`,
                    )}
                  </CardTitleText>
                  <CardDescription variant="body2" color="text.secondary">
                    {t(`dashboard.${descKeys[item.to]}`)}
                  </CardDescription>
                </CardBody>
              </CardLink>
            </FeatureCard>
          </FeatureGridItem>
        ))}
      </FeatureGrid>
      <DashboardFooter variant="caption" color="text.secondary" data-testid="dashboard-shortcuts-hint">
        {t('dashboard.shortcutsFooter', { shortcut: formatShortcut(SHORTCUT_BY_ID['global.help'].keys) })}
      </DashboardFooter>
    </DashboardRoot>
  );
}
