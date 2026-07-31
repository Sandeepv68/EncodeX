import { useState } from 'react';
import { Box, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Logger } from '../../shared/logger';
import { LOCALES, LOCALE_MAP, isRtlLocale } from '../i18n/localeMeta';
import { useColorMode } from '../ColorModeContext';
import i18n from '../i18n/config';

const log = new Logger('renderer/LanguageMenu');

function FlagIcon({ locale }: { locale: string }) {
  const Flag = LOCALE_MAP[locale]?.Flag;
  return Flag ? <Flag style={{ width: 20, height: 15, marginRight: 8, verticalAlign: 'middle' }} /> : null;
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
      <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', height: 47 }}>
        <Tooltip title={t('app.language')}>
          <Box
            component="button"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: 'text.secondary',
              bgcolor: 'transparent',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: '1px solid transparent',
              '&:hover': { borderColor: 'divider' },
            }}
          >
            <FlagIcon locale={i18n.language} />
            <Typography variant="caption" sx={{ textTransform: 'none', color: 'text.secondary', lineHeight: 1, fontWeight: 'bold' }}>
              {LOCALE_MAP[i18n.language]?.label || i18n.language}
            </Typography>
          </Box>
        </Tooltip>
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 320 } } }}>
        {LOCALES.map(({ code, label }) => (
          <MenuItem key={code} selected={isActive(code)} onClick={() => switchLanguage(code)}>
            <FlagIcon locale={code} /> {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
