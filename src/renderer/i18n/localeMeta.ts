import { US, GB, CA, IN, ES, MX, FR, DE, IT, NL, SE, BR, UA, JP, KR, ID, SA, AE } from 'country-flag-icons/react/3x2';
import type { FlagComponent, LocaleMeta } from './types';

export const RTL_LOCALES = ['ar-SA', 'ar-AE'];

export const LOCALES: LocaleMeta[] = [
  { code: 'en-IN', label: 'English (India)', Flag: IN },
  { code: 'hi-IN', label: 'हिन्दी (India)', Flag: IN },
  { code: 'en-US', label: 'English (US)', Flag: US },
  { code: 'en-GB', label: 'English (UK)', Flag: GB },
  { code: 'en-CA', label: 'English (Canada)', Flag: CA },
  { code: 'es-ES', label: 'Español (España)', Flag: ES },
  { code: 'es-MX', label: 'Español (México)', Flag: MX },
  { code: 'fr-FR', label: 'Français (France)', Flag: FR },
  { code: 'fr-CA', label: 'Français (Canada)', Flag: CA },
  { code: 'de-DE', label: 'Deutsch (Germany)', Flag: DE },
  { code: 'it-IT', label: 'Italiano (Italy)', Flag: IT },
  { code: 'nl-NL', label: 'Nederlands (Netherlands)', Flag: NL },
  { code: 'sv-SE', label: 'Svenska (Sweden)', Flag: SE },
  { code: 'pt-BR', label: 'Português (Brasil)', Flag: BR },
  { code: 'uk-UA', label: 'Українська (Ukraine)', Flag: UA },
  { code: 'ja-JP', label: '日本語 (Japan)', Flag: JP },
  { code: 'ko-KR', label: '한국어 (South Korea)', Flag: KR },
  { code: 'id-ID', label: 'Bahasa Indonesia (Indonesia)', Flag: ID },
  { code: 'ar-SA', label: 'العربية (Saudi Arabia)', Flag: SA },
  { code: 'ar-AE', label: 'العربية (UAE)', Flag: AE },
];

export const LOCALE_MAP: Record<string, LocaleMeta> = Object.fromEntries(LOCALES.map((meta) => [meta.code, meta]));

export const isRtlLocale = (lng: string): boolean => RTL_LOCALES.some((c) => lng.startsWith(c));
