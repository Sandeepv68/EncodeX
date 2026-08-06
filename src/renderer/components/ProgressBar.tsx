/**
 * @fileoverview Conversion progress indicator.
 *
 * Renders a determinate MUI progress track alongside a caption row showing the
 * numeric percentage and, when provided, the elapsed time, speed, and estimated
 * time remaining for an ongoing conversion.
 *
 * The `percent` value is clamped to [0, 100] before being rendered, and a
 * paused state visibly styles the track so an idle/paused job is distinct from
 * an active one. ETA is only shown when it is a non-zero string.
 *
 * Props (see {@link ProgressBarProps}):
 *  - percent: completion percentage, clamped to [0, 100].
 *  - time: optional elapsed time string.
 *  - speed: optional processing speed string.
 *  - eta: optional remaining-time string (suppressed when '0').
 *  - paused: when true, styles the track as paused.
 */

import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import type { ProgressBarProps } from './types';
import { ProgressTrack, ProgressInfoRow } from '../styles/ProgressBar.styles';

/**
 * Renders the progress bar with info captions.
 *
 * Clamps `percent` to the valid 0–100 range and renders it into a determinate
 * ProgressTrack, passing the `paused` flag through for styling. Below the track,
 * a ProgressInfoRow shows the clamped percentage to one decimal place followed
 * by localized captions for elapsed time, speed, and ETA whenever the
 * corresponding props are present (ETA is hidden when it equals '0').
 *
 * @param {ProgressBarProps} props - Component props.
 * @param {number} props.percent - Completion percentage (clamped to [0, 100]).
 * @param {string} [props.time] - Optional elapsed time string.
 * @param {string} [props.speed] - Optional processing speed string.
 * @param {string} [props.eta] - Optional remaining-time string; suppressed when
 *   it is '0'.
 * @param {boolean} [props.paused] - When true, the track is styled as paused.
 * @returns {JSX.Element} The progress track and info row.
 */
export default function ProgressBar({ percent, time, speed, eta, paused = false }: ProgressBarProps) {
  const { t } = useTranslation();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <Box>
      <ProgressTrack variant="determinate" value={clamped} paused={paused} />
      <ProgressInfoRow>
        <Typography variant="caption" color="text.secondary">
          {clamped.toFixed(1)}%
        </Typography>
        {time && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.time')}: {time}
          </Typography>
        )}
        {speed && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.speed')}: {speed}
          </Typography>
        )}
        {eta && eta !== '0' && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.eta')}: {eta}s
          </Typography>
        )}
      </ProgressInfoRow>
    </Box>
  );
}
