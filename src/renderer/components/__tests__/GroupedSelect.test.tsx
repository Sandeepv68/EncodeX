import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GroupedSelect from '../GroupedSelect';
import type { GroupedOption } from '../types';
import { faCode, faMemory } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const options: readonly GroupedOption[] = [
  { value: 'libx264', label: 'H.264 (libx264)', group: 'Software' },
  { value: 'libx265', label: 'H.265 (libx265)', group: 'Software' },
  { value: 'h264_nvenc', label: 'H.264 (NVENC)', group: 'Hardware' },
];

const groupIcons: Record<string, IconDefinition> = { Software: faCode, Hardware: faMemory };

describe('GroupedSelect', () => {
  it('renders options and group headers when opened', async () => {
    render(<GroupedSelect value="libx264" onChange={() => {}} options={options} groupIcons={groupIcons} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'H.264 (NVENC)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Software' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument();
  });

  it('renders a single group header once', async () => {
    render(<GroupedSelect value="libx264" onChange={() => {}} options={options} groupIcons={groupIcons} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Software' });
    expect(screen.getAllByRole('option', { name: 'Software' })).toHaveLength(1);
  });

  it('fires onChange when an option is selected', async () => {
    const onChange = vi.fn();
    render(<GroupedSelect value="libx264" onChange={onChange} options={options} groupIcons={groupIcons} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'H.265 (libx265)' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('libx265');
  });

  it('renders options without an icon for unknown groups', async () => {
    render(
      <GroupedSelect
        value="x"
        onChange={() => {}}
        options={[{ value: 'x', label: 'Custom', group: 'Unknown Group' }]}
        groupIcons={groupIcons}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unknown Group' })).toBeInTheDocument();
  });
});
