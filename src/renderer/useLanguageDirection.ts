import { useEffect, useState } from 'react';
import i18n from './i18n/config';

const RTL_LOCALES = ['ar-SA', 'ar-AE'];

export function useLanguageDirection(): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() => (RTL_LOCALES.some((c) => i18n.language.startsWith(c)) ? 'rtl' : 'ltr'));

  useEffect(() => {
    const update = () => {
      const isRtl = RTL_LOCALES.some((c) => i18n.language.startsWith(c));
      const dir = isRtl ? 'rtl' : 'ltr';
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
