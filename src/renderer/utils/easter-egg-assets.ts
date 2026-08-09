/**
 * @fileoverview Asset resolution for the seasonal Dashboard easter-egg logos.
 *
 * Bundles the default app icon and every festival logo from `assets/easter_eggs/`
 * and exposes a single resolver that maps a date to the icon URL the Dashboard
 * should render. When no festival window is active the default icon is returned.
 */

import { getActiveFestival } from './easter-egg-dates';
import type { FestivalId } from './easter-egg-dates';
import defaultIcon from '../../../assets/icons/Assets.xcassets/AppIcon.appiconset/1024.png';
import diwaliIcon from '../../../assets/easter_eggs/encodex_logo_diwali.png';
import christmasIcon from '../../../assets/easter_eggs/encodex_logo_christmas.png';
import easterIcon from '../../../assets/easter_eggs/encodex_logo_easter.png';
import holiIcon from '../../../assets/easter_eggs/encodex_logo_holi.png';
import halloweenIcon from '../../../assets/easter_eggs/encodex_logo_halloween.png';
import july4thIcon from '../../../assets/easter_eggs/encodex_logo_july4th.png';
import newYearIcon from '../../../assets/easter_eggs/encodex_logo_new_year.png';

/**
 * Maps each festival to its bundled logo asset.
 * @const {Record<FestivalId, string>} FESTIVAL_ICONS
 */
export const FESTIVAL_ICONS: Record<FestivalId, string> = {
  diwali: diwaliIcon,
  christmas: christmasIcon,
  easter: easterIcon,
  holi: holiIcon,
  halloween: halloweenIcon,
  july4th: july4thIcon,
  new_year: newYearIcon,
};

/**
 * Resolves the icon the Dashboard should display for a given date: the active
 * festival logo when one is in season, otherwise the default app icon.
 * @param {Date} date - The date to evaluate.
 * @returns {string} The URL of the icon to render.
 */
export function resolveDashboardAppIcon(date: Date): string {
  const festival = getActiveFestival(date);
  return festival ? FESTIVAL_ICONS[festival] : defaultIcon;
}
