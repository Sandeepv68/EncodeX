import { Box, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ImageExifData } from '../../shared/types';
import { FieldLabel, FieldValue } from '../styles/InfoField.styles';
import EllipsisTooltip from './EllipsisTooltip';
import { ExifTitle, HistogramBox, HistogramTitle, HistogramRow, HistogramLabel } from '../styles/ExifSection.styles';

const HISTOGRAM_BINS = 64;
const HISTOGRAM_WIDTH = 160;
const HISTOGRAM_HEIGHT = 48;

function aggregate(data: number[], bins: number): number[] {
  const agg = new Array(bins).fill(0);
  for (let i = 0; i < data.length; i++) {
    const bin = Math.min(bins - 1, Math.floor((i * bins) / data.length));
    agg[bin] += data[i];
  }
  return agg;
}

function HistogramChart({ id, data, color }: { id: string; data: number[]; color: string }) {
  const agg = aggregate(data, HISTOGRAM_BINS);
  const max = Math.max(...agg, 1);
  const barWidth = HISTOGRAM_WIDTH / HISTOGRAM_BINS;
  return (
    <svg width={HISTOGRAM_WIDTH} height={HISTOGRAM_HEIGHT} role="img" data-testid={`histogram-${id}`}>
      {agg.map((value, i) => {
        const h = (value / max) * HISTOGRAM_HEIGHT;
        return <rect key={i} x={i * barWidth} y={HISTOGRAM_HEIGHT - h} width={Math.max(barWidth - 0.5, 0.5)} height={h} fill={color} />;
      })}
    </svg>
  );
}

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
