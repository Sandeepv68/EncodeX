import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  CssBaseline,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HomeIcon from '@mui/icons-material/Home';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import TranslateIcon from '@mui/icons-material/Translate';
import { ColorModeProvider, useColorMode } from './ColorModeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import ErrorSnackbar from './components/ErrorSnackbar';
import { useErrorStore } from './stores/errorStore';
import Dashboard from './pages/Dashboard';
import Convert from './pages/Convert';
import MediaInfo from './pages/MediaInfo';
import ImageCompress from './pages/ImageCompress';
import AudioExtract from './pages/AudioExtract';
import VideoCut from './pages/VideoCut';
import BatchQueue from './pages/BatchQueue';
import { DRAWER_WIDTH, NAV_ITEMS } from '../shared/ui-constants';
import i18n from './i18n/config';
import { useState, type ComponentType } from 'react';
import { US, GB, CA, IN, ES, MX, FR, DE, IT, NL, SE, BR, UA, JP, KR, ID, SA, AE } from 'country-flag-icons/react/3x2';

const flags: Record<string, ComponentType<{ style?: React.CSSProperties }>> = {
  'en-US': US,
  'en-GB': GB,
  'en-CA': CA,
  'en-IN': IN,
  'es-ES': ES,
  'es-MX': MX,
  'fr-FR': FR,
  'fr-CA': CA,
  'hi-IN': IN,
  'de-DE': DE,
  'it-IT': IT,
  'nl-NL': NL,
  'sv-SE': SE,
  'pt-BR': BR,
  'uk-UA': UA,
  'ja-JP': JP,
  'ko-KR': KR,
  'id-ID': ID,
  'ar-SA': SA,
  'ar-AE': AE,
};

const localeLabels: Record<string, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-CA': 'English (Canada)',
  'en-IN': 'English (India)',
  'es-ES': 'Español (España)',
  'es-MX': 'Español (México)',
  'fr-FR': 'Français (France)',
  'fr-CA': 'Français (Canada)',
  'hi-IN': 'हिन्दी (India)',
  'de-DE': 'Deutsch (Germany)',
  'it-IT': 'Italiano (Italy)',
  'nl-NL': 'Nederlands (Netherlands)',
  'sv-SE': 'Svenska (Sweden)',
  'pt-BR': 'Português (Brasil)',
  'uk-UA': 'Українська (Ukraine)',
  'ja-JP': '日本語 (Japan)',
  'ko-KR': '한국어 (South Korea)',
  'id-ID': 'Bahasa Indonesia (Indonesia)',
  'ar-SA': 'العربية (Saudi Arabia)',
  'ar-AE': 'العربية (UAE)',
};

const navIconMap: Record<string, React.ReactNode> = {
  '/': <HomeIcon />,
  '/convert': <SwapHorizIcon />,
  '/media-info': <InfoIcon />,
  '/image-compress': <ImageIcon />,
  '/audio-extract': <MusicNoteIcon />,
  '/video-cut': <ContentCutIcon />,
  '/batch': <QueueIcon />,
};

