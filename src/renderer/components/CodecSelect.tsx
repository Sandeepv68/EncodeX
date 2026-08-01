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
import { VIDEO_CODECS, AUDIO_CODECS } from '../../shared/media-options';
import GroupedSelect from './GroupedSelect';

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
  const codecs = type === 'video' ? VIDEO_CODECS : AUDIO_CODECS;
  return <GroupedSelect value={value} onChange={onChange} options={codecs} groupIcons={groupIcons} />;
}
