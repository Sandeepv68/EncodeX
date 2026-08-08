/**
 * @fileoverview Batch encoding options panel for the batch queue page.
 *
 * Renders the per-operation encoding configuration for queued jobs: video/audio
 * codec pickers, an output container select, bitrate selects, a scale select,
 * and a pixel-format picker. The visible controls depend on the selected batch
 * operation:
 *
 *  - `transcode`: video codec, audio codec, container, video bitrate, audio
 *    bitrate, scale, and pixel format.
 *  - `extract_audio`: audio codec, container (audio containers), and audio
 *    bitrate.
 *  - `compress_image`: nothing (the panel renders `null`).
 *
 * Every control is controlled through props (values plus `on*Change`
 * callbacks) so the parent page owns the state. The container select offers an
 * "Auto (source)" entry (`''`) plus every container compatible with the
 * currently selected codec — video containers via
 * `getVideoCodecContainer(videoCodec).containers`, audio containers via the
 * static `AUDIO_CONTAINER_EXTENSIONS` list. Codec and pixel-format pickers
 * reuse the shared {@link CodecSelect} / {@link GroupedSelect} components.
 */

import { MenuItem, TextField } from '@mui/material';
import { faPalette, faBrush, faDroplet, faSun } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useTranslation } from 'react-i18next';
import { BITRATE_OPTIONS, PIXEL_FORMATS, SCALE_OPTIONS, VIDEO_BITRATE_OPTIONS } from '../../shared/media-options';
import { AUDIO_CONTAINER_EXTENSIONS, getVideoCodecContainer } from '../../shared/codec-containers';
import CodecSelect from './CodecSelect';
import GroupedSelect from './GroupedSelect';
import type { BatchEncodingPanelProps } from './types';
import { EncodingPaper, EncodingStack, EncodingTitle } from '../styles/BatchEncodingPanel.styles';

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
 * Returns `null` for `compress_image`. Otherwise builds a wrapping row of MUI
 * controls inside a paper surface, with the set of controls depending on the
 * operation (see the file header). All values are controlled via props.
 * @param {BatchEncodingPanelProps} props - Component props.
 * @param {string} props.operation - Selected batch operation value.
 * @param {string} props.videoCodec - Selected video encoder name.
 * @param {string} props.audioCodec - Selected audio encoder name.
 * @param {string} props.container - Selected output container extension ('' =
 *   keep source extension).
 * @param {string} props.videoBitrate - Target video bitrate ('' = auto).
 * @param {string} props.audioBitrate - Target audio bitrate ('' = auto).
 * @param {string} props.scale - Output resolution ('' = original).
 * @param {string} props.pixelFormat - Output pixel format.
 * @param {(value: string) => void} props.onVideoCodecChange - Video codec change callback.
 * @param {(value: string) => void} props.onAudioCodecChange - Audio codec change callback.
 * @param {(value: string) => void} props.onContainerChange - Container change callback.
 * @param {(value: string) => void} props.onVideoBitrateChange - Video bitrate change callback.
 * @param {(value: string) => void} props.onAudioBitrateChange - Audio bitrate change callback.
 * @param {(value: string) => void} props.onScaleChange - Scale change callback.
 * @param {(value: string) => void} props.onPixelFormatChange - Pixel format change callback.
 * @returns {JSX.Element | null} The options panel, or null for compress_image.
 */
export default function BatchEncodingPanel(props: BatchEncodingPanelProps) {
  const { t } = useTranslation();
  if (props.operation === 'compress_image') return null;

  const containerOptions =
    props.operation === 'transcode' ? getVideoCodecContainer(props.videoCodec).containers : AUDIO_CONTAINER_EXTENSIONS;

  return (
    <EncodingPaper>
      <EncodingTitle variant="subtitle2" color="text.secondary">
        {t('batchQueue.encodingOptions')}
      </EncodingTitle>
      <EncodingStack direction="row" spacing={1} useFlexGap>
        {props.operation === 'transcode' && <CodecSelect type="video" value={props.videoCodec} onChange={props.onVideoCodecChange} />}
        <CodecSelect type="audio" value={props.audioCodec} onChange={props.onAudioCodecChange} />
        <TextField
          select
          size="small"
          label={t('batchQueue.container')}
          value={props.container}
          onChange={(e) => {
            props.onContainerChange(e.target.value);
          }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t('batchQueue.containerAuto')}</MenuItem>
          {containerOptions.map((container) => (
            <MenuItem key={container} value={container}>
              {container}
            </MenuItem>
          ))}
        </TextField>
        {props.operation === 'transcode' && (
          <TextField
            select
            size="small"
            label={t('convert.videoBitrate')}
            value={props.videoBitrate}
            onChange={(e) => {
              props.onVideoBitrateChange(e.target.value);
            }}
            sx={{ minWidth: 120 }}
          >
            {VIDEO_BITRATE_OPTIONS.map((b) => (
              <MenuItem key={b} value={b}>
                {b || 'Auto'}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          select
          size="small"
          label={t('convert.audioBitrate')}
          value={props.audioBitrate}
          onChange={(e) => {
            props.onAudioBitrateChange(e.target.value);
          }}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">{t('status.auto')}</MenuItem>
          {BITRATE_OPTIONS.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </TextField>
        {props.operation === 'transcode' && (
          <>
            <TextField
              select
              size="small"
              label={t('convert.scale')}
              value={props.scale}
              onChange={(e) => {
                props.onScaleChange(e.target.value);
              }}
              sx={{ minWidth: 120 }}
            >
              {SCALE_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s || t('status.none')}
                </MenuItem>
              ))}
            </TextField>
            <GroupedSelect
              value={props.pixelFormat}
              onChange={props.onPixelFormatChange}
              options={pixelFormatOptions}
              groupIcons={pixelGroupIcons}
            />
          </>
        )}
      </EncodingStack>
    </EncodingPaper>
  );
}
