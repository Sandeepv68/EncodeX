import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

/** Container for the update dialog content. @const UpdateDialogContent */
export const UpdateDialogContent = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 380,
}));

/** Version highlight text shown in the update dialog. @const UpdateVersionText */
export const UpdateVersionText = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.main,
}));

/** Release notes text area. @const UpdateReleaseNotes */
export const UpdateReleaseNotes = styled(Box)(({ theme }) => ({
  maxHeight: 180,
  overflowY: 'auto',
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.action.hover : theme.palette.action.disabledBackground,
  whiteSpace: 'pre-wrap',
  fontSize: theme.typography.body2.fontSize,
  lineHeight: theme.typography.body2.lineHeight,
  color: theme.palette.text.secondary,
}));

/** Centered status message shown when checking or when up to date. @const UpdateStatusMessage */
export const UpdateStatusMessage = styled(Typography)(() => ({
  textAlign: 'center',
  padding: 16,
}));
