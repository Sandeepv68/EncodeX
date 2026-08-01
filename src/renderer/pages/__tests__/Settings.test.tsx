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
    const initialIcon = container.querySelector('[data-icon="moon"], [data-icon="sun"]');
    expect(initialIcon).not.toBeNull();
    const initialIconName = initialIcon!.getAttribute('data-icon');
    const toggleButton = container.querySelector('button')!;
    fireEvent.click(toggleButton);
    const nextIconName = container.querySelector('[data-icon="moon"], [data-icon="sun"]')!.getAttribute('data-icon');
    expect(nextIconName).not.toBe(initialIconName);
  });
});
