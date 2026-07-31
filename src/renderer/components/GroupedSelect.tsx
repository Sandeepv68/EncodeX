import { Box, MenuItem, TextField } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';

export interface GroupedOption {
  value: string;
  label: string;
  group: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: readonly GroupedOption[];
  groupIcons: Record<string, React.ComponentType<SvgIconProps>>;
}

export default function GroupedSelect({ value, onChange, options, groupIcons }: Props) {
  let lastGroup = '';
  const items: ReturnType<typeof MenuItem>[] = [];
  for (const opt of options) {
    if (opt.group !== lastGroup) {
      lastGroup = opt.group;
      const Icon = groupIcons[opt.group];
      items.push(
        <MenuItem
          key={`group-${opt.group}`}
          disabled
          sx={{
            fontWeight: 700,
            opacity: '1 !important',
            cursor: 'default',
            fontSize: '0.8rem',
            bgcolor: 'action.selected',
            color: 'primary.main',
            py: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {Icon && <Icon sx={{ fontSize: 16 }} />}
            {opt.group}
          </Box>
        </MenuItem>,
      );
    }
    items.push(
      <MenuItem key={opt.value} value={opt.value}>
        {opt.label}
      </MenuItem>,
    );
  }
  return (
    <TextField select fullWidth size="small" value={value} onChange={(e) => onChange(e.target.value)}>
      {items}
    </TextField>
  );
}
