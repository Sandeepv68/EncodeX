import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const DropZoneRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$dragging',
})<{ $dragging: boolean }>(({ theme, $dragging }) => ({
  border: `${theme.typography.pxToRem(2)} dashed`,
  borderColor: $dragging ? theme.palette.primary.main : theme.palette.divider,
  borderRadius: (theme.shape.borderRadius as number) * 2,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: $dragging ? theme.palette.action.hover : 'transparent',
  transition: 'all 0.2s',
}));

export const UploadIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(48),
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));
