import {
  US,
  GB,
  CA,
  IN,
  AU,
  SG,
  ZA,
  ES,
  MX,
  FR,
  DE,
  IT,
  NL,
  SE,
  NO,
  BR,
  UA,
  RU,
  PL,
  TH,
  LK,
  MN,
  MY,
  JP,
  KR,
  ID,
  PH,
  IL,
  SA,
  AE,
  JO,
  PT,
  NP,
  KH,
  VN,
  LA,
  TW,
  NZ,
  IS,
  GL,
  IE,
  FI,
  DK,
} from 'country-flag-icons/react/3x2';
import type { FlagComponent, LocaleMeta } from './types';

/**
 * @fileoverview Static metadata for the locales supported by the app's UI.
 *
 * Declares the full list of locales offered in the language picker (each with
 * its BCP-47 code, a display label in the locale's own script, and a flag
 * component), a code-to-metadata lookup map, and the set of right-to-left
 * locale codes together with a helper to test a language code against that set.
 * This module is consumed by the language picker UI and the RTL wiring in
 * DirectionProvider.
 */

/**
 * BCP-47 locale codes that require right-to-left text layout.
 * @type {string[]}
 */
export const RTL_LOCALES = ['ar-SA', 'ar-AE', 'ar-JO', 'he-IL'];

/**
 * The locales offered in the language picker, in display order.
 * Each entry pairs a BCP-47 code with a label in the locale's own script and a
 * flag component imported from country-flag-icons.
 * @type {LocaleMeta[]}
 */
export const LOCALES: LocaleMeta[] = [
  { code: 'en-IN', label: 'English (India)', Flag: IN },
  { code: 'hi-IN', label: 'हिन्दी (India)', Flag: IN },
  { code: 'en-US', label: 'English (US)', Flag: US },
  { code: 'en-GB', label: 'English (UK)', Flag: GB },
  { code: 'en-CA', label: 'English (Canada)', Flag: CA },
  { code: 'en-AU', label: 'English (Australia)', Flag: AU },
  { code: 'en-SG', label: 'English (Singapore)', Flag: SG },
  { code: 'en-ZA', label: 'English (South Africa)', Flag: ZA },
  { code: 'en-NZ', label: 'English (New Zealand)', Flag: NZ },
  { code: 'en-IE', label: 'English (Ireland)', Flag: IE },
  { code: 'es-ES', label: 'Español (España)', Flag: ES },
  { code: 'es-MX', label: 'Español (México)', Flag: MX },
  { code: 'es-AR', label: 'Español (Argentina)', Flag: ES },
  { code: 'es-CL', label: 'Español (Chile)', Flag: ES },
  { code: 'fr-FR', label: 'Français (France)', Flag: FR },
  { code: 'fr-CA', label: 'Français (Canada)', Flag: CA },
  { code: 'fr-BE', label: 'Français (Belgique)', Flag: FR },
  { code: 'de-DE', label: 'Deutsch (Germany)', Flag: DE },
  { code: 'de-BE', label: 'Deutsch (Belgien)', Flag: DE },
  { code: 'it-IT', label: 'Italiano (Italy)', Flag: IT },
  { code: 'nl-NL', label: 'Nederlands (Netherlands)', Flag: NL },
  { code: 'nl-BE', label: 'Nederlands (België)', Flag: NL },
  { code: 'sv-SE', label: 'Svenska (Sweden)', Flag: SE },
  { code: 'nb-NO', label: 'Norsk (Norge)', Flag: NO },
  { code: 'pt-BR', label: 'Português (Brasil)', Flag: BR },
  { code: 'pt-PT', label: 'Português (Portugal)', Flag: PT },
  { code: 'uk-UA', label: 'Українська (Ukraine)', Flag: UA },
  { code: 'ru-RU', label: 'Русский (Russia)', Flag: RU },
  { code: 'pl-PL', label: 'Polski (Polska)', Flag: PL },
  { code: 'th-TH', label: 'ไทย (Thailand)', Flag: TH },
  { code: 'si-LK', label: 'සිංහල (Sri Lanka)', Flag: LK },
  { code: 'mn-MN', label: 'Монгол (Mongolia)', Flag: MN },
  { code: 'ms-MY', label: 'Bahasa Melayu (Malaysia)', Flag: MY },
  { code: 'ms-SG', label: 'Bahasa Melayu (Singapore)', Flag: SG },
  { code: 'zh-SG', label: '中文 (Singapore)', Flag: SG },
  { code: 'zh-TW', label: '中文 (Taiwan)', Flag: TW },
  { code: 'ja-JP', label: '日本語 (Japan)', Flag: JP },
  { code: 'ko-KR', label: '한국어 (South Korea)', Flag: KR },
  { code: 'id-ID', label: 'Bahasa Indonesia (Indonesia)', Flag: ID },
  { code: 'fil-PH', label: 'Filipino (Philippines)', Flag: PH },
  { code: 'tl-PH', label: 'Tagalog (Philippines)', Flag: PH },
  { code: 'af-ZA', label: 'Afrikaans (South Africa)', Flag: ZA },
  { code: 'he-IL', label: 'עברית (Israel)', Flag: IL },
  { code: 'ar-SA', label: 'العربية (Saudi Arabia)', Flag: SA },
  { code: 'ar-AE', label: 'العربية (UAE)', Flag: AE },
  { code: 'ar-JO', label: 'العربية (Jordan)', Flag: JO },
  { code: 'ne-NP', label: 'नेपाली (Nepal)', Flag: NP },
  { code: 'km-KH', label: 'ភាសាខ្មែរ (Cambodia)', Flag: KH },
  { code: 'vi-VN', label: 'Tiếng Việt (Vietnam)', Flag: VN },
  { code: 'lo-LA', label: 'ລາວ (Laos)', Flag: LA },
  { code: 'mi-NZ', label: 'Māori (New Zealand)', Flag: NZ },
  { code: 'is-IS', label: 'Íslenska (Iceland)', Flag: IS },
  { code: 'kl-GL', label: 'Kalaallisut (Greenland)', Flag: GL },
  { code: 'ga-IE', label: 'Gaeilge (Ireland)', Flag: IE },
  { code: 'fi-FI', label: 'Suomi (Finland)', Flag: FI },
  { code: 'da-DK', label: 'Dansk (Danmark)', Flag: DK },
];

/**
 * Locale lookup table mapping a BCP-47 code to its LocaleMeta entry.
 * Built once from LOCALES so pickers and RTL checks can resolve metadata by
 * code in constant time.
 * @type {Record<string, LocaleMeta>}
 */
export const LOCALE_MAP: Record<string, LocaleMeta> = Object.fromEntries(LOCALES.map((meta) => [meta.code, meta]));

/**
 * Determines whether a language code belongs to an RTL locale.
 * A code matches when it starts with one of the RTL_LOCALES prefixes
 * (e.g. 'ar-SA' or 'ar-AE').
 * @param {string} lng - The language/locale code to test (e.g. 'ar-SA').
 * @returns {boolean} True when the code is an RTL locale.
 */
export const isRtlLocale = (lng: string): boolean => RTL_LOCALES.some((c) => lng.startsWith(c));
