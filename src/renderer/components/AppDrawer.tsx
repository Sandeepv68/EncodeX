import type { ReactNode } from 'react';
import { Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material';
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
import { DRAWER_WIDTH, NAV_ITEMS } from '../../shared/app-constants';
import { useColorMode } from '../ColorModeContext';
import LanguageMenu from './LanguageMenu';

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
            onClick={() => {
              navigate(item.to);
              if (isMobile) onNavigate();
            }}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': { bgcolor: 'rgba(15,155,142,0.15)', '&:hover': { bgcolor: 'rgba(15,155,142,0.25)' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: location.pathname === item.to ? 'primary.main' : 'text.secondary' }}>
              {navIconMap[item.to]}
            </ListItemIcon>
            <ListItemText primary={t(`nav.${navKeyMap[item.to]}`)} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ borderColor: 'divider' }} />
      <LanguageMenu />
    </>
  );
}
