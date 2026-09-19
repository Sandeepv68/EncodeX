import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { HWACCEL_DEFAULTS, ENCODER_TYPE_DEFAULT } from '../../../shared/hwaccel-settings';
import { WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, LAUNCH_AT_LOGIN_STORAGE_KEY } from '../../../shared/constants';
import { THEME_STORAGE_KEY } from '../../../shared/app-constants';
import { assertNoAxeViolations } from '../../../test-utils/axe';

const defaultElectronAPI = window.electronAPI;

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
      mcpEnabled: false,
      mcpPort: 8765,
      mcpToken: '',
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'electronAPI', { value: defaultElectronAPI, writable: true });
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
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(7);
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[4]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hardwareAccelerationHint');
  });

  it('shows an info tooltip for the mode setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[5]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hwaccelModeHint');
  });

  it('shows an info tooltip for the encoder type setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[6]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.encoderTypeHint');
  });

  it('keeps the hardware acceleration tooltip when disabled but hides the others', () => {
    renderSettings();
    fireEvent.click(hwaccelSwitch());
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(5);
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

  const mcpSwitch = () => screen.getByTestId('settings-mcp-server');
  const mcpTokenInput = () => screen.getByLabelText('settings.mcpToken') as HTMLInputElement;

  it('renders the MCP server switch off with no port or token fields', () => {
    renderSettings();
    expect(screen.getByText('settings.mcpServer')).toBeInTheDocument();
    expect(mcpSwitch()).not.toBeChecked();
    expect(screen.queryByTestId('settings-mcp-port')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token')).not.toBeInTheDocument();
  });

  it('hides the AI use-case link until the MCP server is enabled', () => {
    renderSettings();
    expect(screen.queryByTestId('settings-mcp-ai-use-cases-link')).not.toBeInTheDocument();
  });

  it('reveals the AI use-case documentation link when the MCP server is enabled', async () => {
    renderSettings();
    fireEvent.click(mcpSwitch());
    const link = await screen.findByTestId('settings-mcp-ai-use-cases-link');
    expect(link).toHaveAttribute('href', 'https://encodex.in/features#let-an-ai-assistant-drive');
    expect(link).toHaveTextContent('settings.mcpAiUseCases');
  });

  it('shows an info tooltip for the MCP server setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[3]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.mcpServerHint');
  });

  it('reveals the MCP port and generate action but no token field when enabled', async () => {
    renderSettings();
    fireEvent.click(mcpSwitch());
    expect(await screen.findByTestId('settings-mcp-port')).toBeInTheDocument();
    expect(screen.getByTestId('settings-mcp-generate-token')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-clear-token')).not.toBeInTheDocument();
  });

  it('forwards enabling the MCP server to the main process', async () => {
    const spy = vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    expect(spy).toHaveBeenCalledWith({ enabled: true, port: 8765, token: '' });
    await waitFor(() => expect(useSettingsStore.getState().mcpEnabled).toBe(true));
  });

  it('commits the MCP port on blur and adopts the sanitized result', async () => {
    const spy = vi.fn().mockResolvedValue({ enabled: true, port: 9000, token: '' });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    const port = await screen.findByRole('spinbutton', { name: 'settings.mcpPort' });
    fireEvent.change(port, { target: { value: '9000' } });
    fireEvent.blur(port);
    expect(spy).toHaveBeenCalledWith({ enabled: true, port: 9000, token: '' });
    await waitFor(() => expect(useSettingsStore.getState().mcpPort).toBe(9000));
  });

  it('commits an edited MCP token on blur', async () => {
    const spy = vi.fn((settings) => Promise.resolve(settings));
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    fireEvent.click(await screen.findByTestId('settings-mcp-generate-token'));
    await waitFor(() => expect(mcpTokenInput().value).toHaveLength(43));
    fireEvent.change(mcpTokenInput(), { target: { value: 'secret' } });
    fireEvent.blur(mcpTokenInput());
    expect(spy).toHaveBeenCalledWith({ enabled: true, port: 8765, token: 'secret' });
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toBe('secret'));
  });

  it('hides the MCP connection details when the server is disabled', () => {
    renderSettings();
    expect(screen.queryByTestId('settings-mcp-endpoint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-authorization')).not.toBeInTheDocument();
  });

  it('reveals the MCP endpoint URL when the server is enabled', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    const endpoint = await screen.findByRole('textbox', { name: 'settings.mcpEndpoint' });
    expect(endpoint).toHaveValue('http://127.0.0.1:8765/mcp');
  });

  it('does not show the Authorization row until a token is configured', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    await screen.findByTestId('settings-mcp-endpoint');
    expect(screen.queryByTestId('settings-mcp-authorization')).not.toBeInTheDocument();
  });

  it('shows the Authorization header row when a token is configured', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: 'secret' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    const authorization = await screen.findByRole('textbox', { name: 'settings.mcpAuthorization' });
    expect(authorization).toHaveValue('Bearer secret');
  });

  it('copies the endpoint URL to the clipboard and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    await screen.findByTestId('settings-mcp-endpoint');
    fireEvent.click(screen.getByTestId('settings-mcp-copy-endpoint'));
    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:8765/mcp');
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'settings.mcpCopied')).toBe(true),
    );
  });

  it('toggles token visibility when the reveal button is clicked', async () => {
    renderSettings();
    fireEvent.click(mcpSwitch());
    fireEvent.click(await screen.findByTestId('settings-mcp-generate-token'));
    const input = (await screen.findByLabelText('settings.mcpToken')) as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByTestId('settings-mcp-token-visibility'));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByTestId('settings-mcp-token-visibility'));
    expect(input.type).toBe('password');
  });

  it('generates a secure token and commits it to the store', async () => {
    const getRandomValues = vi.fn((array: ArrayBufferView) => {
      new Uint8Array(array.buffer, array.byteOffset, 32).fill(42);
      return array;
    });
    vi.stubGlobal('crypto', { ...globalThis.crypto, getRandomValues });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn((settings) => Promise.resolve(settings)) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    fireEvent.click(await screen.findByTestId('settings-mcp-generate-token'));
    const input = (await screen.findByLabelText('settings.mcpToken')) as HTMLInputElement;
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toHaveLength(43));
    expect(input.value).toBe(useSettingsStore.getState().mcpToken);
    expect(input.value).toMatch(/^[A-Za-z0-9_-]+$/);
    vi.unstubAllGlobals();
  });

  it('copies the token to the clipboard and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: 'secret' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toBe('secret'));
    fireEvent.click(screen.getByTestId('settings-mcp-token-copy'));
    expect(writeText).toHaveBeenCalledWith('secret');
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'settings.mcpCopied')).toBe(true),
    );
  });

  it('clears the token and collapses the row back to the generate action', async () => {
    const spy = vi.fn((settings) => Promise.resolve(settings));
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    fireEvent.click(await screen.findByTestId('settings-mcp-generate-token'));
    await screen.findByTestId('settings-mcp-token');
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).not.toBe(''));
    fireEvent.click(screen.getByTestId('settings-mcp-clear-token'));
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toBe(''));
    expect(screen.getByTestId('settings-mcp-generate-token')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-clear-token')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ enabled: true, port: 8765, token: '' });
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
