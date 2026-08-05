import { MenuItem, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { GroupedSelectProps } from './types';
import { GroupHeader, GroupLabel, GroupHeaderIconBox } from '../styles/GroupedSelect.styles';

export default function GroupedSelect({ value, onChange, options, groupIcons }: GroupedSelectProps) {
  let lastGroup = '';
  const items: ReturnType<typeof MenuItem>[] = [];
  for (const opt of options) {
    if (opt.group !== lastGroup) {
      lastGroup = opt.group;
      const icon = groupIcons[opt.group];
      items.push(
        <GroupHeader key={`group-${opt.group}`} disabled>
          <GroupLabel>
            <GroupHeaderIconBox>{icon && <FontAwesomeIcon icon={icon} />}</GroupHeaderIconBox>
            {opt.group}
          </GroupLabel>
        </GroupHeader>,
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
