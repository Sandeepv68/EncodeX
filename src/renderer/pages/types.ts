/**
 * @fileoverview Type definitions for the renderer pages.
 * Declares the shapes the page components use to describe their own local
 * view models.
 */

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
