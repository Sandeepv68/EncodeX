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

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { NAV_ITEMS } from '../../shared/app-constants';
import { QUEUE_STATUS } from '../../shared/media-options';
import { pageIcons } from '../pageIcons';
import { useConversionStore } from '../stores/conversionStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { useQueueStore } from '../stores/queueStore';
import LanguageMenu from './LanguageMenu';
import NavJobPopover from './NavJobPopover';
import type { AppDrawerProps, NavBlipId, NavJobPopoverContent } from './types';
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
 * Delay (ms) after the pointer leaves the nav row or popover card before the
 * popover closes, so moving between the two does not cause flicker.
 * @const {number} POPOVER_CLOSE_DELAY_MS
 */
const POPOVER_CLOSE_DELAY_MS = 150;

/**
 * Extracts the file name portion of an absolute path without a Node `path`
 * import, handling both forward and Windows back slashes.
 * @param {string | null} filePath - Absolute file path, or null.
 * @returns {string} The basename, or '' when the path is empty.
 */
function basenameOf(filePath: string | null): string {
  if (!filePath) return '';
  return filePath.split(/[\\/]/).pop() ?? '';
}

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
  const convertInput = useConversionStore((s) => s.inputFile);
  const convertProgress = useConversionStore((s) => s.progress);
  const convertPaused = useConversionStore((s) => s.isPaused);
  const isExtractingAudio = useAudioExtractStore((s) => s.isConverting);
  const audioInput = useAudioExtractStore((s) => s.input);
  const audioProgress = useAudioExtractStore((s) => s.progress);
  const audioPaused = useAudioExtractStore((s) => s.isPaused);
  const isCutting = useVideoCutStore((s) => s.isCutting);
  const cutInput = useVideoCutStore((s) => s.input);
  const cutProgress = useVideoCutStore((s) => s.progress);
  const queueJobs = useQueueStore((s) => s.jobs);
  const queueProgress = useQueueStore((s) => s.progress);
  const batchJobCount = queueJobs.length;

  const [popoverBlip, setPopoverBlip] = useState<NavBlipId>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelPendingClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelPendingClose();
    closeTimer.current = window.setTimeout(() => {
      setPopoverBlip(null);
      setPopoverAnchor(null);
    }, POPOVER_CLOSE_DELAY_MS);
  };

  const closePopover = () => {
    cancelPendingClose();
    setPopoverBlip(null);
    setPopoverAnchor(null);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  /**
   * Returns the visible activity blip id for a nav route, or null when that
   * page currently has no job to surface. Guards the popover so it only opens
   * while the corresponding blip is actually rendered.
   * @param {string} to - The route path from NAV_ITEMS.
   * @returns {NavBlipId} The visible blip id, or null.
   */
  const blipForRoute = (to: string): NavBlipId => {
    switch (to) {
      case '/convert':
        return isConverting ? 'convert' : null;
      case '/audio-extract':
        return isExtractingAudio ? 'audio' : null;
      case '/video-cut':
        return isCutting ? 'cut' : null;
      case '/batch':
        return batchJobCount > 0 ? 'batch' : null;
      default:
        return null;
    }
  };

  /**
   * Opens the job popover for the nav row under the pointer/focus when that row
   * carries a live blip; otherwise closes any open popover immediately.
   * @param {React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>} e - The mouse/focus event.
   * @param {string} to - The route path of the hovered/focused row.
   * @returns {void}
   */
  const openPopover = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, to: string) => {
    const blip = blipForRoute(to);
    if (blip) {
      cancelPendingClose();
      setPopoverBlip(blip);
      setPopoverAnchor(e.currentTarget);
    } else {
      closePopover();
    }
  };

  /**
   * Resolves the popover content for the active blip from the relevant store.
   * Returns null (nothing to render) when the blip is not set or its job has
   * already finished.
   * @returns {NavJobPopoverContent | null} The popover content, or null.
   */
  const popoverContent: NavJobPopoverContent | null = (() => {
    switch (popoverBlip) {
      case 'convert':
        return isConverting
          ? {
              title: t('nav.convert'),
              status: t('nav.blip.converting'),
              fileName: basenameOf(convertInput),
              progress: convertProgress,
              paused: convertPaused,
              input: convertInput ?? '',
            }
          : null;
      case 'audio':
        return isExtractingAudio
          ? {
              title: t('nav.audio'),
              status: t('nav.blip.extracting'),
              fileName: basenameOf(audioInput),
              progress: audioProgress,
              paused: audioPaused,
              input: audioInput ?? '',
            }
          : null;
      case 'cut':
        return isCutting
          ? {
              title: t('nav.cut'),
              status: t('nav.blip.cutting'),
              fileName: basenameOf(cutInput),
              progress: cutProgress,
              input: cutInput ?? '',
            }
          : null;
      case 'batch': {
        if (batchJobCount === 0) return null;
        const running = queueJobs.find((j) => j.status === QUEUE_STATUS.RUNNING) ?? queueJobs[0];
        const snapshot = running ? queueProgress[running.id] : undefined;
        return {
          title: t('nav.batchQueue'),
          status: t('batchQueue.stats', {
            queued: queueJobs.filter((j) => j.status === QUEUE_STATUS.QUEUED).length,
            running: queueJobs.filter((j) => j.status === QUEUE_STATUS.RUNNING).length,
            done: queueJobs.filter((j) => j.status === QUEUE_STATUS.DONE).length,
            failed: queueJobs.filter((j) => j.status === QUEUE_STATUS.ERROR).length,
          }),
          fileName: running ? basenameOf(running.input) : '',
          progress: running
            ? {
                percent: running.progress,
                time: snapshot?.time ?? '',
                speed: snapshot?.speed ?? '',
                eta: snapshot?.eta ?? '',
              }
            : null,
          paused: running?.paused,
          input: running?.input ?? '',
          pendingThumbnails: queueJobs.filter((j) => j.status === QUEUE_STATUS.QUEUED).map((j) => j.input),
        };
      }
      default:
        return null;
    }
  })();

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
            onMouseEnter={(e) => openPopover(e, item.to)}
            onMouseLeave={scheduleClose}
            onFocus={(e) => openPopover(e, item.to)}
            onBlur={scheduleClose}
            onClick={() => {
              closePopover();
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
      <NavJobPopover
        active={popoverBlip}
        anchorEl={popoverAnchor}
        onClose={closePopover}
        content={popoverContent}
        onMouseEnter={cancelPendingClose}
        onMouseLeave={scheduleClose}
      />
    </>
  );
}
