import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileBadge from '../ProfileBadge';
import { useProfileStore } from '../../stores/profileStore';

describe('ProfileBadge', () => {
  beforeEach(() => {
    useProfileStore.setState({
      activeProfileId: null,
      profiles: useProfileStore.getState().profiles.filter((p) => p.builtin),
    });
  });

  it('renders nothing when no profile is active', () => {
    const { container } = render(<ProfileBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when activeProfileId points to nonexistent profile', () => {
    useProfileStore.setState({ activeProfileId: 'nonexistent-id' });
    const { container } = render(<ProfileBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the profile name when a profile is active', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge />);
    expect(screen.getByText(builtin.name)).toBeInTheDocument();
  });

  it('renders a chip with testId', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge />);
    expect(screen.getByTestId('profile-badge')).toBeInTheDocument();
  });

  it('clears the active profile when delete is clicked', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge />);
    const chip = screen.getByTestId('profile-badge');
    const deleteIcon = chip.querySelector('[class*="deleteIcon"]');
    expect(deleteIcon).toBeInTheDocument();
    fireEvent.click(deleteIcon!);
    expect(useProfileStore.getState().activeProfileId).toBeNull();
  });

  it('uses custom testId when provided', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge testId="my-badge" />);
    expect(screen.getByTestId('my-badge')).toBeInTheDocument();
  });

  it('renders with primary color and outlined variant', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge />);
    const chip = screen.getByTestId('profile-badge');
    expect(chip).toHaveClass('MuiChip-outlined');
    expect(chip).toHaveClass('MuiChip-colorPrimary');
  });

  it('renders small size chip', () => {
    const builtin = useProfileStore.getState().profiles.find((p) => p.builtin)!;
    useProfileStore.setState({ activeProfileId: builtin.id });
    render(<ProfileBadge />);
    const chip = screen.getByTestId('profile-badge');
    expect(chip).toHaveClass('MuiChip-sizeSmall');
  });
});
