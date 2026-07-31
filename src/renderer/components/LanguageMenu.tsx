import { useState } from 'react';
import { Menu, MenuItem, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Logger } from '../../shared/logger';
import { LOCALES, LOCALE_MAP, isRtlLocale } from '../i18n/localeMeta';
import { useColorMode } from '../ColorModeContext';
import i18n from '../i18n/config';
import { LanguageMenuBox, LanguageButton, LanguageLabel, FlagIconWrapper, menuPaperSx } from '../styles/LanguageMenu.styles';

const log = new Logger('renderer/LanguageMenu');

function FlagIcon({ locale }: { locale: string }) {
  const Flag = LOCALE_MAP[locale]?.Flag;
  return Flag ? (
    <FlagIconWrapper>
      <Flag />
    </FlagIconWrapper>
  ) : null;
}

export default function LanguageMenu() {
  const { t } = useTranslation();
  const { setDirection } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const switchLanguage = async (lng: string) => {
    log.info('Switching language to:', lng);
    const dir = isRtlLocale(lng) ? 'rtl' : 'ltr';
    setDirection(dir);
    document.dir = dir;
    await i18n.changeLanguage(lng);
    localStorage.setItem('encodex-lang', lng);
    setAnchor(null);
  };

  const isActive = (code: string) => i18n.language.startsWith(code);

  return (
    <>
      <LanguageMenuBox>
        <Tooltip title={t('app.language')}>
          <LanguageButton type="button" onClick={(e) => setAnchor(e.currentTarget)}>
            <FlagIcon locale={i18n.language} />
            <LanguageLabel variant="caption">{LOCALE_MAP[i18n.language]?.label || i18n.language}</LanguageLabel>
          </LanguageButton>
        </Tooltip>
      </LanguageMenuBox>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: menuPaperSx } }}>
        {LOCALES.map(({ code, label }) => (
          <MenuItem key={code} selected={isActive(code)} onClick={() => switchLanguage(code)}>
            <FlagIcon locale={code} /> {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
