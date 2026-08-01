import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';

function renderSettings() {
  return render(
    <ColorModeProvider>
      <Settings />
    </ColorModeProvider>,
  );
}

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the settings title and theme row', () => {
    renderSettings();
    expect(screen.getByText('settings.title')).toBeInTheDocument();
    expect(screen.getByText('settings.theme')).toBeInTheDocument();
  });

  it('toggles the color mode when the theme button is clicked', () => {
    const { container } = renderSettings();
    const initialIcon = container.querySelector('[data-testid="DarkModeIcon"], [data-testid="LightModeIcon"]');
    expect(initialIcon).not.toBeNull();
    const toggleButton = container.querySelector('button')!;
    fireEvent.click(toggleButton);
    const nextIcon = container.querySelector('[data-testid="DarkModeIcon"], [data-testid="LightModeIcon"]');
    expect(nextIcon?.getAttribute('data-testid')).not.toBe(initialIcon?.getAttribute('data-testid'));
  });
});
