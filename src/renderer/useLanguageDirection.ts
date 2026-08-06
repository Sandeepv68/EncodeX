/**
 * @fileoverview Hook that tracks the text direction implied by the active
 * i18n locale.
 *
 * Reads the current locale from the i18next instance, derives the layout
 * direction ('rtl' for RTL locales, 'ltr' otherwise) via `isRtlLocale`, and
 * keeps both the returned React state and the `document.dir` attribute in
 * sync. It re-evaluates whenever i18next fires its `languageChanged` event
 * and unsubscribes on unmount.
 *
 * Used by main.tsx to feed the emotion DirectionProvider (and thus the MUI
 * theme direction) and by AppLayout to keep layout state consistent.
 */

import { useEffect, useState } from 'react';
import i18n from './i18n/config';
import { isRtlLocale } from './i18n/localeMeta';

/**
 * Returns the current layout direction derived from the active i18n locale.
 * On mount and on every i18n `languageChanged` event the direction is
 * recomputed and applied to `document.dir`, so the DOM `dir` attribute always
 * matches the returned value.
 *
 * @returns {'ltr' | 'rtl'} The current layout direction: 'rtl' when the
 *   active locale is an RTL locale, 'ltr' otherwise.
 */
export function useLanguageDirection(): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() => (isRtlLocale(i18n.language) ? 'rtl' : 'ltr'));

  useEffect(() => {
    const update = () => {
      const dir = isRtlLocale(i18n.language) ? 'rtl' : 'ltr';
      setDirection(dir);
      document.dir = dir;
    };

    update();
    i18n.on('languageChanged', update);
    return () => {
      i18n.off('languageChanged', update);
    };
  }, []);

  return direction;
}
