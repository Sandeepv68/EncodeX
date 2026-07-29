import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import enIN from './locales/en-IN.json';
import esES from './locales/es-ES.json';
import frFR from './locales/fr-FR.json';
import frCA from './locales/fr-CA.json';
import hi from './locales/hi.json';

const savedLang = localStorage.getItem('encodex-lang') || 'en-US';

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'en-GB': { translation: enGB },
    'en-IN': { translation: enIN },
    'es-ES': { translation: esES },
    'fr-FR': { translation: frFR },
    'fr-CA': { translation: frCA },
    hi: { translation: hi },
  },
  lng: savedLang,
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

export default i18n;
