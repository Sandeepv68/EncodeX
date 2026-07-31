import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material';
import { Box, Typography } from '@mui/material';

export const LanguageMenuBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  display: 'flex',
  justifyContent: 'center',
  height: 47,
}));

export const LanguageButton = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  cursor: 'pointer',
  color: theme.palette.text.secondary,
  backgroundColor: 'transparent',
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  border: '1px solid transparent',
  fontFamily: 'inherit',
  '&:hover': { borderColor: theme.palette.divider },
}));

export const LanguageLabel = styled(Typography)(({ theme }) => ({
  textTransform: 'none',
  color: theme.palette.text.secondary,
  lineHeight: 1,
  fontWeight: 'bold',
}));

export const FlagIconWrapper = styled('span')({
  display: 'inline-flex',
  width: 20,
  height: 15,
  marginRight: 8,
  verticalAlign: 'middle',
  '& svg': { width: '100%', height: '100%' },
});

export const menuPaperSx: SxProps<Theme> = { maxHeight: 320 };
