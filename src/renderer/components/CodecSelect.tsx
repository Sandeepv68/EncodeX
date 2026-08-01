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
import type { GroupedOption } from './GroupedSelect';

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

interface Props {
  type: 'video' | 'audio';
  value: string;
  onChange: (value: string) => void;
}

export default function CodecSelect({ type, value, onChange }: Props) {
  const { videoCodecs, audioCodecs } = useCapabilities();
  const base = type === 'video' ? videoCodecs : audioCodecs;
  const codecs: GroupedOption[] = value && !base.some((c) => c.value === value) ? [{ value, label: value, group: 'Other' }, ...base] : base;
  return <GroupedSelect value={value} onChange={onChange} options={codecs} groupIcons={groupIcons} />;
}
