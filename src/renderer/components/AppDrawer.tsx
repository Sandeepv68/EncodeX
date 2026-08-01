import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import LanguageMenu from './LanguageMenu';
import { DrawerDivider, NavList, NavItemButton, NavItemIcon, NavItemText } from '../styles/AppDrawer.styles';

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
            <NavItemIcon $active={location.pathname === item.to}>{pageIcons[item.to]}</NavItemIcon>
            <NavItemText primary={t(`nav.${navKeyMap[item.to]}`)} />
          </NavItemButton>
        ))}
      </NavList>
      <DrawerDivider />
      <LanguageMenu />
    </>
  );
}
