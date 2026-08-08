import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import enIN from './locales/en-IN.json';
import enCA from './locales/en-CA.json';
import enAU from './locales/en-AU.json';
import enSG from './locales/en-SG.json';
import enZA from './locales/en-ZA.json';
import esES from './locales/es-ES.json';
import esMX from './locales/es-MX.json';
import frFR from './locales/fr-FR.json';
import frCA from './locales/fr-CA.json';
import hiIN from './locales/hi-IN.json';
import deDE from './locales/de-DE.json';
import itIT from './locales/it-IT.json';
import nlNL from './locales/nl-NL.json';
import svSE from './locales/sv-SE.json';
import nbNO from './locales/nb-NO.json';
import ptBR from './locales/pt-BR.json';
import ukUA from './locales/uk-UA.json';
import ruRU from './locales/ru-RU.json';
import plPL from './locales/pl-PL.json';
import thTH from './locales/th-TH.json';
import siLK from './locales/si-LK.json';
import mnMN from './locales/mn-MN.json';
import msMY from './locales/ms-MY.json';
import msSG from './locales/ms-SG.json';
import zhSG from './locales/zh-SG.json';
import jaJP from './locales/ja-JP.json';
import koKR from './locales/ko-KR.json';
import idID from './locales/id-ID.json';
import filPH from './locales/fil-PH.json';
import tlPH from './locales/tl-PH.json';
import afZA from './locales/af-ZA.json';
import heIL from './locales/he-IL.json';
import arSA from './locales/ar-SA.json';
import arAE from './locales/ar-AE.json';
import arJO from './locales/ar-JO.json';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../../shared/constants';

/**
 * @fileoverview i18next configuration and initialization for the renderer.
 *
 * Bootstraps the global i18next instance with 37 built-in locale resources
 * (loaded from the JSON files in ./locales), a persisted language preference
 * read from localStorage (key 'encodex-lang'), and DEFAULT_LANGUAGE ('en-US')
 * as the fallback. The configured instance is exported as the default module
 * export so every renderer module can call i18n.t(...) or use react-i18next
 * hooks against a single shared instance.
 */

/**
 * The persisted language code (localStorage 'encodex-lang'), falling back to
 * DEFAULT_LANGUAGE ('en-US') when nothing is stored or storage is unavailable.
 * @type {string}
 */
const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;

/**
 * Registers the react-i18next plugin and initializes the i18next instance.
 * Loads the translation resources under the `translation` namespace for every
 * supported locale code, activates `savedLang` as the active language, and uses
 * DEFAULT_LANGUAGE as the fallback. Interpolation HTML escaping is disabled
 * because React already escapes rendered output.
 */
i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'en-GB': { translation: enGB },
    'en-IN': { translation: enIN },
    'en-CA': { translation: enCA },
    'en-AU': { translation: enAU },
    'en-SG': { translation: enSG },
    'en-ZA': { translation: enZA },
    'es-ES': { translation: esES },
    'es-MX': { translation: esMX },
    'fr-FR': { translation: frFR },
    'fr-CA': { translation: frCA },
    'hi-IN': { translation: hiIN },
    'de-DE': { translation: deDE },
    'it-IT': { translation: itIT },
    'nl-NL': { translation: nlNL },
    'sv-SE': { translation: svSE },
    'nb-NO': { translation: nbNO },
    'pt-BR': { translation: ptBR },
    'uk-UA': { translation: ukUA },
    'ru-RU': { translation: ruRU },
    'pl-PL': { translation: plPL },
    'th-TH': { translation: thTH },
    'si-LK': { translation: siLK },
    'mn-MN': { translation: mnMN },
    'ms-MY': { translation: msMY },
    'ms-SG': { translation: msSG },
    'zh-SG': { translation: zhSG },
    'ja-JP': { translation: jaJP },
    'ko-KR': { translation: koKR },
    'id-ID': { translation: idID },
    'fil-PH': { translation: filPH },
    'tl-PH': { translation: tlPH },
    'af-ZA': { translation: afZA },
    'he-IL': { translation: heIL },
    'ar-SA': { translation: arSA },
    'ar-AE': { translation: arAE },
    'ar-JO': { translation: arJO },
  },
  lng: savedLang,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

/**
 * The fully configured i18next instance shared across the renderer for all
 * translations (accessible via i18n.t / react-i18next hooks).
 * @type {i18next.i18n}
 */
export default i18n;
