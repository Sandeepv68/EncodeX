/**
 * @fileoverview Language switcher menu.
 *
 * Renders a button showing the active locale's flag and label, which opens a
 * popover {@link Menu} listing every available locale from LOCALES. Selecting a
 * locale switches the app language via i18next, persists the choice to
 * localStorage, and toggles the document text direction (RTL vs LTR) through
 * the color mode context.
 *
 * The component is embedded in the navigation drawer so users can switch
 * languages without leaving the current page.
 */

import { useMemo, useState } from 'react';
import { InputAdornment, Menu, MenuItem, TextField, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { Logger } from '../../shared/logger';
import { LOCALES, LOCALE_MAP, isRtlLocale } from '../i18n/localeMeta';
import { useColorMode } from '../ColorModeContext';
import i18n from '../i18n/config';
import {
  LanguageMenuBox,
  LanguageButton,
  LanguageLabel,
  FlagIconWrapper,
  SearchBox,
  LocaleList,
  menuPaperSx,
} from '../styles/LanguageMenu.styles';
import { LANGUAGE_STORAGE_KEY } from '../../shared/constants';
import { LOG_SWITCHING_LANGUAGE_TO } from '../../shared/log-constants';

/**
 * Logger instance for this module, scoped to the language menu.
 * @type {Logger}
 */
const log = new Logger('renderer/LanguageMenu');

/**
 * Renders the flag icon for a locale.
 *
 * Looks up the locale's flag component in LOCALE_MAP and renders it inside a
 * FlagIconWrapper. Returns null when the locale is unknown or has no flag, so
 * callers can safely render it for any locale code.
 * @param {{ locale: string }} props - Component props.
 * @param {string} props.locale - The locale code whose flag should be shown.
 * @returns {JSX.Element | null} The wrapped flag icon, or null when missing.
 */
function FlagIcon({ locale, condensed = false }: { locale: string; condensed?: boolean }) {
  const Flag = LOCALE_MAP[locale]?.Flag;
  return Flag ? (
    <FlagIconWrapper $condensed={condensed}>
      <Flag />
    </FlagIconWrapper>
  ) : null;
}

/**
 * Renders the language switcher button and menu.
 *
 * Shows a tooltip-wrapped {@link LanguageButton} containing the current
 * locale's {@link FlagIcon} and localized label; clicking it anchors an MUI
 * {@link Menu} at the button. The menu lists every entry in LOCALES with its
 * flag and label, marking the active locale as selected. Choosing an item calls
 * {@link switchLanguage}.
 *
 * @returns {JSX.Element} The language button and its dropdown menu.
 */
export default function LanguageMenu({ condensed = false }: { condensed?: boolean }) {
  const { t } = useTranslation();
  const { setDirection } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');

  /**
   * Closes the menu and clears the search query.
   */
  const closeMenu = () => {
    setAnchor(null);
    setQuery('');
  };

  /**
   * The locales matching the search query, by code or display label.
   * Returns every locale when the query is empty.
   * @type {LocaleMeta[]}
   */
  const filteredLocales = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LOCALES;
    return LOCALES.filter(({ code, label }) => code.toLowerCase().includes(q) || label.toLowerCase().includes(q));
  }, [query]);

  /**
   * Switches the active application language.
   *
   * Determines the text direction from the target locale (RTL for Arabic
   * locales, LTR otherwise), applies it to both the color mode context and the
   * document root, then awaits `i18n.changeLanguage`, persists the selection to
   * localStorage under LANGUAGE_STORAGE_KEY, and finally closes the menu. The
   * switch is logged for diagnostics.
   * @param {string} lng - The target locale code.
   * @returns {Promise<void>}
   */
  const switchLanguage = async (lng: string) => {
    log.info(LOG_SWITCHING_LANGUAGE_TO, lng);
    const dir = isRtlLocale(lng) ? 'rtl' : 'ltr';
    setDirection(dir);
    document.dir = dir;
    await i18n.changeLanguage(lng);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    closeMenu();
  };

  /**
   * Determines whether a locale code matches the active i18n language.
   *
   * Compares the prefix so that regional variants (e.g. `ar-SA` matching the
   * active `ar` language) are treated as active.
   * @param {string} code - The locale code to test.
   * @returns {boolean} True when the active language starts with `code`.
   */
  const isActive = (code: string) => i18n.language.startsWith(code);

  return (
    <>
      <LanguageMenuBox>
        <Tooltip title={t('app.language')}>
          <LanguageButton
            type="button"
            $condensed={condensed}
            data-testid="language-menu-button"
            onClick={(e) => setAnchor(e.currentTarget)}
          >
            <FlagIcon locale={i18n.language} condensed={condensed} />
            {!condensed && <LanguageLabel variant="caption">{LOCALE_MAP[i18n.language]?.label || i18n.language}</LanguageLabel>}
          </LanguageButton>
        </Tooltip>
      </LanguageMenuBox>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu} disableAutoFocusItem slotProps={{ paper: { sx: menuPaperSx } }}>
        <SearchBox>
          <TextField
            fullWidth
            size="small"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeMenu();
              }
              e.stopPropagation();
            }}
            placeholder={t('app.searchLanguage')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </SearchBox>
        <LocaleList>
          {filteredLocales.map(({ code, label }) => (
            <MenuItem key={code} selected={isActive(code)} onClick={() => switchLanguage(code)}>
              <FlagIcon locale={code} /> {label}
            </MenuItem>
          ))}
        </LocaleList>
      </Menu>
    </>
  );
}
