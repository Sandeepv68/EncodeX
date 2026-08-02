import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '../../shared/app-constants';
import { pageIcons } from '../pageIcons';
import { useConversionStore } from '../stores/conversionStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import LanguageMenu from './LanguageMenu';
import { DrawerDivider, NavList, NavItemButton, NavItemIcon, NavItemText, NavBlip } from '../styles/AppDrawer.styles';

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
  const isConverting = useConversionStore((s) => s.isConverting);
  const isExtractingAudio = useAudioExtractStore((s) => s.isConverting);

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
            {item.to === '/convert' && isConverting && <NavBlip aria-hidden="true" data-testid="nav-convert-blip" />}
            {item.to === '/audio-extract' && isExtractingAudio && <NavBlip aria-hidden="true" data-testid="nav-audio-extract-blip" />}
          </NavItemButton>
        ))}
      </NavList>
      <DrawerDivider />
      <LanguageMenu />
    </>
  );
}
