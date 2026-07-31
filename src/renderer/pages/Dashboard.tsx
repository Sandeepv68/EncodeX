import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardContent, CardActionArea, Typography, Grid } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import { Logger } from '../../shared/logger';
import { NAV_ITEMS } from '../../shared/app-constants';

const log = new Logger('renderer/pages/Dashboard');

const featureIcons: Record<string, React.ReactNode> = {
  '/convert': <SwapHorizIcon sx={{ fontSize: 40 }} />,
  '/media-info': <InfoIcon sx={{ fontSize: 40 }} />,
  '/image-compress': <ImageIcon sx={{ fontSize: 40 }} />,
  '/audio-extract': <MusicNoteIcon sx={{ fontSize: 40 }} />,
  '/video-cut': <ContentCutIcon sx={{ fontSize: 40 }} />,
  '/batch': <QueueIcon sx={{ fontSize: 40 }} />,
};

const descKeys: Record<string, string> = {
  '/convert': 'descConvert',
  '/media-info': 'descMediaInfo',
  '/image-compress': 'descImage',
  '/audio-extract': 'descAudio',
  '/video-cut': 'descCut',
  '/batch': 'descBatch',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    log.debug('Dashboard rendered');
  }, []);
  return (
    <Box>
      <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
        {t('dashboard.welcome')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('dashboard.subtitle')}
      </Typography>
      <Grid container spacing={2}>
        {NAV_ITEMS.filter((item) => item.to !== '/' && item.to !== '/logs').map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.to}>
            <Card
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'border-color 0.2s, transform 0.2s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
              }}
            >
              <CardActionArea onClick={() => navigate(item.to)} sx={{ p: 2 }}>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{featureIcons[item.to]}</Box>
                <CardContent sx={{ p: 0 }}>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    {t(
                      `nav.${item.to === '/convert' ? 'convert' : item.to === '/media-info' ? 'mediaInfo' : item.to === '/image-compress' ? 'image' : item.to === '/audio-extract' ? 'audio' : item.to === '/video-cut' ? 'cut' : 'batchQueue'}`,
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`dashboard.${descKeys[item.to]}`)}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
