import { Grid, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaInfo } from '../../shared/types';
import { formatSize, formatDuration } from '../utils/formatters';
import { SummaryGrid, TagsBox, TagsTitle, TagItem, TagKey, TagValue } from '../styles/FileSummary.styles';

export interface FileSummaryProps {
  info: MediaInfo;
}

export default function FileSummary({ info }: FileSummaryProps) {
  const { t } = useTranslation();

  const rows: [string, string][] = [
    [t('mediaInfo.file'), info.file],
    [t('mediaInfo.format'), info.formatLong ? `${info.format} (${info.formatLong})` : info.format],
    [t('mediaInfo.size'), formatSize(info.size)],
    [t('mediaInfo.duration'), formatDuration(info.duration)],
    [t('mediaInfo.bitrate'), info.bitrate],
    ...(info.startTime != null ? [[t('mediaInfo.startTime'), String(info.startTime)] as [string, string]] : []),
    ...(info.probeScore != null ? [[t('mediaInfo.probeScore'), String(info.probeScore)] as [string, string]] : []),
    [t('mediaInfo.streamsCount'), String(info.streams.length)],
  ];

  const tags = info.tags ? Object.entries(info.tags) : [];

  return (
    <>
      <SummaryGrid container spacing={1}>
        {rows.map(([label, value]) => (
          <Grid size={{ xs: 12, sm: 6 }} key={label}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            {value ? (
              <Tooltip title={value} placement="top" arrow>
                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                  {value}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="body2">{value}</Typography>
            )}
          </Grid>
        ))}
      </SummaryGrid>
      {tags.length > 0 && (
        <TagsBox>
          <TagsTitle variant="caption" color="text.secondary">
            {t('mediaInfo.tags')}
          </TagsTitle>
          <Grid container spacing={1}>
            {tags.map(([key, value]) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                <TagItem>
                  <TagKey variant="caption" color="text.secondary">
                    {key}
                  </TagKey>
                  <Tooltip title={value} placement="top" arrow>
                    <TagValue variant="body2" noWrap>
                      {value}
                    </TagValue>
                  </Tooltip>
                </TagItem>
              </Grid>
            ))}
          </Grid>
        </TagsBox>
      )}
    </>
  );
}
