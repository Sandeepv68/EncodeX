import { Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaInfo } from '../../shared/types';
import { formatSize, formatDuration } from '../utils/formatters';
import { SummaryGrid } from '../styles/FileSummary.styles';

export interface FileSummaryProps {
  info: MediaInfo;
}

export default function FileSummary({ info }: FileSummaryProps) {
  const { t } = useTranslation();

  const rows: [string, string][] = [
    [t('mediaInfo.file'), info.file],
    [t('mediaInfo.format'), info.format],
    [t('mediaInfo.size'), formatSize(info.size)],
    [t('mediaInfo.duration'), formatDuration(info.duration)],
    [t('mediaInfo.bitrate'), info.bitrate],
  ];

  return (
    <SummaryGrid container spacing={1}>
      {rows.map(([label, value]) => (
        <Grid size={{ xs: 12, sm: 6 }} key={label}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2">{value}</Typography>
        </Grid>
      ))}
    </SummaryGrid>
  );
}
