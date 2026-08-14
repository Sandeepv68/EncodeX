/**
 * @fileoverview Detailed media stream information panel.
 *
 * Renders a title with a stream count chip and one outlined card per probed
 * stream. Each card shows the stream type and index, a responsive grid of
 * label/value rows for every available codec, resolution, color, frame-rate,
 * audio, timing, and metadata property, and a disposition chip row when the
 * stream declares disposition flags.
 *
 * Values are localized through i18n keys and truncated with an
 * {@link EllipsisTooltip} when they overflow. A compact prop reduces the grid
 * to two columns per row instead of four.
 *
 * Props (see {@link StreamDetailsProps}):
 *  - streams: the probed MediaStreamInfo entries to display.
 *  - compact: when true, uses a two-column grid layout.
 */

import { Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaStreamInfo } from '../../shared/types';
import type { StreamDetailsProps } from './types';
import { formatDuration } from '../utils/formatters';
import { FieldLabel, FieldValue } from '../styles/InfoField.styles';
import EllipsisTooltip from './EllipsisTooltip';
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

/**
 * Builds the label/value rows for a stream. Each row is pushed only when the
 * corresponding property is present (and, for numeric properties, greater
 * than zero where relevant). Stream tags are appended with localized tag
 * keys, skipping the language and title tags already surfaced as rows.
 * @param {MediaStreamInfo} stream - The stream to build rows for.
 * @param {(key: string, opts?: Record<string, unknown>) => string} t - The
 *   i18n translate function.
 * @returns {Array<[string, string]>} Pairs of localized label and value.
 */
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

/**
 * Renders the stream details panel.
 *
 * Maps each stream to a StreamPaper card containing the type chip, name, the
 * row grid built by {@link buildStreamRows}, and the disposition flags. Each
 * value is rendered through an {@link EllipsisTooltip} to keep overflowing
 * text readable.
 * @param {StreamDetailsProps} props - Component props.
 * @param {MediaStreamInfo[]} props.streams - The streams to display.
 * @param {boolean} [props.compact] - When true, lays out rows in a two-column
 *   grid.
 * @returns {JSX.Element} The stream cards.
 */
export default function StreamDetails({ streams, compact }: StreamDetailsProps) {
  const { t } = useTranslation();

  /**
   * Responsive grid column spans per row: two columns per row in compact mode,
   * four columns otherwise.
   * @type {{ xs: number; sm: number; md?: number; lg?: number }}
   */
  const rowSize = compact ? { xs: 12, sm: 6 } : { xs: 12, sm: 6, md: 4, lg: 3 };

  return (
    <>
      <StreamTitle variant="h6" component="h2">
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
                <EllipsisTooltip title={value}>
                  <FieldValue>{value}</FieldValue>
                </EllipsisTooltip>
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
