import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { HWACCEL_DEFAULTS, ENCODER_TYPE_DEFAULT } from '../../../shared/hwaccel-settings';
import { WINDOW_ALWAYS_ON_TOP_STORAGE_KEY } from '../../../shared/constants';
import { THEME_STORAGE_KEY } from '../../../shared/app-constants';

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
      alwaysOnTop: false,
    });
  });

  const hwaccelSwitch = () => screen.getByRole('switch', { name: 'settings.hardwareAcceleration' });
  const alwaysOnTopSwitch = () => screen.getByRole('switch', { name: 'settings.alwaysOnTop' });

  it('renders the settings title and theme row', () => {
    renderSettings();
    expect(screen.getByText('settings.title')).toBeInTheDocument();
    expect(screen.getByText('settings.theme')).toBeInTheDocument();
  });

  it('lists the light themes and the dark theme in the theme dropdown', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    expect(screen.getByRole('option', { name: 'settings.themes.light' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'settings.themes.ocean' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'settings.themes.dark' })).toBeInTheDocument();
  });

  it('switches the theme and persists it when a theme is selected', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.themes.dark' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('renders the hardware acceleration row with the mode dropdown when enabled', () => {
    renderSettings();
    expect(screen.getByText('settings.hardwareAcceleration')).toBeInTheDocument();
    expect(screen.getByText('settings.hwaccelMode')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('hides the mode dropdown when hardware acceleration is disabled', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
    expect(screen.queryByText('settings.hwaccelMode')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false);
  });

  it('updates the hwaccel mode when a mode is selected', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.hwaccelModeEncode' }));
    expect(useSettingsStore.getState().hwaccelMode).toBe('encode');
  });

  it('renders the encoder type dropdown when hardware acceleration is enabled', () => {
    renderSettings();
    expect(screen.getByText('settings.encoderType')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('hides the encoder type dropdown when hardware acceleration is disabled', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
    expect(screen.queryByText('settings.encoderType')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('updates the encoder type when an option is selected', () => {
    renderSettings();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.encoderTypeHardware' }));
    expect(useSettingsStore.getState().encoderType).toBe('hardware');
  });

  it('shows info tooltips on the hardware acceleration settings', async () => {
    renderSettings();
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(4);
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[1]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hardwareAccelerationHint');
  });

  it('shows an info tooltip for the mode setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[2]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hwaccelModeHint');
  });

  it('shows an info tooltip for the encoder type setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[3]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.encoderTypeHint');
  });

  it('keeps the hardware acceleration tooltip when disabled but hides the others', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(2);
  });

  it('renders the always-on-top row', () => {
    renderSettings();
    expect(screen.getByText('settings.alwaysOnTop')).toBeInTheDocument();
    expect(alwaysOnTopSwitch()).toBeInTheDocument();
  });

  it('toggles always on top and notifies the main process', () => {
    const spy = vi.fn();
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, windowSetAlwaysOnTop: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(alwaysOnTopSwitch());
    expect(useSettingsStore.getState().alwaysOnTop).toBe(true);
    expect(spy).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY)).toBe('true');
  });

  it('shows an info tooltip for the always-on-top setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[0]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.alwaysOnTopHint');
  });
});
