import { Grid, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaStreamInfo } from '../../shared/types';
import { formatDuration } from '../utils/formatters';
import { FieldLabel, FieldValue } from '../styles/InfoField.styles';
import {
  StreamTitle,
  StreamPaper,
  StreamHeaderRow,
  StreamName,
  StreamTypeChip,
  StreamCountChip,
  DispositionChip,
  DispositionLabel,
  DispositionRow,
} from '../styles/StreamDetails.styles';

export interface StreamDetailsProps {
  streams: MediaStreamInfo[];
  compact?: boolean;
}

function buildStreamRows(stream: MediaStreamInfo, t: (key: string, opts?: Record<string, unknown>) => string): [string, string][] {
  const rows: [string, string][] = [];
  if (stream.codec) rows.push([t('mediaInfo.codec'), stream.codec + (stream.codecLong ? ` (${stream.codecLong})` : '')]);
  if (stream.codecTag) rows.push([t('mediaInfo.codecTag'), stream.codecTag]);
  if (stream.profile) rows.push([t('mediaInfo.profile'), stream.profile]);
  if (stream.level != null) rows.push([t('mediaInfo.level'), String(stream.level)]);
  if (stream.width && stream.height) rows.push([t('mediaInfo.resolution'), `${stream.width}x${stream.height}`]);
  if (stream.displayAspectRatio) rows.push([t('mediaInfo.aspectRatio'), stream.displayAspectRatio]);
  if (stream.pixelFormat) rows.push([t('mediaInfo.pixelFormat'), stream.pixelFormat]);
  if (stream.colorSpace) rows.push([t('mediaInfo.colorSpace'), stream.colorSpace]);
  if (stream.colorTransfer) rows.push([t('mediaInfo.colorTransfer'), stream.colorTransfer]);
  if (stream.colorPrimaries) rows.push([t('mediaInfo.colorPrimaries'), stream.colorPrimaries]);
  if (stream.colorRange) rows.push([t('mediaInfo.colorRange'), stream.colorRange]);
  if (stream.fieldOrder) rows.push([t('mediaInfo.fieldOrder'), stream.fieldOrder]);
  if (stream.bitDepth != null && stream.bitDepth > 0) rows.push([t('mediaInfo.bitDepth'), String(stream.bitDepth)]);
  if (stream.frameRate) rows.push([t('mediaInfo.frameRate'), `${stream.frameRate} fps`]);
  if (stream.avgFrameRate) rows.push([t('mediaInfo.avgFrameRate'), `${stream.avgFrameRate} fps`]);
  if (stream.bitrate) rows.push([t('mediaInfo.bitrate'), stream.bitrate]);
  if (stream.sampleRate != null && stream.sampleRate > 0) rows.push([t('mediaInfo.sampleRate'), `${stream.sampleRate} Hz`]);
  if (stream.sampleFormat) rows.push([t('mediaInfo.sampleFormat'), stream.sampleFormat]);
  if (stream.channels != null && stream.channels > 0) rows.push([t('mediaInfo.channels'), String(stream.channels)]);
  if (stream.channelLayout) rows.push([t('mediaInfo.channelLayout'), stream.channelLayout]);
  if (stream.bitsPerSample != null && stream.bitsPerSample > 0) rows.push([t('mediaInfo.bitsPerSample'), String(stream.bitsPerSample)]);
  if (stream.duration != null) rows.push([t('mediaInfo.duration'), formatDuration(stream.duration)]);
  if (stream.startTime != null) rows.push([t('mediaInfo.startTime'), String(stream.startTime)]);
  if (stream.frameCount != null && stream.frameCount > 0) rows.push([t('mediaInfo.frameCount'), String(stream.frameCount)]);
  if (stream.language) rows.push([t('mediaInfo.language'), stream.language]);
  if (stream.title) rows.push([t('mediaInfo.streamTitle'), stream.title]);
  for (const [key, value] of Object.entries(stream.tags ?? {})) {
    if (key === 'language' || key === 'title') continue;
    rows.push([t(`mediaInfo.tagKeys.${key}`, { defaultValue: key }), value]);
  }
  return rows;
}

export default function StreamDetails({ streams, compact }: StreamDetailsProps) {
  const { t } = useTranslation();

  const rowSize = compact ? { xs: 12, sm: 6 } : { xs: 12, sm: 6, md: 4, lg: 3 };

  return (
    <>
      <StreamTitle variant="h6">
        {t('mediaInfo.streams')}
        <StreamCountChip label={streams.length} size="small" data-testid="stream-count-chip" />
      </StreamTitle>
      {streams.map((stream, i) => (
        <StreamPaper key={i} variant="outlined">
          <StreamHeaderRow>
            <StreamTypeChip
              label={t(`mediaInfo.${stream.type}`).toUpperCase()}
              size="small"
              tone={stream.type === 'video' ? 'video' : 'audio'}
            />
            <StreamName variant="body2">
              {t('mediaInfo.stream')} #{stream.index}
            </StreamName>
          </StreamHeaderRow>
          <Grid container spacing={0.5}>
            {buildStreamRows(stream, t).map(([label, value]) => (
              <Grid size={rowSize} key={label}>
                <FieldLabel>{label}</FieldLabel>
                <Tooltip title={value} placement="top" arrow>
                  <FieldValue>{value}</FieldValue>
                </Tooltip>
              </Grid>
            ))}
          </Grid>
          {stream.disposition && stream.disposition.length > 0 && (
            <>
              <DispositionLabel variant="caption" color="text.secondary">
                {t('mediaInfo.disposition')}
              </DispositionLabel>
              <DispositionRow>
                {stream.disposition.map((flag) => (
                  <DispositionChip key={flag} label={t(`mediaInfo.dispositionFlags.${flag}`, { defaultValue: flag })} size="small" />
                ))}
              </DispositionRow>
            </>
          )}
        </StreamPaper>
      ))}
    </>
  );
}
