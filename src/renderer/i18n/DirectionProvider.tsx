import { useMemo, type ReactNode } from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from 'stylis-plugin-rtl';

/**
 * @fileoverview React provider that applies the correct CSS text direction
 * (left-to-right or right-to-left) to the MUI component tree.
 *
 * The provider builds an Emotion cache whose key and stylis plugins depend on
 * the active direction: RTL layouts get the 'muirtl' cache with the RTL stylis
 * plugin, while LTR layouts get 'muiltr' without plugins. Wrapping the app (or
 * a subtree) in this provider keeps MUI styles aligned with the selected UI
 * language's text direction, which is required for RTL locales such as Arabic.
 */

/**
 * React provider that wraps children in a direction-appropriate Emotion cache.
 *
 * The cache is memoized and only recreated when `direction` changes. With RTL,
 * the stylis RTL plugin flips the generated CSS (mirroring margins, paddings,
 * and flips) so MUI components render correctly for right-to-left languages.
 *
 * @param {Object} props - Component props.
 * @param {'ltr' | 'rtl'} props.direction - Text direction to apply.
 * @param {ReactNode} props.children - The subtree to render under the cache.
 * @returns {ReactElement} A CacheProvider wrapping the children.
 */
export function DirectionProvider({ direction, children }: { direction: 'ltr' | 'rtl'; children: ReactNode }) {
  const cache = useMemo(
    () =>
      createCache({
        key: direction === 'rtl' ? 'muirtl' : 'muiltr',
        stylisPlugins: direction === 'rtl' ? [rtlPlugin] : [],
      }),
    [direction],
  );

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
