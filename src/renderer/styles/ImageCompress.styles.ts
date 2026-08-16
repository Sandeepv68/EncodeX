import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import type { ElementType } from 'react';
import { ToggleRow } from './form.styles';

export const ToggleSpacer = styled(Box)(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.up('sm')]: {
    display: 'block',
    height: theme.spacing(2.5),
  },
}));

/** Selected-image name emphasized inside the preview caption. @const SelectedImageName */
export const SelectedImageName = styled(Box)<{ component?: ElementType }>({
  fontWeight: 700,
});

/** Aspect-ratio toggle row nudged down to align with the fields' inputs. @const AspectRatioRow */
export const AspectRatioRow = styled(ToggleRow)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
}));
