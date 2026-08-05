import { Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaInfo } from '../../shared/types';
import type { FileSummaryProps, SummaryRow } from './types';
import { formatSize, formatDuration } from '../utils/formatters';
import { SummaryGrid, TagsBox, TagsTitle, TagItem } from '../styles/FileSummary.styles';
import { FieldLabel, FieldValue } from '../styles/InfoField.styles';
import EllipsisTooltip from './EllipsisTooltip';

export default function FileSummary({ info, compact }: FileSummaryProps) {
  const { t } = useTranslation();

  const short: SummaryRow['size'] = compact ? { xs: 12, sm: 6 } : { xs: 12, sm: 6, md: 4 };
  const wide: SummaryRow['size'] = compact ? { xs: 12 } : { xs: 12, md: 6 };
  const tagSize: SummaryRow['size'] = compact ? { xs: 12, sm: 6 } : { xs: 12, sm: 6, md: 4, lg: 3 };

  const rows: SummaryRow[] = [
    { label: t('mediaInfo.file'), value: info.file, size: { xs: 12 } },
    { label: t('mediaInfo.format'), value: info.formatLong ? `${info.format} (${info.formatLong})` : info.format, size: wide },
    { label: t('mediaInfo.size'), value: formatSize(info.size), size: short },
    { label: t('mediaInfo.duration'), value: formatDuration(info.duration), size: short },
    { label: t('mediaInfo.bitrate'), value: info.bitrate, size: short },
    ...(info.startTime != null ? [{ label: t('mediaInfo.startTime'), value: String(info.startTime), size: short }] : []),
    ...(info.probeScore != null ? [{ label: t('mediaInfo.probeScore'), value: String(info.probeScore), size: short }] : []),
    { label: t('mediaInfo.streamsCount'), value: String(info.streams.length), size: short },
  ];

  const tags = info.tags ? Object.entries(info.tags) : [];

  return (
    <>
      <SummaryGrid container spacing={1}>
        {rows.map(({ label, value, size }) => (
          <Grid size={size} key={label}>
            <FieldLabel>{label}</FieldLabel>
            {value ? (
              <EllipsisTooltip title={value}>
                <FieldValue>{value}</FieldValue>
              </EllipsisTooltip>
            ) : (
              <FieldValue>{value}</FieldValue>
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
              <Grid size={tagSize} key={key}>
                <TagItem>
                  <FieldLabel>{t(`mediaInfo.tagKeys.${key}`, { defaultValue: key })}</FieldLabel>
                  <EllipsisTooltip title={value}>
                    <FieldValue>{value}</FieldValue>
                  </EllipsisTooltip>
                </TagItem>
              </Grid>
            ))}
          </Grid>
        </TagsBox>
      )}
    </>
  );
}
