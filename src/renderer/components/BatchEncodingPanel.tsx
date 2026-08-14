/**
 * @fileoverview Batch encoding options panel for the batch queue page.
 *
 * Renders the per-operation encoding configuration for queued jobs. The visible
 * controls depend on the selected batch operation:
 *
 *  - `transcode`: video codec, audio codec, container, video bitrate, audio
 *    bitrate, scale, and pixel format.
 *  - `extract_audio`: audio codec, container (audio containers), and audio
 *    bitrate.
 *  - `compress_image`: output format, quality, and scale.
 *
 * Every control is controlled through props (values plus `on*Change`
 * callbacks) so the parent page owns the state. The container/format select
 * offers an "Auto (source)" entry (`''`) plus the options matching the
 *  operation — video containers via
 * `getVideoCodecContainer(videoCodec).containers`, audio containers via
 * `getAudioCodecContainers(audioCodec)` (filtered to the selected codec), and
 * image formats via the shared `IMAGE_FORMATS` list. Codec and pixel-format
 * pickers reuse the shared {@link CodecSelect} / {@link GroupedSelect}
 * components.
 */

import { Grid, MenuItem, TextField, InputAdornment } from '@mui/material';
import { faPalette, faBrush, faDroplet, faSun } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useTranslation } from 'react-i18next';
import { BITRATE_OPTIONS, IMAGE_FORMATS, PIXEL_FORMATS, SCALE_OPTIONS, VIDEO_BITRATE_OPTIONS } from '../../shared/media-options';
import { QSCALE_RANGE } from '../../shared/transcoder-constants';
import { getAudioCodecContainers, getVideoCodecContainer } from '../../shared/codec-containers';
import CodecSelect from './CodecSelect';
import GroupedSelect from './GroupedSelect';
import { useFieldId } from '../hooks/useFieldId';
import { useDismissedAlertsStore, DISMISSED_ALERT_KEYS } from '../stores/dismissedAlertsStore';
import type { BatchEncodingPanelProps } from './types';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import { EncodingPaper, EncodingTitle } from '../styles/BatchEncodingPanel.styles';
import { AccelAlert, LockedAlert } from '../styles/BatchQueue.styles';

/**
 * Pixel-format options prepared for the GroupedSelect: every entry of
 * PIXEL_FORMATS is spread and given a `label` equal to its `value` so the
 * select can render the format string.
 * @const {Array<{value: string; group: string; label: string}>} pixelFormatOptions
 */
const pixelFormatOptions = PIXEL_FORMATS.map((f) => ({ ...f, label: f.value }));

/**
 * Maps pixel-format group names to FontAwesome icons used by the GroupedSelect
 * pixel-format picker, giving each group a distinct visual cue.
 * @const {Record<string, IconDefinition>} pixelGroupIcons
 */
const pixelGroupIcons: Record<string, IconDefinition> = {
  'YUV 8-bit': faPalette,
  'YUV 10-bit': faPalette,
  'YUV 12-bit': faPalette,
  'YUV 16-bit': faPalette,
  'YUV Semi-planar': faPalette,
  'YUV with Alpha': faPalette,
  'RGB Packed': faBrush,
  'Planar RGB': faBrush,
  Monochrome: faDroplet,
  HDR: faSun,
};

/**
 * Renders the batch encoding options panel.
 *
 * Builds a responsive grid of MUI controls inside a paper surface (each field
 * an equal-width cell that stacks on small screens), with the set of
 * controls depending on the operation (see the file header). All values are
 * controlled via props.
 * @param {BatchEncodingPanelProps} props - Component props.
 * @param {string} props.operation - Selected batch operation value.
 * @param {string} props.videoCodec - Selected video encoder name.
 * @param {string} props.audioCodec - Selected audio encoder name.
 * @param {string} props.container - Selected output container/format extension
 *   ('' = keep source extension).
 * @param {string} props.videoBitrate - Target video bitrate ('' = auto).
 * @param {string} props.audioBitrate - Target audio bitrate ('' = auto).
 * @param {string} props.quality - Image compression quality 1-31 ('' = auto).
 * @param {string} props.scale - Output resolution ('' = original).
 * @param {string} props.pixelFormat - Output pixel format.
 * @param {(value: string) => void} props.onVideoCodecChange - Video codec change callback.
 * @param {(value: string) => void} props.onAudioCodecChange - Audio codec change callback.
 * @param {(value: string) => void} props.onContainerChange - Container change callback.
 * @param {(value: string) => void} props.onVideoBitrateChange - Video bitrate change callback.
 * @param {(value: string) => void} props.onAudioBitrateChange - Audio bitrate change callback.
 * @param {(value: string) => void} props.onQualityChange - Quality change callback.
 * @param {(value: string) => void} props.onScaleChange - Scale change callback.
 * @param {(value: string) => void} props.onPixelFormatChange - Pixel format change callback.
 * @returns {JSX.Element} The options panel.
 */
