import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material';
import { Box, Typography } from '@mui/material';

export const LanguageMenuBox = styled(Box)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(0.5),
  boxSizing: 'border-box',
}));

export const LanguageButton = styled('button', {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  cursor: 'pointer',
  color: theme.palette.text.secondary,
  backgroundColor: 'transparent',
  paddingInline: theme.spacing(1),
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid transparent`,
  fontFamily: 'inherit',
  ...($condensed && {
    justifyContent: 'center',
    paddingInline: 0,
    width: '100%',
  }),
  '&:hover': { borderColor: theme.palette.divider },
}));

export const LanguageLabel = styled(Typography)(({ theme }) => ({
  textTransform: 'none',
  color: theme.palette.text.secondary,
  lineHeight: 1,
  fontWeight: 'bold',
}));

export const FlagIconWrapper = styled('span', {
  shouldForwardProp: (prop) => prop !== '$condensed',
})<{ $condensed: boolean }>(({ theme, $condensed }) => ({
  display: 'inline-flex',
  width: theme.typography.pxToRem(20),
  height: theme.typography.pxToRem(15),
  marginInlineEnd: theme.typography.pxToRem(8),
  verticalAlign: 'middle',
  '& svg': { width: '100%', height: '100%' },
  ...($condensed && {
    marginInlineEnd: 0,
  }),
}));

export const menuPaperSx: SxProps<Theme> = (theme) => ({ maxHeight: theme.typography.pxToRem(400) });

export const menuSearchBoxSx: SxProps<Theme> = (theme) => ({
  padding: theme.spacing(1),
  paddingBottom: theme.spacing(0.5),
});

export const menuListSx: SxProps<Theme> = (theme) => ({
  maxHeight: theme.typography.pxToRem(320),
  overflowY: 'auto',
});
