/**
 * @fileoverview Type definitions for the renderer pages.
 * Declares the shapes the page components use to describe their own local
 * view models.
 */

import type { DashboardGroupId } from '../stores/types';

/**
 * One cluster of concentric rings.
 * @interface RingGroup
 */
export interface RingGroup {
  /** Stable key for the cluster within the card. */
  id: number;
  /** Horizontal center of the rings in viewBox units. */
  cx: number;
  /** Vertical center of the rings in viewBox units. */
  cy: number;
  /** Radii of the concentric circles, smallest first. */
  radii: number[];
}

/** One feature card as seen by the dashboard grid and its edit controls. */
export interface DashboardCardSpec {
  to: string;
  titleKey: string;
  descriptionKey: string;
  groupId: DashboardGroupId | null;
}
