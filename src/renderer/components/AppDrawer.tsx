/**
 * @fileoverview Application navigation drawer.
 *
 * Renders the persistent/sidebar navigation of the app by mapping the shared
 * NAV_ITEMS route table to MUI-styled list rows. Each row shows a page icon and
 * a localized label; the currently active route (matched against
 * `location.pathname`) is highlighted as selected.
 *
 * The drawer also surfaces live activity indicators ("blips") next to the
 * Convert, Audio Extract, and Video Cut entries while a
 * conversion/extraction/cut is running, and ends with a divider and the
 * {@link LanguageMenu} component so the active language can be switched
 * directly from the sidebar.
 *
 * Props (see {@link AppDrawerProps}):
 *  - isMobile: when true, tapping a nav row also fires `onNavigate` so the
 *    hosting layout can close a temporary (mobile) drawer.
 *  - onNavigate: callback invoked after a successful navigate on mobile.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import { useConversionStore } from '../stores/conversionStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import LanguageMenu from './LanguageMenu';
import type { AppDrawerProps } from './types';
import { DrawerDivider, NavList, NavItemButton, NavItemIcon, NavItemText, NavBlip } from '../styles/AppDrawer.styles';

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
 * and to the Video Cut row while `useVideoCutStore.isCutting` is true,
 * providing at-a-glance activity feedback.
 *
 * @param {AppDrawerProps} props - Component props.
 * @param {boolean} props.isMobile - True when the drawer is rendered in a
 *   temporary/mobile mode; triggers `onNavigate` after each click.
 * @param {() => void} props.onNavigate - Callback to close the drawer after
 *   navigation on mobile.
 * @returns {JSX.Element} The navigation list, divider, and language menu.
 */
export default function AppDrawer({ isMobile, onNavigate }: AppDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isConverting = useConversionStore((s) => s.isConverting);
  const isExtractingAudio = useAudioExtractStore((s) => s.isConverting);
  const isCutting = useVideoCutStore((s) => s.isCutting);

  return (
    <>
      <NavList>
        {NAV_ITEMS.map((item, index) => (
          <NavItemButton
            key={item.to}
            selected={location.pathname === item.to}
            sx={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => {
              navigate(item.to);
              if (isMobile) onNavigate();
            }}
          >
            <NavItemIcon $active={location.pathname === item.to}>{pageIcons[item.to]}</NavItemIcon>
            <NavItemText primary={t(`nav.${navKeyMap[item.to]}`)} />
            {item.to === '/convert' && isConverting && <NavBlip aria-hidden="true" data-testid="nav-convert-blip" />}
            {item.to === '/audio-extract' && isExtractingAudio && <NavBlip aria-hidden="true" data-testid="nav-audio-extract-blip" />}
            {item.to === '/video-cut' && isCutting && <NavBlip aria-hidden="true" data-testid="nav-video-cut-blip" />}
          </NavItemButton>
        ))}
      </NavList>
      <DrawerDivider />
      <LanguageMenu />
    </>
  );
}
