import { faPalette, faBrush, faDroplet, faSun } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { PIXEL_FORMATS } from '../../shared/media-options';
import type { EncoderType } from '../../shared/types';

/**
 * Maps encoder types to i18n translation keys for the encoder-type selector.
 * Shared by the Convert page and Settings (previously byte-identical local
 * copies in both — refactor.md §1).
 * @const {Record<EncoderType, string>} encoderTypeLabel
 */
export const encoderTypeLabel: Record<EncoderType, string> = {
  auto: 'settings.encoderTypeAuto',
  hardware: 'settings.encoderTypeHardware',
  software: 'settings.encoderTypeSoftware',
};

/**
 * Maps pixel-format group names to FontAwesome icons used by the GroupedSelect
 * pixel-format picker, giving each group a distinct visual cue.
 * @const {Record<string, IconDefinition>} pixelGroupIcons
 */
export const pixelGroupIcons: Record<string, IconDefinition> = {
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
 * Pixel-format options prepared for the GroupedSelect: every entry of
 * PIXEL_FORMATS is spread and given a `label` equal to its `value` so the
 * select can render the format string.
 * @const {Array<{value: string; group: string; label: string}>} pixelFormatOptions
 */
export const pixelFormatOptions = PIXEL_FORMATS.map((f) => ({ ...f, label: f.value }));
