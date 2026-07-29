import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { CssBaseline, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
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
import { DRAWER_WIDTH, NAV_ITEMS, APP_NAME } from '../shared/ui-constants';

const navIconMap: Record<string, React.ReactNode> = {
  '/': <HomeIcon />,
  '/convert': <SwapHorizIcon />,
  '/media-info': <InfoIcon />,
  '/image-compress': <ImageIcon />,
  '/audio-extract': <MusicNoteIcon />,
  '/video-cut': <ContentCutIcon />,
  '/batch': <QueueIcon />,
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useColorMode();
  const { currentError, clearError } = useErrorStore();

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>{APP_NAME}</Typography>
          <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
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
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flex: 1, overflow: 'auto', p: 3, position: 'relative' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/convert" element={<Convert />} />
            <Route path="/media-info" element={<MediaInfo />} />
            <Route path="/image-compress" element={<ImageCompress />} />
            <Route path="/audio-extract" element={<AudioExtract />} />
            <Route path="/video-cut" element={<VideoCut />} />
            <Route path="/batch" element={<BatchQueue />} />
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
