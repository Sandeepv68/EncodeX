import { styled } from '@mui/material/styles';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import { COLORS } from '../colors';

export const PlayerRoot = styled(Box)(({ theme }) => ({
  backgroundColor: COLORS.player.background,
  borderRadius: (theme.shape.borderRadius as number) * 2,
  overflow: 'hidden',
}));

export const PlayerCanvas = styled('canvas')(({ theme }) => ({
  maxWidth: '100%',
  maxHeight: theme.typography.pxToRem(400),
  display: 'block',
  cursor: 'pointer',
  margin: '0 auto',
}));

export const ControlsArea = styled(Box)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingBottom: theme.spacing(1.5),
  paddingTop: theme.spacing(0.5),
}));

export const SeekSlider = styled(Slider)({ color: COLORS.player.control, paddingTop: 0, paddingBottom: 0 });

export const ControlButton = styled(IconButton)({ color: COLORS.player.control });

export const ControlsRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

export const TimeText = styled(Typography)({ color: COLORS.player.control, marginLeft: 'auto' });
