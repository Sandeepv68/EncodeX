import type { ReactNode } from 'react';
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
import SettingsIcon from '@mui/icons-material/Settings';
import { NAV_ITEMS } from '../../shared/app-constants';
import LanguageMenu from './LanguageMenu';
import {
  DrawerHeader,
  AppTitle,
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
  '/settings': <SettingsIcon />,
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
  '/settings': 'settings',
};

interface AppDrawerProps {
  isMobile: boolean;
  onNavigate: () => void;
}

export default function AppDrawer({ isMobile, onNavigate }: AppDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <>
      <DrawerHeader>
        <AppTitle variant="h6">{t('app.name')}</AppTitle>
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
