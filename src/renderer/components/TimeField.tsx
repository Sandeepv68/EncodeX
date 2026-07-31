import { TextField } from '@mui/material';
import { FieldBox, FieldLabel } from '../styles/TimeField.styles';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export default function TimeField({ label, value, placeholder, error, onChange, onBlur }: Props) {
  return (
    <FieldBox>
      <FieldLabel variant="caption" color="text.secondary">
        {label}
      </FieldLabel>
      <TextField
        fullWidth
        size="small"
        error={!!error}
        helperText={error || ' '}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldBox>
  );
}