const navKeyMap: Record<string, string> = {
  '/': 'dashboard',
  '/convert': 'convert',
  '/media-info': 'mediaInfo',
  '/image-compress': 'image',
  '/audio-extract': 'audio',
  '/video-cut': 'cut',
  '/batch': 'batchQueue',
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode, setDirection } = useColorMode();
  const { currentError, clearError } = useErrorStore();
  const { t } = useTranslation();
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null);

  const RTL_LOCALES = ['ar-SA', 'ar-AE'];

  const switchLanguage = async (lng: string) => {
    const isRtl = RTL_LOCALES.some((c) => lng.startsWith(c));
    setDirection(isRtl ? 'rtl' : 'ltr');
    document.dir = isRtl ? 'rtl' : 'ltr';
    await i18n.changeLanguage(lng);
    localStorage.setItem('encodex-lang', lng);
    setLangAnchor(null);
  };

  const isActive = (code: string) => i18n.language.startsWith(code);

  function FlagIcon({ locale }: { locale: string }) {
    const Flag = flags[locale];
    return Flag ? <Flag style={{ width: 20, height: 15, marginRight: 8, verticalAlign: 'middle' }} /> : null;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
            {t('app.name')}
          </Typography>
          <Tooltip title={mode === 'dark' ? t('app.switchLight') : t('app.switchDark')}>
            <IconButton size="small" onClick={toggleColorMode} sx={{ color: 'text.secondary' }}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />
        <List sx={{ flex: 1, px: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.to}
              selected={location.pathname === item.to}
              onClick={() => navigate(item.to)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': { bgcolor: 'rgba(15,155,142,0.15)', '&:hover': { bgcolor: 'rgba(15,155,142,0.25)' } },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: location.pathname === item.to ? 'primary.main' : 'text.secondary' }}>
                {navIconMap[item.to]}
              </ListItemIcon>
              <ListItemText primary={t(`nav.${navKeyMap[item.to]}`)} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
          <Tooltip title={t('app.language')}>
            <Box
              component="button"
              onClick={(e) => setLangAnchor(e.currentTarget)}
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
              <Typography variant="caption" sx={{ textTransform: 'none', color: 'text.secondary', lineHeight: 1 }}>
                {localeLabels[i18n.language] || i18n.language}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
        <Menu
          anchorEl={langAnchor}
          open={Boolean(langAnchor)}
          onClose={() => setLangAnchor(null)}
          slotProps={{ paper: { sx: { maxHeight: 320 } } }}
        >
          <MenuItem selected={isActive('en-IN')} onClick={() => switchLanguage('en-IN')}>
            <FlagIcon locale="en-IN" /> English (India)
          </MenuItem>
          <MenuItem selected={isActive('hi-IN')} onClick={() => switchLanguage('hi-IN')}>
            <FlagIcon locale="hi-IN" /> हिन्दी (India)
          </MenuItem>
          <MenuItem selected={isActive('en-US')} onClick={() => switchLanguage('en-US')}>
            <FlagIcon locale="en-US" /> English (US)
          </MenuItem>
          <MenuItem selected={isActive('en-GB')} onClick={() => switchLanguage('en-GB')}>
            <FlagIcon locale="en-GB" /> English (UK)
          </MenuItem>
          <MenuItem selected={isActive('en-CA')} onClick={() => switchLanguage('en-CA')}>
            <FlagIcon locale="en-CA" /> English (Canada)
          </MenuItem>
          <MenuItem selected={isActive('es-ES')} onClick={() => switchLanguage('es-ES')}>
            <FlagIcon locale="es-ES" /> Español (España)
          </MenuItem>
          <MenuItem selected={isActive('es-MX')} onClick={() => switchLanguage('es-MX')}>
            <FlagIcon locale="es-MX" /> Español (México)
          </MenuItem>
          <MenuItem selected={isActive('fr-FR')} onClick={() => switchLanguage('fr-FR')}>
            <FlagIcon locale="fr-FR" /> Français (France)
          </MenuItem>
          <MenuItem selected={isActive('fr-CA')} onClick={() => switchLanguage('fr-CA')}>
            <FlagIcon locale="fr-CA" /> Français (Canada)
          </MenuItem>
          <MenuItem selected={isActive('de-DE')} onClick={() => switchLanguage('de-DE')}>
            <FlagIcon locale="de-DE" /> Deutsch (Germany)
          </MenuItem>
          <MenuItem selected={isActive('it-IT')} onClick={() => switchLanguage('it-IT')}>
            <FlagIcon locale="it-IT" /> Italiano (Italy)
          </MenuItem>
          <MenuItem selected={isActive('nl-NL')} onClick={() => switchLanguage('nl-NL')}>
            <FlagIcon locale="nl-NL" /> Nederlands (Netherlands)
          </MenuItem>
          <MenuItem selected={isActive('sv-SE')} onClick={() => switchLanguage('sv-SE')}>
            <FlagIcon locale="sv-SE" /> Svenska (Sweden)
          </MenuItem>
          <MenuItem selected={isActive('pt-BR')} onClick={() => switchLanguage('pt-BR')}>
            <FlagIcon locale="pt-BR" /> Português (Brasil)
          </MenuItem>
          <MenuItem selected={isActive('uk-UA')} onClick={() => switchLanguage('uk-UA')}>
            <FlagIcon locale="uk-UA" /> Українська (Ukraine)
          </MenuItem>
          <MenuItem selected={isActive('ja-JP')} onClick={() => switchLanguage('ja-JP')}>
            <FlagIcon locale="ja-JP" /> 日本語 (Japan)
          </MenuItem>
          <MenuItem selected={isActive('ko-KR')} onClick={() => switchLanguage('ko-KR')}>
            <FlagIcon locale="ko-KR" /> 한국어 (South Korea)
          </MenuItem>
          <MenuItem selected={isActive('id-ID')} onClick={() => switchLanguage('id-ID')}>
            <FlagIcon locale="id-ID" /> Bahasa Indonesia (Indonesia)
          </MenuItem>
          <MenuItem selected={isActive('ar-SA')} onClick={() => switchLanguage('ar-SA')}>
            <FlagIcon locale="ar-SA" /> العربية (Saudi Arabia)
          </MenuItem>
          <MenuItem selected={isActive('ar-AE')} onClick={() => switchLanguage('ar-AE')}>
            <FlagIcon locale="ar-AE" /> العربية (UAE)
          </MenuItem>
        </Menu>
      </Drawer>
      <Box component="main" sx={{ flex: 1, overflow: 'auto', p: 3, position: 'relative' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/convert" element={<ErrorBoundary><Convert /></ErrorBoundary>} />
            <Route path="/media-info" element={<ErrorBoundary><MediaInfo /></ErrorBoundary>} />
            <Route path="/image-compress" element={<ErrorBoundary><ImageCompress /></ErrorBoundary>} />
            <Route path="/audio-extract" element={<ErrorBoundary><AudioExtract /></ErrorBoundary>} />
            <Route path="/video-cut" element={<ErrorBoundary><VideoCut /></ErrorBoundary>} />
            <Route path="/batch" element={<ErrorBoundary><BatchQueue /></ErrorBoundary>} />
          </Routes>
        </ErrorBoundary>
      </Box>
      <ErrorSnackbar error={currentError} onClose={clearError} />
    </Box>
  );
}

export default function App() {
  return (
    <ColorModeProvider>
      <CssBaseline />
      <AppLayout />
    </ColorModeProvider>
  );
}
