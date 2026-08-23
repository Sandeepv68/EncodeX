import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { HWACCEL_DEFAULTS, ENCODER_TYPE_DEFAULT } from '../../../shared/hwaccel-settings';
import { WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, LAUNCH_AT_LOGIN_STORAGE_KEY } from '../../../shared/constants';
import { THEME_STORAGE_KEY } from '../../../shared/app-constants';
import { assertNoAxeViolations } from '../../../test-utils/axe';

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
      launchAtLogin: false,
    });
  });

  it('has no axe violations', async () => {
    const { container } = renderSettings();
    await assertNoAxeViolations(container);
  });

  it('names the hwaccel mode and encoder type selects', () => {
    renderSettings();
    expect(screen.getByRole('combobox', { name: 'settings.hwaccelMode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'settings.encoderType' })).toBeInTheDocument();
  });

  const hwaccelSwitch = () => screen.getByRole('switch', { name: 'settings.hardwareAcceleration' });
  const alwaysOnTopSwitch = () => screen.getByRole('switch', { name: 'settings.alwaysOnTop' });
  const launchAtLoginSwitch = () => screen.getByRole('switch', { name: 'settings.launchAtLogin' });

  it('renders the settings title and theme row', () => {
    renderSettings();
    expect(screen.getByText('settings.title')).toBeInTheDocument();
    expect(screen.getByText('settings.theme')).toBeInTheDocument();
  });

  it('lists the light themes and the dark theme as selectable cards', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'settings.themes.light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.themes.ocean' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.themes.forest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.themes.dark' })).toBeInTheDocument();
  });

  it('marks the active theme card as pressed', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'settings.themes.light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'settings.themes.dark' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the theme and persists it when a theme card is selected', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'settings.themes.dark' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'settings.themes.dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the theme when a card is activated from the keyboard', async () => {
    const user = userEvent.setup();
    renderSettings();
    const forest = screen.getByRole('button', { name: 'settings.themes.forest' });
    forest.focus();
    await user.keyboard(' ');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('forest');
  });

  it('renders the hardware acceleration row with the mode dropdown when enabled', () => {
    renderSettings();
    expect(screen.getByText('settings.hardwareAcceleration')).toBeInTheDocument();
    expect(screen.getByText('settings.hwaccelMode')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('hides the mode dropdown when hardware acceleration is disabled', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
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
    fireEvent.click(hwaccelSwitch());
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
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(6);
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[3]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hardwareAccelerationHint');
  });

  it('shows an info tooltip for the mode setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[4]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hwaccelModeHint');
  });

  it('shows an info tooltip for the encoder type setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[5]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.encoderTypeHint');
  });

  it('keeps the hardware acceleration tooltip when disabled but hides the others', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(4);
  });

  it('renders the error-reporting row and toggles consent via the main process', async () => {
    const spy = vi.fn().mockResolvedValue({ enabled: false, backend: 'noop' });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, monitoringSetEnabled: spy },
      writable: true,
    });
    renderSettings();
    const monitoringSwitch = screen.getByTestId('settings-monitoring-error-reporting');
    expect(monitoringSwitch).toBeChecked();
    fireEvent.click(monitoringSwitch);
    expect(spy).toHaveBeenCalledWith(false);
    await waitFor(() => expect(useSettingsStore.getState().monitoringEnabled).toBe(false));
    expect(monitoringSwitch).not.toBeChecked();
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

  it('renders the launch-at-startup row', () => {
    renderSettings();
    expect(screen.getByText('settings.launchAtLogin')).toBeInTheDocument();
    expect(launchAtLoginSwitch()).toBeInTheDocument();
  });

  it('toggles launch at startup and notifies the main process', () => {
    const spy = vi.fn();
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, setLaunchAtLogin: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(launchAtLoginSwitch());
    expect(useSettingsStore.getState().launchAtLogin).toBe(true);
    expect(spy).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(LAUNCH_AT_LOGIN_STORAGE_KEY)).toBe('true');
  });

  it('shows an info tooltip for the launch-at-startup setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[1]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.launchAtLoginHint');
  });
});
