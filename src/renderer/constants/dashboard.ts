/**
 * @fileoverview Constants shared by the dashboard page, its layout store and
 * the Quick Links page. Keeping the canonical card route list here means the
 * grid, the layout reconciliation and future card additions cannot drift.
 */

import { NAV_ITEMS } from '../../shared/app-constants';
import type { QuickLink } from '../stores/types';

/** localStorage key holding the serialized dashboard layout. */
export const DASHBOARD_LAYOUT_STORAGE_KEY = 'encodex-dashboard-layout';

/** Built-in group id shown before every custom group. */
export const FAVOURITES_GROUP_ID = 'favourites';

/** Sentinel for cards that are not in any group. */
export const UNGROUPED_GROUP_ID = 'ungrouped';

/** Maximum number of custom groups a user can create. */
export const MAX_CUSTOM_GROUPS = 12;

/** Maximum length of a custom group name. */
export const MAX_GROUP_NAME_LENGTH = 40;

/** Routes that are reachable from the drawer and therefore have no card. */
const EXCLUDED_DASHBOARD_ROUTES = new Set<string>(['/', '/logs', '/settings', '/about']);

/** Canonical order of every route that may appear as a dashboard card. */
export const DEFAULT_DASHBOARD_ROUTES: readonly string[] = NAV_ITEMS.filter((item) => !EXCLUDED_DASHBOARD_ROUTES.has(item.to)).map(
  (item) => item.to,
);

/** Nav translation key suffix for each dashboard card. */
export const DASHBOARD_CARD_TITLES: Readonly<Record<string, string>> = {
  '/copilot': 'copilot',
  '/convert': 'convert',
  '/remux': 'remux',
  '/demux': 'demux',
  '/video-cut': 'cut',
  '/audio-extract': 'audio',
  '/image-compress': 'image',
  '/batch': 'batchQueue',
  '/automations': 'automations',
  '/media-info': 'mediaInfo',
};

/** Dashboard translation key suffix for each card description. */
export const DASHBOARD_CARD_DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/copilot': 'descCopilot',
  '/convert': 'descConvert',
  '/remux': 'descRemux',
  '/demux': 'descDemux',
  '/video-cut': 'descCut',
  '/audio-extract': 'descAudio',
  '/image-compress': 'descImage',
  '/batch': 'descBatch',
  '/automations': 'descAutomations',
  '/media-info': 'descMediaInfo',
};

/** Categories offered on the Quick Links panel. Data is added in a later pass. */
export const QUICK_LINK_CATEGORIES: readonly string[] = ['all'];

/** Links shown on the Quick Links panel. Currently empty by design. */
export const QUICK_LINKS: readonly QuickLink[] = [];
