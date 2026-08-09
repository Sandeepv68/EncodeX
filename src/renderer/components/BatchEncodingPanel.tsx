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

import { MenuItem, TextField } from '@mui/material';
import { faPalette, faBrush, faDroplet, faSun } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useTranslation } from 'react-i18next';
import { BITRATE_OPTIONS, IMAGE_FORMATS, PIXEL_FORMATS, SCALE_OPTIONS, VIDEO_BITRATE_OPTIONS } from '../../shared/media-options';
import { QSCALE_RANGE } from '../../shared/transcoder-constants';
import { getAudioCodecContainers, getVideoCodecContainer } from '../../shared/codec-containers';
import CodecSelect from './CodecSelect';
import GroupedSelect from './GroupedSelect';
import type { BatchEncodingPanelProps } from './types';
import { EncodingPaper, EncodingStack, EncodingTitle, FieldBox, FieldLabel } from '../styles/BatchEncodingPanel.styles';

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
 * Builds a wrapping row of MUI controls inside a paper surface, with the set of
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

  const showVideo = props.operation === 'transcode';
  const showAudio = props.operation === 'transcode' || props.operation === 'extract_audio';
  const showImage = props.operation === 'compress_image';

  const containerOptions = showVideo ? getVideoCodecContainer(props.videoCodec).containers : getAudioCodecContainers(props.audioCodec);

  return (
    <EncodingPaper>
      <EncodingTitle variant="subtitle2" color="text.secondary">
        {t('batchQueue.encodingOptions')}
      </EncodingTitle>
      <EncodingStack direction="row" spacing={1} useFlexGap>
        {showVideo && (
          <FieldBox sx={{ width: 200 }}>
            <FieldLabel>{t('convert.videoCodec')}</FieldLabel>
            <CodecSelect type="video" value={props.videoCodec} onChange={props.onVideoCodecChange} />
          </FieldBox>
        )}
        {showAudio && (
          <FieldBox sx={{ width: 200 }}>
            <FieldLabel>{t('convert.audioCodec')}</FieldLabel>
            <CodecSelect type="audio" value={props.audioCodec} onChange={props.onAudioCodecChange} />
          </FieldBox>
        )}
        {showAudio && (
          <FieldBox sx={{ width: 160 }}>
            <FieldLabel>{t('batchQueue.container')}</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
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
        )}
        {showImage && (
          <FieldBox sx={{ width: 160 }}>
            <FieldLabel>{t('imageCompress.outputFormat')}</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
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
        )}
        {showVideo && (
          <FieldBox sx={{ width: 130 }}>
            <FieldLabel>{t('convert.videoBitrate')}</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
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
        )}
        {showAudio && (
          <FieldBox sx={{ width: 130 }}>
            <FieldLabel>{t('convert.audioBitrate')}</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
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
        )}
        {showImage && (
          <FieldBox sx={{ width: 100 }}>
            <FieldLabel>{t('imageCompress.quality')}</FieldLabel>
            <TextField
              fullWidth
              size="small"
              type="number"
              value={props.quality}
              onChange={(e) => {
                props.onQualityChange(e.target.value);
              }}
              slotProps={{ htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX } }}
            />
          </FieldBox>
        )}
        {(showVideo || showImage) && (
          <FieldBox sx={{ width: 130 }}>
            <FieldLabel>{showVideo ? t('convert.scale') : t('imageCompress.scale')}</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
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
        )}
        {showVideo && (
          <FieldBox sx={{ width: 180 }}>
            <FieldLabel>{t('convert.pixelFormat')}</FieldLabel>
            <GroupedSelect
              value={props.pixelFormat}
              onChange={props.onPixelFormatChange}
              options={pixelFormatOptions}
              groupIcons={pixelGroupIcons}
            />
          </FieldBox>
        )}
      </EncodingStack>
    </EncodingPaper>
  );
}
