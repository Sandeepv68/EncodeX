import { useMemo, type ReactNode } from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from 'stylis-plugin-rtl';

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
