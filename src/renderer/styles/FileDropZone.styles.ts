import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export const DropZoneRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$dragging',
})<{ $dragging: boolean }>(({ theme, $dragging }) => ({
  border: '2px dashed',
  borderColor: $dragging ? theme.palette.primary.main : theme.palette.divider,
  borderRadius: (theme.shape.borderRadius as number) * 2,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: $dragging ? theme.palette.action.hover : 'transparent',
  transition: 'all 0.2s',
}));

export const UploadIcon = styled(CloudUploadIcon)(({ theme }) => ({
  fontSize: 48,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));
