import { alpha, styled, keyframes } from '@mui/material/styles';
import { Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SHADOWS } from '../colors';

const borderPulse = keyframes`
  0%, 100% {
    border-color: var(--dropzone-border-base);
  }
  25% {
    border-color: var(--dropzone-border-a);
  }
  50% {
    border-color: var(--dropzone-border-b);
  }
  75% {
    border-color: var(--dropzone-border-c);
  }
`;

const backgroundPulse = keyframes`
  0%, 100% {
    background-color: var(--dropzone-bg-base);
  }
  25% {
    background-color: var(--dropzone-bg-a);
  }
  50% {
    background-color: var(--dropzone-bg-b);
  }
  75% {
    background-color: var(--dropzone-bg-c);
  }
`;

export const DropZoneRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$dragging',
})<{ $dragging: boolean }>(({ theme, $dragging }) => ({
  border: `${theme.typography.pxToRem(2)} dashed`,
  borderColor: $dragging ? theme.palette.primary.main : theme.palette.divider,
  '--dropzone-border-base': theme.palette.divider,
  '--dropzone-border-a': theme.palette.primary.main,
  '--dropzone-border-b': theme.palette.secondary.main,
  '--dropzone-border-c': theme.palette.info.main,
  '--dropzone-bg-base': alpha(theme.palette.primary.main, 0.06),
  '--dropzone-bg-a': alpha(theme.palette.primary.main, 0.12),
  '--dropzone-bg-b': alpha(theme.palette.secondary.main, 0.12),
  '--dropzone-bg-c': alpha(theme.palette.info.main, 0.12),
  borderRadius: (theme.shape.borderRadius as number) * 2,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: $dragging ? theme.palette.action.hover : alpha(theme.palette.primary.main, 0.06),
  transition: 'all 0.2s',
  animation: $dragging ? 'none' : `${borderPulse} 8s ease-in-out infinite`,
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT,
    transform: 'translateY(-2px)',
    ...(!$dragging
      ? { animation: `${borderPulse} 8s ease-in-out infinite, ${backgroundPulse} 8s ease-in-out infinite` }
      : {}),
  },
  '& svg': {
    transition: 'color 0.2s ease',
  },
  '&:hover svg': {
    color: theme.palette.primary.main,
  },
  ...($dragging
    ? {
        '& svg': {
          color: theme.palette.primary.main,
        },
      }
    : {}),
  '& .MuiTypography-root': {
    fontSize: theme.typography.pxToRem(12),
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.secondary,
  },
  '& .MuiTypography-caption': {
    fontSize: theme.typography.pxToRem(11),
    fontWeight: theme.typography.fontWeightRegular,
    color: theme.palette.text.disabled,
    marginTop: theme.spacing(0.5),
  },
}));

export const UploadIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(48),
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));
