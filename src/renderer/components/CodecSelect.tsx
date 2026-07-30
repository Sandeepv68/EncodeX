import { TextField, MenuItem, Box } from '@mui/material';
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
import { VIDEO_CODECS, AUDIO_CODECS } from '../../shared/ui-constants';

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

  let lastGroup = '';
  const items: ReturnType<typeof MenuItem>[] = [];
  for (const c of codecs) {
    if (c.group !== lastGroup) {
      lastGroup = c.group;
      const Icon = groupIcons[c.group];
      items.push(
        <MenuItem key={`group-${c.group}`} disabled sx={{ fontWeight: 700, opacity: '1 !important', cursor: 'default', fontSize: '0.8rem', bgcolor: 'action.selected', color: 'primary.main', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {Icon && <Icon sx={{ fontSize: 16 }} />}
            {c.group}
          </Box>
        </MenuItem>,
      );
    }
    items.push(
      <MenuItem key={c.value} value={c.value}>
        {c.label}
      </MenuItem>,
    );
  }

  return (
    <TextField select fullWidth size="small" value={value} onChange={(e) => onChange(e.target.value)}>
      {items}
    </TextField>
  );
}
