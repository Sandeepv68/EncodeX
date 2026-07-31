import CodeIcon from '@mui/icons-material/Code';
import MemoryIcon from '@mui/icons-material/Memory';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import WindowIcon from '@mui/icons-material/Window';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import AlbumIcon from '@mui/icons-material/Album';
import WifiIcon from '@mui/icons-material/Wifi';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { VIDEO_CODECS, AUDIO_CODECS } from '../../shared/media-options';
import GroupedSelect from './GroupedSelect';

const groupIcons: Record<string, React.ComponentType<SvgIconProps>> = {
  Software: CodeIcon,
  'NVIDIA NVENC': MemoryIcon,
  'Intel QSV': MemoryIcon,
  'AMD AMF': MemoryIcon,
  VAAPI: MemoryIcon,
  'Apple VideoToolbox': DevicesOtherIcon,
  'Media Foundation': WindowIcon,
  'AAC / MPEG': MusicNoteIcon,
  Dolby: TheaterComedyIcon,
  Lossless: AlbumIcon,
  Streaming: WifiIcon,
  PCM: EqualizerIcon,
  'Windows Media': WindowIcon,
  Other: MoreHorizIcon,
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
