/**
 * @fileoverview Audio stream summary component.
 *
 * Renders a compact, stacked list describing every audio stream of a probed
 * media file. Each row is prefixed with a localized "Audio" label and the
 * stream's zero-based index, followed by a human-readable summary built from
 * the codec, profile, channel count, sample rate, channel layout, bitrate, and
 * language of the stream.
 *
 * This component is used by the Media Info page (and any view that surfaces
 * probed audio streams) to give a quick overview without the full detail grid.
 * It renders nothing when the stream list is empty.
 *
 * Props (see {@link AudioStreamInfoProps}):
 *  - streams: array of probed MediaStreamInfo entries to summarize.
 */

import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';
import type { MediaStreamInfo } from '../../shared/types';
import type { AudioStreamInfoProps } from './types';

/**
 * Builds a single-line summary string for an audio stream.
 *
 * Parts are appended in a fixed order and joined with the '·' separator: the
 * codec (with its profile in parentheses when present), the channel count
 * suffixed with "ch" (only when greater than zero), the sample rate in Hz
 * (only when greater than zero), the channel layout, the bitrate, and the
 * language tag. Each part is omitted when its underlying value is missing or
 * falsy.
 * @param {MediaStreamInfo} stream - The audio stream to summarize.
 * @returns {string} A formatted summary string, possibly empty.
 */
function formatStreamLine(stream: MediaStreamInfo): string {
  const parts: string[] = [];
  parts.push(stream.codec + (stream.profile ? ` (${stream.profile})` : ''));
  if (stream.channels != null && stream.channels > 0) parts.push(`${stream.channels} ch`);
  if (stream.sampleRate != null && stream.sampleRate > 0) parts.push(`${stream.sampleRate} Hz`);
  if (stream.channelLayout) parts.push(stream.channelLayout);
  if (stream.bitrate) parts.push(stream.bitrate);
  if (stream.language) parts.push(stream.language);
  return parts.join(' · ');
}

/**
 * Renders the audio stream summary list.
 *
 * Maps every entry in `streams` to a caption Typography row (see
 * {@link formatStreamLine}). Returns null when no streams are provided, so the
 * surrounding layout does not reserve space for empty audio data.
 * @param {AudioStreamInfoProps} props - Component props.
 * @param {MediaStreamInfo[]} props.streams - The audio streams to display.
 * @returns {JSX.Element | null} The stream summary list, or null when empty.
 */
export default function AudioStreamInfo({ streams }: AudioStreamInfoProps) {
  const { t } = useTranslation();
  if (streams.length === 0) return null;
  return (
    <Stack spacing={0.25} data-testid="audio-stream-info">
      {streams.map((stream, i) => (
        <Typography key={i} variant="caption" color="text.secondary" data-testid="audio-stream-row">
          {t('mediaInfo.audio')} #{stream.index} · {formatStreamLine(stream)}
        </Typography>
      ))}
    </Stack>
  );
}
