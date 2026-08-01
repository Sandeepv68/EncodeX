import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { HWACCEL_DEFAULTS, ENCODER_TYPE_DEFAULT } from '../../../shared/hwaccel-settings';

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
    useSettingsStore.setState({
      hardwareAcceleration: HWACCEL_DEFAULTS.ENABLED,
      hwaccelMode: HWACCEL_DEFAULTS.MODE,
      encoderType: ENCODER_TYPE_DEFAULT,
    });
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

  it('renders the hardware acceleration row with the mode dropdown when enabled', () => {
    renderSettings();
    expect(screen.getByText('settings.hardwareAcceleration')).toBeInTheDocument();
    expect(screen.getByText('settings.hwaccelMode')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('hides the mode dropdown when hardware acceleration is disabled', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByText('settings.hwaccelMode')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false);
  });

  it('updates the hwaccel mode when a mode is selected', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.hwaccelModeEncode' }));
    expect(useSettingsStore.getState().hwaccelMode).toBe('encode');
  });

  it('renders the encoder type dropdown when hardware acceleration is enabled', () => {
    renderSettings();
    expect(screen.getByText('settings.encoderType')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('hides the encoder type dropdown when hardware acceleration is disabled', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByText('settings.encoderType')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('updates the encoder type when an option is selected', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.encoderTypeHardware' }));
    expect(useSettingsStore.getState().encoderType).toBe('hardware');
  });

  it('shows info tooltips on the hardware acceleration settings', async () => {
    renderSettings();
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(3);
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[0]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hardwareAccelerationHint');
  });

  it('shows an info tooltip for the mode setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[1]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hwaccelModeHint');
  });

  it('shows an info tooltip for the encoder type setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[2]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.encoderTypeHint');
  });

  it('keeps the hardware acceleration tooltip when disabled but hides the others', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(1);
  });
});
