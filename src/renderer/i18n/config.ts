import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import enIN from './locales/en-IN.json';
import enCA from './locales/en-CA.json';
import esES from './locales/es-ES.json';
import esMX from './locales/es-MX.json';
import frFR from './locales/fr-FR.json';
import frCA from './locales/fr-CA.json';
import hiIN from './locales/hi-IN.json';
import deDE from './locales/de-DE.json';
import itIT from './locales/it-IT.json';
import nlNL from './locales/nl-NL.json';
import svSE from './locales/sv-SE.json';
import ptBR from './locales/pt-BR.json';
import ukUA from './locales/uk-UA.json';
import jaJP from './locales/ja-JP.json';
import koKR from './locales/ko-KR.json';
import idID from './locales/id-ID.json';
import arSA from './locales/ar-SA.json';
import arAE from './locales/ar-AE.json';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../../shared/constants';

const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'en-GB': { translation: enGB },
    'en-IN': { translation: enIN },
    'en-CA': { translation: enCA },
    'es-ES': { translation: esES },
    'es-MX': { translation: esMX },
    'fr-FR': { translation: frFR },
    'fr-CA': { translation: frCA },
    'hi-IN': { translation: hiIN },
    'de-DE': { translation: deDE },
    'it-IT': { translation: itIT },
    'nl-NL': { translation: nlNL },
    'sv-SE': { translation: svSE },
    'pt-BR': { translation: ptBR },
    'uk-UA': { translation: ukUA },
    'ja-JP': { translation: jaJP },
    'ko-KR': { translation: koKR },
    'id-ID': { translation: idID },
    'ar-SA': { translation: arSA },
    'ar-AE': { translation: arAE },
  },
  lng: savedLang,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18n;
