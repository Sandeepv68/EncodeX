/**
 * @fileoverview Codec selection dropdown with grouping and icons.
 *
 * Renders a grouped, icon-bearing codec picker for either video or audio
 * codecs. Available codecs come from the `useCapabilities` hook (cached
 * ffmpeg/transcoder capability probe results); a custom `encoderType` of
 * 'hardware' or 'software' filters the video list down to matching entries
 * using `isHardwareVideoCodec`, while 'auto' (the default) leaves the list
 * unfiltered.
 *
 * The selected `value` is always represented in the dropdown even when the
 * capability filter would exclude it: if the current value is absent from the
 * filtered list, it is prepended as an 'Other' group option. The selection is
 * rendered through the shared {@link GroupedSelect} component with a fixed set
 * of group icons mapping encoder families (Software, NVIDIA NVENC, Intel QSV,
 * AMD AMF, VAAPI, Apple VideoToolbox, etc.) to FontAwesome icons.
 *
 * Props (see {@link CodecSelectProps}):
 *  - type: 'video' or 'audio' decides which capability list to use.
 *  - value: the currently selected codec string.
 *  - onChange: fired with the newly selected codec value.
 *  - encoderType: optional hardware/software filter for video codecs.
 */

import {
  faCode,
  faMemory,
  faDesktop,
  faWindowRestore,
  faMusic,
  faMasksTheater,
  faCompactDisc,
  faWifi,
  faSliders,
  faEllipsis,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import GroupedSelect from './GroupedSelect';
import { useCapabilities } from '../hooks/useCapabilities';
import { isHardwareVideoCodec } from '../../shared/codec-classification';
import type { CodecSelectProps, GroupedOption } from './types';

/**
 * Maps codec group names to the FontAwesome icons shown in each group header.
 * @const {Record<string, IconDefinition>} groupIcons
 */
const groupIcons: Record<string, IconDefinition> = {
  Software: faCode,
  'NVIDIA NVENC': faMemory,
  'Intel QSV': faMemory,
  'AMD AMF': faMemory,
  VAAPI: faMemory,
  'Apple VideoToolbox': faDesktop,
  'Media Foundation': faWindowRestore,
  'AAC / MPEG': faMusic,
  Dolby: faMasksTheater,
  Lossless: faCompactDisc,
  Streaming: faWifi,
  PCM: faSliders,
  'Windows Media': faWindowRestore,
  Other: faEllipsis,
};

/**
 * Renders a grouped, icon-bearing codec selector.
 *
 * Selects the codec list from the capabilities hook based on `type`, applies
 * the optional hardware/software filter for video codecs, and guarantees the
 * current `value` appears as an 'Other' option if the filter would otherwise
 * hide it. Delegates rendering to {@link GroupedSelect}.
 * @param {CodecSelectProps} props - Component props.
 * @param {'video' | 'audio'} props.type - Which codec capability list to use.
 * @param {string} props.value - Currently selected codec value.
 * @param {(value: string) => void} props.onChange - Callback fired on selection.
 * @param {EncoderType} [props.encoderType='auto'] - Optional filter; 'hardware'
 *   or 'software' restricts video codecs to that category, 'auto' shows all.
 * @returns {JSX.Element} The grouped select control.
 */
export default function CodecSelect({ type, value, onChange, encoderType = 'auto', testId }: CodecSelectProps) {
  const { videoCodecs, audioCodecs } = useCapabilities();
  const base = type === 'video' ? videoCodecs : audioCodecs;
  const filtered =
    type === 'video' && (encoderType === 'hardware' || encoderType === 'software')
      ? base.filter((c) => (encoderType === 'hardware' ? isHardwareVideoCodec(c.value) : !isHardwareVideoCodec(c.value)))
      : base;
  const codecs: GroupedOption[] =
    value && !filtered.some((c) => c.value === value) ? [{ value, label: value, group: 'Other' }, ...filtered] : filtered;
  return <GroupedSelect testId={testId} value={value} onChange={onChange} options={codecs} groupIcons={groupIcons} />;
}
