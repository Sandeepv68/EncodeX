import { TextField, MenuItem } from '@mui/material';
import { VIDEO_CODECS, AUDIO_CODECS } from '../../shared/ui-constants';

interface Props {
  type: 'video' | 'audio';
  value: string;
  onChange: (value: string) => void;
}

export default function CodecSelect({ type, value, onChange }: Props) {
  const codecs = type === 'video' ? VIDEO_CODECS : AUDIO_CODECS;
  return (
    <TextField select fullWidth size="small" value={value} onChange={(e) => onChange(e.target.value)}>
      {codecs.map((c) => (
        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
      ))}
    </TextField>
  );
}
