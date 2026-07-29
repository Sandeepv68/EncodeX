import { useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface Props {
  onFileSelect: (path: string) => void;
  label?: string;
  accept?: string;
}

export default function FileDropZone({ onFileSelect, label = 'Drop file here or click to browse', accept }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect((file as any).path);
  }, [onFileSelect]);

  const handleClick = async () => {
    const extList = accept ? [{ name: 'Files', extensions: accept.split(',').map(s => s.trim()) }] : undefined;
    const file = await window.electronAPI?.selectFile(extList);
    if (file) onFileSelect(file);
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={handleClick}
      sx={{
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        bgcolor: dragging ? 'action.hover' : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}
