/**
 * @fileoverview Type definitions for the renderer application layer.
 * Defines color mode and color mode context value types.
 *
 * `ColorMode` and `ThemeId` are the discriminated values used across the color
 * system (colors.ts, theme.ts, ColorModeContext.tsx). `ColorModeContextValue`
 * is the shape exposed to consumers of the color mode context hook
 * `useColorMode`.
 *
 * The two design-system discriminants live in `src/shared/theme/types.ts` so the
 * MCP App views can share them; they are re-exported here for convenience.
 *
 * `NavigationGuard` and `NavigationGuardApi` describe the route-navigation
 * guard exposed by `NavigationGuardContext.tsx` to pages that hold unsaved
 * work.
 */

import type { ColorMode, ThemeId } from '../shared/theme/types';
import type { NavigateOptions, To } from 'react-router-dom';

export type { ColorMode, ThemeId };

/** Returns true when leaving the current route should ask for confirmation. */
export type NavigationGuard = () => boolean;

/** A navigate function that consults the registered guard before routing. */
export type GuardedNavigate = (to: To, options?: NavigateOptions) => void;

/**
 * Navigation helpers exposed to pages and chrome components.
 * @interface NavigationGuardApi
 * @property {GuardedNavigate} navigate - Navigates unless the active guard
 *   blocks the transition and opens the confirmation dialog.
 * @property {GuardedNavigate} navigateWithoutGuard - Navigates immediately,
 *   bypassing the guard. Used for app-initiated transitions such as the
 *   post-enqueue jump to the batch queue.
 * @property {(guard: NavigationGuard) => () => void} registerGuard - Registers
 *   the active route's guard and returns a cleanup that removes it. Registering
 *   a newer guard replaces the previous one.
 */
export interface NavigationGuardApi {
  navigate: GuardedNavigate;
  navigateWithoutGuard: GuardedNavigate;
  registerGuard: (guard: NavigationGuard) => () => void;
}

/**
 * Value exposed by the color mode context (see ColorModeContext.tsx).
 * @interface ColorModeContextValue
 * @property {ThemeId} themeId - Currently selected theme palette id.
 * @property {ColorMode} mode - Light/dark mode derived from the active theme.
 * @property {'ltr' | 'rtl'} direction - Current text layout direction.
 * @property {(dir: 'ltr' | 'rtl') => void} setDirection - Sets the text layout
 *   direction ('ltr' or 'rtl').
 * @property {(themeId: ThemeId) => void} setTheme - Switches to the given
 *   theme palette id.
 */
export interface ColorModeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl') => void;
  setTheme: (themeId: ThemeId) => void;
}