export default function BatchEncodingPanel(props: BatchEncodingPanelProps) {
  const { t } = useTranslation();

  const lockedAlertDismissed = useDismissedAlertsStore((s) => s.isDismissed(DISMISSED_ALERT_KEYS.OPTIONS_LOCKED));
  const editableAlertDismissed = useDismissedAlertsStore((s) => s.isDismissed(DISMISSED_ALERT_KEYS.OPTIONS_EDITABLE));

  const showVideo = props.operation === 'transcode';
  const showAudio = props.operation === 'transcode' || props.operation === 'extract_audio';
  const showImage = props.operation === 'compress_image';

  const containerOptions = showVideo ? getVideoCodecContainer(props.videoCodec).containers : getAudioCodecContainers(props.audioCodec);

  const qualityId = useFieldId();

  return (
    <EncodingPaper>
      <EncodingTitle variant="subtitle2" color="text.secondary">
        {t('batchQueue.encodingOptions')}
      </EncodingTitle>
      {props.optionsLocked && !lockedAlertDismissed && (
        <LockedAlert
          severity="warning"
          sx={{ marginBottom: 2 }}
          onClose={() => useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.OPTIONS_LOCKED)}
        >
          {t('batchQueue.optionsLockedAlert')}
        </LockedAlert>
      )}
      {!props.optionsLocked && props.optionsEditable && !editableAlertDismissed && (
        <AccelAlert
          severity="info"
          sx={{ marginBottom: 2 }}
          onClose={() => useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.OPTIONS_EDITABLE)}
        >
          {t('batchQueue.optionsEditableAlert')}
        </AccelAlert>
      )}
      <Grid container spacing={2}>
        {showVideo && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('convert.videoCodec')}</FieldLabel>
              <CodecSelect ariaLabel={t('convert.videoCodec')} type="video" value={props.videoCodec} onChange={props.onVideoCodecChange} />
            </FieldBox>
          </Grid>
        )}
        {showAudio && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('convert.audioCodec')}</FieldLabel>
              <CodecSelect ariaLabel={t('convert.audioCodec')} type="audio" value={props.audioCodec} onChange={props.onAudioCodecChange} />
            </FieldBox>
          </Grid>
        )}
        {showAudio && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('batchQueue.container')}</FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                slotProps={{ htmlInput: { 'aria-label': t('batchQueue.container') } }}
                value={props.container}
                onChange={(e) => {
                  props.onContainerChange(e.target.value);
                }}
              >
                <MenuItem value="">{t('batchQueue.containerAuto')}</MenuItem>
                {containerOptions.map((container) => (
                  <MenuItem key={container} value={container}>
                    {container}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Grid>
        )}
        {showImage && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('imageCompress.outputFormat')}</FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                slotProps={{ htmlInput: { 'aria-label': t('imageCompress.outputFormat') } }}
                value={props.container}
                onChange={(e) => {
                  props.onContainerChange(e.target.value);
                }}
              >
                <MenuItem value="">{t('batchQueue.containerAuto')}</MenuItem>
                {IMAGE_FORMATS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Grid>
        )}
        {showVideo && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('convert.videoBitrate')}</FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                slotProps={{ htmlInput: { 'aria-label': t('convert.videoBitrate') } }}
                value={props.videoBitrate}
                onChange={(e) => {
                  props.onVideoBitrateChange(e.target.value);
                }}
              >
                {VIDEO_BITRATE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b || 'Auto'}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Grid>
        )}
        {showAudio && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('convert.audioBitrate')}</FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                slotProps={{ htmlInput: { 'aria-label': t('convert.audioBitrate') } }}
                value={props.audioBitrate}
                onChange={(e) => {
                  props.onAudioBitrateChange(e.target.value);
                }}
              >
                <MenuItem value="">{t('status.auto')}</MenuItem>
                {BITRATE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Grid>
        )}
        {showImage && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel htmlFor={qualityId}>{t('imageCompress.quality')}</FieldLabel>
              <TextField
                fullWidth
                size="small"
                type="number"
                id={qualityId}
                value={props.quality}
                onChange={(e) => {
                  props.onQualityChange(e.target.value);
                }}
                helperText={t('imageCompress.qualityRangeCaption')}
                slotProps={{
                  htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX },
                  input: {
                    endAdornment: <InputAdornment position="end">/ {QSCALE_RANGE.MAX}</InputAdornment>,
                  },
                }}
              />
            </FieldBox>
          </Grid>
        )}
        {(showVideo || showImage) && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{showVideo ? t('convert.scale') : t('imageCompress.scale')}</FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                slotProps={{ htmlInput: { 'aria-label': showVideo ? t('convert.scale') : t('imageCompress.scale') } }}
                value={props.scale}
                onChange={(e) => {
                  props.onScaleChange(e.target.value);
                }}
              >
                {SCALE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s || t('status.none')}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Grid>
        )}
        {showVideo && (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <FieldBox>
              <FieldLabel>{t('convert.pixelFormat')}</FieldLabel>
              <GroupedSelect
                ariaLabel={t('convert.pixelFormat')}
                value={props.pixelFormat}
                onChange={props.onPixelFormatChange}
                options={pixelFormatOptions}
                groupIcons={pixelGroupIcons}
              />
            </FieldBox>
          </Grid>
        )}
      </Grid>
    </EncodingPaper>
  );
}
