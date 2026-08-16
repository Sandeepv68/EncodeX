/**
 * @fileoverview Application navigation drawer.
 *
 * Renders the persistent/sidebar navigation of the app by mapping the shared
 * NAV_ITEMS route table to MUI-styled list rows. Each row shows a page icon and
 * a localized label; the currently active route (matched against
 * `location.pathname`) is highlighted as selected.
 *
 * The drawer also surfaces live activity indicators ("blips") on the Convert,
 * Audio Extract, and Video Cut rows while a conversion/extraction/cut is
 * running, plus a count badge on the Batch Queue row showing the number of jobs
 * currently in the queue. Each indicator sits at the end of its row in the
 * expanded drawer and becomes a corner badge on the nav icon when condensed. It
 * ends with a divider and a footer holding the {@link LanguageMenu} component
 * and (on desktop) the drawer condense toggle so the active language can be
 * switched and the sidebar collapsed from the same spot.
 *
 * Props (see {@link AppDrawerProps}):
 *  - isMobile: when true, tapping a nav row also fires `onNavigate` so the
 *    hosting layout can close a temporary (mobile) drawer.
 *  - onNavigate: callback invoked after a successful navigate on mobile.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import { useConversionStore } from '../stores/conversionStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { useQueueStore } from '../stores/queueStore';
import LanguageMenu from './LanguageMenu';
import type { AppDrawerProps } from './types';
import {
  DrawerDivider,
  NavList,
  NavFooter,
  CondenseButton,
  NavItemButton,
  NavItemIcon,
  NavItemText,
  NavBlip,
  NavCountBadge,
} from '../styles/AppDrawer.styles';

/**
 * Maps route paths from NAV_ITEMS to the i18n translation keys used for the
 * drawer labels (`nav.<key>`). The keys follow a camelCase convention that
 * differs from the URL segment names.
 * @const {Record<string, string>} navKeyMap
 */
const navKeyMap: Record<string, string> = {
  '/': 'dashboard',
  '/convert': 'convert',
  '/media-info': 'mediaInfo',
  '/image-compress': 'image',
  '/audio-extract': 'audio',
  '/video-cut': 'cut',
  '/batch': 'batchQueue',
  '/logs': 'logs',
  '/settings': 'settings',
  '/about': 'about',
};

/**
 * Renders the application navigation drawer.
 *
 * Iterates over the shared NAV_ITEMS table, producing a NavItemButton per
 * route. Clicking a row navigates to that route and, on mobile layouts, invokes
 * `onNavigate` so the parent can close the drawer. A row is marked selected
 * when its path exactly matches the current route. An animated NavBlip is
 * appended to the Convert row while `useConversionStore.isConverting` is true,
 * to the Audio Extract row while `useAudioExtractStore.isConverting` is true,
 * to the Video Cut row while `useVideoCutStore.isCutting` is true, and a red
 * count badge to the Batch Queue row while the queue holds at least one job,
 * providing at-a-glance activity feedback.
 *
 * @param {AppDrawerProps} props - Component props.
 * @param {boolean} props.isMobile - True when the drawer is rendered in a
 *   temporary/mobile mode; triggers `onNavigate` after each click.
 * @param {() => void} props.onNavigate - Callback to close the drawer after
 *   navigation on mobile.
 * @returns {JSX.Element} The navigation list, divider, and language menu.
 */
export default function AppDrawer({ isMobile, condensed, onToggleCondense, onNavigate }: AppDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isConverting = useConversionStore((s) => s.isConverting);
  const isExtractingAudio = useAudioExtractStore((s) => s.isConverting);
  const isCutting = useVideoCutStore((s) => s.isCutting);
  const batchJobCount = useQueueStore((s) => s.jobs.length);

  return (
    <>
      <NavList>
        {NAV_ITEMS.map((item, index) => (
          <NavItemButton
            key={item.to}
            $condensed={condensed}
            data-testid={`nav-item-${item.to === '/' ? 'dashboard' : item.to.slice(1)}`}
            selected={location.pathname === item.to}
            sx={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => {
              navigate(item.to);
              if (isMobile) onNavigate();
            }}
          >
            <NavItemIcon $active={location.pathname === item.to} $condensed={condensed}>
              {pageIcons[item.to]}
            </NavItemIcon>
            {!condensed && <NavItemText primary={t(`nav.${navKeyMap[item.to]}`)} />}
            {item.to === '/convert' && isConverting && <NavBlip $condensed={condensed} aria-hidden="true" data-testid="nav-convert-blip" />}
            {item.to === '/audio-extract' && isExtractingAudio && (
              <NavBlip $condensed={condensed} aria-hidden="true" data-testid="nav-audio-extract-blip" />
            )}
            {item.to === '/video-cut' && isCutting && (
              <NavBlip $condensed={condensed} aria-hidden="true" data-testid="nav-video-cut-blip" />
            )}
            {item.to === '/batch' && batchJobCount > 0 && (
              <NavCountBadge
                $condensed={condensed}
                data-testid="nav-batch-blip"
                aria-label={t('batchQueue.badgeCount', { count: batchJobCount })}
              >
                {batchJobCount}
              </NavCountBadge>
            )}
          </NavItemButton>
        ))}
      </NavList>
      <DrawerDivider />
      <NavFooter>
        {!isMobile && (
          <Tooltip title={t(condensed ? 'app.expand' : 'app.condense')}>
            <CondenseButton
              data-testid="drawer-condense-button"
              aria-label={t(condensed ? 'app.expand' : 'app.condense')}
              onClick={onToggleCondense}
            >
              <FontAwesomeIcon icon={condensed ? faChevronRight : faChevronLeft} />
            </CondenseButton>
          </Tooltip>
        )}
        <LanguageMenu condensed={condensed} />
      </NavFooter>
    </>
  );
}
