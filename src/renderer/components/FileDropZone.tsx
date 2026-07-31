import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { Logger } from '../../shared/logger';
import { DropZoneRoot, UploadIcon } from '../styles/FileDropZone.styles';

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
    <DropZoneRoot
      $dragging={dragging}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onClick={handleClick}
    >
      <UploadIcon />
      <Typography color="text.secondary">{resolvedLabel}</Typography>
    </DropZoneRoot>
  );
}
