import { useEffect, useState } from 'react';
import i18n from './i18n/config';
import { isRtlLocale } from './i18n/localeMeta';

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
