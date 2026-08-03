import { TextField } from '@mui/material';
import InfoTooltip from './InfoTooltip';
import { FieldBox, FieldLabel } from '../styles/TimeField.styles';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export default function TimeField({ label, value, placeholder, error, hint, onChange, onBlur }: Props) {
  return (
    <FieldBox>
      <FieldLabel variant="caption" color="text.secondary">
        {label}
        {hint && <InfoTooltip title={hint} />}
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
