/**
 * @fileoverview EXIF metadata and image histogram section.
 *
 * Renders the metadata panel of the Media Info page for image files. It shows
 * every EXIF key/value pair from the probed data in a responsive grid, wrapping
 * each value in {@link EllipsisTooltip} so truncated text reveals its full
 * content on hover. When no EXIF entries exist a localized "no EXIF data" note
 * is shown instead.
 *
 * If the image carried histogram data, a separate block renders four tiny SVG
 * bar charts (Red, Green, Blue, Luma). Each 256-bin histogram is downsampled to
 * EXIF_HISTOGRAM_BINS bins and drawn as filled rectangles scaled to the
 * EXIF_HISTOGRAM_WIDTH/HEIGHT canvas.
 *
 * Props: `data` (see {@link ImageExifData}) - the probed EXIF and histogram
 * payload.
 */

import { Box, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ImageExifData } from '../../shared/types';
import { FieldLabel, FieldValue } from '../styles/InfoField.styles';
import EllipsisTooltip from './EllipsisTooltip';
import { ExifTitle, HistogramBox, HistogramTitle, HistogramRow, HistogramLabel } from '../styles/ExifSection.styles';
import { EXIF_HISTOGRAM_BINS, EXIF_HISTOGRAM_WIDTH, EXIF_HISTOGRAM_HEIGHT } from '../../shared/constants';

/**
 * Downsamples an arbitrary-length data series into `bins` buckets by summing
 * the source values that fall into each bucket. Bucket boundaries are computed
 * proportionally so the full series is always represented, and the last bucket
 * is clamped to `bins - 1` to avoid index overflows on rounding.
 * @param {number[]} data - The source histogram counts (length N).
 * @param {number} bins - The target number of output buckets.
 * @returns {number[]} An array of length `bins` with aggregated sums.
 */
function aggregate(data: number[], bins: number): number[] {
  const agg = new Array(bins).fill(0);
  for (let i = 0; i < data.length; i++) {
    const bin = Math.min(bins - 1, Math.floor((i * bins) / data.length));
    agg[bin] += data[i];
  }
  return agg;
}

/**
 * Renders a single histogram channel as an SVG bar chart.
 *
 * Aggregates the channel's histogram into EXIF_HISTOGRAM_BINS buckets and
 * draws one rectangle per bucket. Bar height is proportional to the bucket
 * count relative to the largest bucket (minimum scale of 1 so empty data still
 * draws a baseline). The chart is exported for accessibility with an
 * `img` role and a test id of `histogram-<id>`.
 * @param {Object} props - Component props.
 * @param {string} props.id - Channel identifier used in the test id.
 * @param {number[]} props.data - The channel's source histogram counts.
 * @param {string} props.color - Fill color for the bars.
 * @returns {JSX.Element} The SVG histogram chart.
 */
function HistogramChart({ id, data, color }: { id: string; data: number[]; color: string }) {
  const agg = aggregate(data, EXIF_HISTOGRAM_BINS);
  const max = Math.max(...agg, 1);
  const barWidth = EXIF_HISTOGRAM_WIDTH / EXIF_HISTOGRAM_BINS;
  return (
    <svg width={EXIF_HISTOGRAM_WIDTH} height={EXIF_HISTOGRAM_HEIGHT} role="img" data-testid={`histogram-${id}`}>
      {agg.map((value, i) => {
        const h = (value / max) * EXIF_HISTOGRAM_HEIGHT;
        return (
          <rect key={i} x={i * barWidth} y={EXIF_HISTOGRAM_HEIGHT - h} width={Math.max(barWidth - 0.5, 0.5)} height={h} fill={color} />
        );
      })}
    </svg>
  );
}

/**
 * Renders the EXIF metadata and histogram section for an image.
 *
 * Displays the "EXIF data" heading followed by the metadata grid (or a
 * localized empty note), then the RGB/luma histograms when available.
 * @param {Object} props - Component props.
 * @param {ImageExifData} props.data - Probed EXIF metadata and histogram.
 * @returns {JSX.Element} The section content.
 */
export default function ExifSection({ data }: { data: ImageExifData }) {
  const { t } = useTranslation();
  const entries = Object.entries(data.exif);

  return (
    <Box>
      <ExifTitle variant="h6">{t('mediaInfo.exifData')}</ExifTitle>
      {entries.length > 0 ? (
        <Grid container spacing={1}>
          {entries.map(([key, value]) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={key}>
              <FieldLabel>{key}</FieldLabel>
              <EllipsisTooltip title={value}>
                <FieldValue>{value}</FieldValue>
              </EllipsisTooltip>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('mediaInfo.noExif')}
        </Typography>
      )}
      {data.histogram && (
        <HistogramBox>
          <HistogramTitle variant="subtitle2">Histogram</HistogramTitle>
          <HistogramRow>
            <HistogramLabel variant="caption">Red</HistogramLabel>
            <HistogramChart id="r" data={data.histogram.r} color="#f44336" />
          </HistogramRow>
          <HistogramRow>
            <HistogramLabel variant="caption">Green</HistogramLabel>
            <HistogramChart id="g" data={data.histogram.g} color="#4caf50" />
          </HistogramRow>
          <HistogramRow>
            <HistogramLabel variant="caption">Blue</HistogramLabel>
            <HistogramChart id="b" data={data.histogram.b} color="#2196f3" />
          </HistogramRow>
          <HistogramRow>
            <HistogramLabel variant="caption">Luma</HistogramLabel>
            <HistogramChart id="luma" data={data.histogram.luma} color="#9e9e9e" />
          </HistogramRow>
        </HistogramBox>
      )}
    </Box>
  );
}
