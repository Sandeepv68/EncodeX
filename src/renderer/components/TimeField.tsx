import { Box, TextField, Typography } from '@mui/material';

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
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
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
    </Box>
  );
}
