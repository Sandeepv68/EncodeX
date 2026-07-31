import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppDrawer from '../AppDrawer';
import { ColorModeProvider } from '../../ColorModeContext';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderDrawer({ isMobile = false, onNavigate = vi.fn() } = {}) {
  return render(
    <MemoryRouter initialEntries={['/convert']}>
      <ColorModeProvider>
        <AppDrawer isMobile={isMobile} onNavigate={onNavigate} />
        <LocationProbe />
      </ColorModeProvider>
    </MemoryRouter>,
  );
}

describe('AppDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the app title and nav items', () => {
    renderDrawer();
    expect(screen.getByText('app.name')).toBeInTheDocument();
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
  });

  it('navigates to the clicked route', () => {
    renderDrawer();
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
    fireEvent.click(screen.getByText('nav.dashboard'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('calls onNavigate on mobile when a nav item is clicked', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: true, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('does not call onNavigate on desktop', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: false, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('toggles the color mode icon when clicked', () => {
    const { container } = renderDrawer();
    const initialIcon = container.querySelector('[data-testid="DarkModeIcon"], [data-testid="LightModeIcon"]');
    expect(initialIcon).not.toBeNull();
    const toggleButton = container.querySelector('button')!;
    fireEvent.click(toggleButton);
    const nextIcon = container.querySelector('[data-testid="DarkModeIcon"], [data-testid="LightModeIcon"]');
    expect(nextIcon?.getAttribute('data-testid')).not.toBe(initialIcon?.getAttribute('data-testid'));
  });
});
