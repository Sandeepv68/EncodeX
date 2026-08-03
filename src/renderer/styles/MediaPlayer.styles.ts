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

export const SeekArea = styled(Box)({
  position: 'relative',
});

export const MarkersSlider = styled(Slider)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  paddingTop: 0,
  paddingBottom: 0,
  pointerEvents: 'none',
  '& .MuiSlider-rail': {
    opacity: 0,
  },
  '& .MuiSlider-track': {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    opacity: 1,
  },
  '& .MuiSlider-thumb': {
    pointerEvents: 'auto',
    width: 10,
    height: 18,
    borderRadius: 2,
    boxShadow: 'none',
    '&:hover': {
      boxShadow: 'none',
    },
    '&::before': {
      boxShadow: 'none',
    },
    '&[data-index="0"]': {
      backgroundColor: COLORS.success,
    },
    '&[data-index="1"]': {
      backgroundColor: COLORS.error,
    },
  },
});

export const ControlButton = styled(IconButton)({ color: COLORS.player.control });

export const ControlsRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

export const TimeText = styled(Typography)({ color: COLORS.player.control, marginLeft: 'auto' });
