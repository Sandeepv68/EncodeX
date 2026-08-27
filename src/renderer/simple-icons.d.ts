/**
 * @fileoverview Ambient type declarations for the `simple-icons` package.
 *
 * The packaged `simple-icons` v16 npm artifact does not ship its own `.d.ts`
 * files (its `package.json` declares `types: index.d.ts` that is not present in
 * the tarball), so the renderer would otherwise fail the strict TypeScript
 * typecheck. This module mirrors the minimal shape of the icons this app uses
 * (`SimpleIcon` plus the specific named brand exports consumed by
 * `ProfileSelector`).
 */

declare module 'simple-icons' {
  export interface SimpleIcon {
    title: string;
    slug: string;
    /** Official brand hex color, without the leading `#`. */
    hex: string;
    /** SVG path data (24x24 viewBox). */
    path: string;
    /** Optional source URL. */
    source?: string;
  }

  export const siYoutube: SimpleIcon;
  export const siInstagram: SimpleIcon;
  export const siTiktok: SimpleIcon;
  export const siFacebook: SimpleIcon;
  export const siX: SimpleIcon;
  export const siApple: SimpleIcon;
  export const siAndroid: SimpleIcon;
  export const siPlaystation: SimpleIcon;
  export const siPlaystation5: SimpleIcon;
  export const siDolby: SimpleIcon;
}
