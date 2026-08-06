/**
 * @fileoverview Select dropdown with grouped, non-selectable headers.
 *
 * Renders a {@link TextField}-based select whose options are grouped under
 * disabled group headers. Each group header shows a FontAwesome icon from
 * `groupIcons` (when provided) next to the group name; the headers are purely
 * decorative and cannot be selected.
 *
 * Used by screens that need to organize a large set of choices into labeled
 * categories (e.g. encoder presets grouped by family). The selection is
 * controlled: the current `value` is shown and changes bubble up through
 * `onChange`.
 *
 * Props (see {@link GroupedSelectProps}):
 *  - value: currently selected option value.
 *  - onChange: callback receiving the newly selected value.
 *  - options: ordered array of groupable options.
 *  - groupIcons: map of group name to FontAwesome icon definition.
 */

import { MenuItem, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { GroupedSelectProps } from './types';
import { GroupHeader, GroupLabel, GroupHeaderIconBox } from '../styles/GroupedSelect.styles';

/**
 * Renders the grouped select dropdown.
 *
 * Iterates the `options` array in order, emitting a disabled {@link GroupHeader}
 * row the first time each distinct group is encountered (with its icon from
 * `groupIcons`) followed by a {@link MenuItem} per option. Because the input
 * options are already ordered, grouping relies on run-length detection of the
 * `group` field rather than sorting. The result is rendered inside a small,
 * full-width `select` TextField controlled by `value`/`onChange`.
 *
 * @param {GroupedSelectProps} props - Component props.
 * @param {string} props.value - The currently selected option value.
 * @param {(value: string) => void} props.onChange - Callback invoked with the
 *   newly selected value.
 * @param {readonly GroupedOption[]} props.options - Ordered, groupable options
 *   to render; groups must be contiguous for headers to deduplicate correctly.
 * @param {Record<string, IconDefinition>} props.groupIcons - Maps each group
 *   name to the FontAwesome icon shown in its header.
 * @returns {JSX.Element} The select field with grouped items.
 */
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
