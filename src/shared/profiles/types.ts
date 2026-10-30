/**
 * @fileoverview Type definitions for the conversion-profile catalogue.
 * Describes the per-category metadata (display label, icon, ordering) used to
 * group the built-in and user-created conversion profiles in the UI.
 */

/**
 * Display metadata of one profile category.
 * @interface CategoryMeta
 * @property {string} label - Human-readable category label.
 * @property {string} icon - FontAwesome icon key for the category header.
 * @property {number} order - Sort order of the category in the selector.
 */
export interface CategoryMeta {
  label: string;
  icon: string;
  order: number;
}
