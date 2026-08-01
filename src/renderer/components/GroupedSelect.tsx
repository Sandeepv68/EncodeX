import { MenuItem, TextField } from '@mui/material';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { GroupHeader, GroupLabel, GroupHeaderIconBox } from '../styles/GroupedSelect.styles';

export interface GroupedOption {
  value: string;
  label: string;
  group: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: readonly GroupedOption[];
  groupIcons: Record<string, IconDefinition>;
}

export default function GroupedSelect({ value, onChange, options, groupIcons }: Props) {
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
