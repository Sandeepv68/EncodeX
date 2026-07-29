import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, CardActionArea, Typography, Grid } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import QueueIcon from '@mui/icons-material/Queue';
import { NAV_ITEMS } from '../../shared/ui-constants';

const featureIcons: Record<string, React.ReactNode> = {
  '/convert': <SwapHorizIcon sx={{ fontSize: 40 }} />,
  '/media-info': <InfoIcon sx={{ fontSize: 40 }} />,
  '/image-compress': <ImageIcon sx={{ fontSize: 40 }} />,
  '/audio-extract': <MusicNoteIcon sx={{ fontSize: 40 }} />,
  '/video-cut': <ContentCutIcon sx={{ fontSize: 40 }} />,
  '/batch': <QueueIcon sx={{ fontSize: 40 }} />,
};

const featureDescriptions: Record<string, string> = {
  '/convert': 'Change codecs, resolution, pixel format',
  '/media-info': 'View detailed stream information',
  '/image-compress': 'Compress images with format control',
  '/audio-extract': 'Extract audio from video files',
  '/video-cut': 'Cut video with frame-accurate player',
  '/batch': 'Process multiple files at once',
};

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>Welcome to OpenConverter</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Simple and user-friendly tools to convert, edit, and process audio and video files.
      </Typography>
      <Grid container spacing={2}>
        {NAV_ITEMS.filter((item) => item.to !== '/').map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.to}>
            <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', transition: 'border-color 0.2s, transform 0.2s', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}>
              <CardActionArea onClick={() => navigate(item.to)} sx={{ p: 2 }}>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{featureIcons[item.to]}</Box>
                <CardContent sx={{ p: 0 }}>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{featureDescriptions[item.to]}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
