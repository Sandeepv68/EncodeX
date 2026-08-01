import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faRightLeft,
  faCircleInfo,
  faImage,
  faMusic,
  faScissors,
  faListCheck,
  faFileLines,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { NAV_ITEMS } from '../../shared/app-constants';
import LanguageMenu from './LanguageMenu';
import { DrawerDivider, NavList, NavItemButton, NavItemIcon, NavItemText } from '../styles/AppDrawer.styles';

const navIconMap: Record<string, ReactNode> = {
  '/': <FontAwesomeIcon icon={faHouse} />,
  '/convert': <FontAwesomeIcon icon={faRightLeft} />,
  '/media-info': <FontAwesomeIcon icon={faCircleInfo} />,
  '/image-compress': <FontAwesomeIcon icon={faImage} />,
  '/audio-extract': <FontAwesomeIcon icon={faMusic} />,
  '/video-cut': <FontAwesomeIcon icon={faScissors} />,
  '/batch': <FontAwesomeIcon icon={faListCheck} />,
  '/logs': <FontAwesomeIcon icon={faFileLines} />,
  '/settings': <FontAwesomeIcon icon={faGear} />,
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
