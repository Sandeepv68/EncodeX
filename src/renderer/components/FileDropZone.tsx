import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Logger } from '../../shared/logger';

const log = new Logger('renderer/components/FileDropZone');

interface Props {
  onFileSelect: (path: string) => void;
  label?: string;
  accept?: string;
}

export default function FileDropZone({ onFileSelect, label, accept }: Props) {
  const { t } = useTranslation();
  const resolvedLabel = label || t('fileDropZone.defaultLabel');
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const path = (file as any).path;
        log.info('File dropped:', path);
        onFileSelect(path);
      }
    },
    [onFileSelect],
  );

  const handleClick = async () => {
    const extList = accept ? [{ name: 'Files', extensions: accept.split(',').map((s) => s.trim()) }] : undefined;
    log.debug('Opening file dialog, accept:', accept);
    const file = await window.electronAPI?.selectFile(extList);
    if (file) {
      log.info('File selected:', file);
      onFileSelect(file);
    }
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
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
      <Typography color="text.secondary">{resolvedLabel}</Typography>
    </Box>
  );
}
