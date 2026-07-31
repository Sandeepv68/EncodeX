import type { ReactNode } from 'react';
import { Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeIcon from '@mui/icons-material/Home';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import DescriptionIcon from '@mui/icons-material/Description';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { NAV_ITEMS } from '../../shared/app-constants';
import { useColorMode } from '../ColorModeContext';
import LanguageMenu from './LanguageMenu';
import {
  DrawerHeader,
  AppTitle,
  ThemeToggleButton,
  DrawerDivider,
  NavList,
  NavItemButton,
  NavItemIcon,
  NavItemText,
} from '../styles/AppDrawer.styles';

const navIconMap: Record<string, ReactNode> = {
  '/': <HomeIcon />,
  '/convert': <SwapHorizIcon />,
  '/media-info': <InfoIcon />,
  '/image-compress': <ImageIcon />,
  '/audio-extract': <MusicNoteIcon />,
  '/video-cut': <ContentCutIcon />,
  '/batch': <QueueIcon />,
  '/logs': <DescriptionIcon />,
};

const navKeyMap: Record<string, string> = {
  '/': 'dashboard',
  '/convert': 'convert',
  '/media-info': 'mediaInfo',
  '/image-compress': 'image',
  '/audio-extract': 'audio',
  '/video-cut': 'cut',
  '/batch': 'batchQueue',
  '/logs': 'logs',
};

interface AppDrawerProps {
  isMobile: boolean;
  onNavigate: () => void;
}

export default function AppDrawer({ isMobile, onNavigate }: AppDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useColorMode();
  const { t } = useTranslation();

  return (
    <>
      <DrawerHeader>
        <AppTitle variant="h6">{t('app.name')}</AppTitle>
        <Tooltip title={mode === 'dark' ? t('app.switchLight') : t('app.switchDark')}>
          <ThemeToggleButton size="small" onClick={toggleColorMode}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </ThemeToggleButton>
        </Tooltip>
      </DrawerHeader>
      <DrawerDivider />
      <NavList>
        {NAV_ITEMS.map((item) => (
          <NavItemButton
            key={item.to}
            selected={location.pathname === item.to}
            onClick={() => {
              navigate(item.to);
              if (isMobile) onNavigate();
            }}
          >
            <NavItemIcon $active={location.pathname === item.to}>{navIconMap[item.to]}</NavItemIcon>
            <NavItemText primary={t(`nav.${navKeyMap[item.to]}`)} />
          </NavItemButton>
        ))}
      </NavList>
      <DrawerDivider />
      <LanguageMenu />
    </>
  );
}
