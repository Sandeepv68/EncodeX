import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileBadge from '../ProfileBadge';
import { useProfileStore } from '../../stores/profileStore';

describe('ProfileBadge', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profiles: useProfileStore.getState().profiles.filter((p) => p.builtin),
    });
  });

  function builtinProfile() {
    return useProfileStore.getState().profiles.find((p) => p.builtin)!;
  }

  it('shows the profile name', () => {
    const builtin = builtinProfile();
    render(<ProfileBadge profile={builtin} />);
    expect(screen.getByText(builtin.name)).toBeInTheDocument();
  });

  it('renders a chip with testId', () => {
    const builtin = builtinProfile();
    render(<ProfileBadge profile={builtin} />);
    expect(screen.getByTestId('profile-badge')).toBeInTheDocument();
  });

  it('calls onClear when the delete icon is clicked', () => {
    const builtin = builtinProfile();
    const onClear = vi.fn();
    render(<ProfileBadge profile={builtin} onClear={onClear} />);
    const chip = screen.getByTestId('profile-badge');
    const deleteIcon = chip.querySelector('[class*="deleteIcon"]');
    expect(deleteIcon).toBeInTheDocument();
    fireEvent.click(deleteIcon!);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('uses custom testId when provided', () => {
    const builtin = builtinProfile();
    render(<ProfileBadge profile={builtin} testId="my-badge" />);
    expect(screen.getByTestId('my-badge')).toBeInTheDocument();
  });

  it('renders with neutral color and outlined variant', () => {
    const builtin = builtinProfile();
    render(<ProfileBadge profile={builtin} />);
    const chip = screen.getByTestId('profile-badge');
    expect(chip).toHaveClass('MuiChip-outlined');
    expect(chip).not.toHaveClass('MuiChip-colorPrimary');
  });

  it('renders medium size chip', () => {
    const builtin = builtinProfile();
    render(<ProfileBadge profile={builtin} />);
    const chip = screen.getByTestId('profile-badge');
    expect(chip).toHaveClass('MuiChip-sizeMedium');
  });
});
