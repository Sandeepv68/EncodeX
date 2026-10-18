import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAiSettingsStore } from '../../stores/aiSettingsStore';
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
    vi.clearAllMocks();
    useAiSettingsStore.getState().reset();
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'rules',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    vi.mocked(window.electronAPI.aiSetSettings).mockImplementation((update) =>
      Promise.resolve({
        providerId: update?.providerId ?? 'rules',
        model: update?.model ?? '',
        hasKey: false,
        keyHint: '',
        storedInsecurely: false,
        encryptionAvailable: true,
        connected: false,
      }),
    );
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: false, message: '' });
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
    Reflect.deleteProperty(navigator, 'clipboard');
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
    const spy = vi.fn((settings) => Promise.resolve(settings));
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

  it('commits the MCP port on Enter', async () => {
    const spy = vi.fn((settings) => Promise.resolve(settings));
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    const port = await screen.findByRole('spinbutton', { name: 'settings.mcpPort' });
    fireEvent.change(port, { target: { value: '9050' } });
    fireEvent.keyDown(port, { key: 'Enter' });
    await waitFor(() => expect(useSettingsStore.getState().mcpPort).toBe(9050));
  });

  it('reverts a non-numeric MCP port draft on blur', async () => {
    const spy = vi.fn((settings) => Promise.resolve(settings));
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: spy },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    const port = (await screen.findByRole('spinbutton', { name: 'settings.mcpPort' })) as HTMLInputElement;
    fireEvent.change(port, { target: { value: '' } });
    fireEvent.blur(port);
    await waitFor(() => expect(port.value).toBe('8765'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().mcpPort).toBe(8765);
  });

  it('commits an edited MCP token on Enter', async () => {
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
    fireEvent.keyDown(mcpTokenInput(), { key: 'Enter' });
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toBe('secret'));
  });

  it('copies the Authorization header row to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: 'secret' }) },
      writable: true,
    });
    renderSettings();
    fireEvent.click(mcpSwitch());
    await screen.findByTestId('settings-mcp-copy-token');
    fireEvent.click(screen.getByTestId('settings-mcp-copy-token'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Bearer secret'));
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

  it('keeps the AI provider editor collapsed until the toggle is clicked', () => {
    renderSettings();
    expect(screen.getByText('settings.ai.title')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai')).not.toBeInTheDocument();
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
  });

  it('renders a provider button for every AI provider', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    for (const id of ['rules', 'openai', 'anthropic', 'gemini', 'local']) {
      expect(screen.getByTestId(`settings-ai-provider-${id}`)).toBeInTheDocument();
    }
  });

  it('renders each provider as a horizontal icon | separator | name button', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    for (const id of ['rules', 'openai', 'anthropic', 'gemini', 'local']) {
      const button = screen.getByTestId(`settings-ai-provider-${id}`);
      expect(button.querySelectorAll(':scope > span[aria-hidden="true"]')).toHaveLength(1);
      expect(within(button).getByText(`settings.ai.providers.${id}`)).toBeInTheDocument();
    }
    const button = screen.getByTestId('settings-ai-provider-openai');
    const icon = within(button).getByTestId('settings-ai-logo-openai');
    const separator = button.querySelector(':scope > span[aria-hidden="true"]')!;
    const name = within(button).getByText('settings.ai.providers.openai');
    expect(icon.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separator.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides connect, advanced, and settings fields for the built-in rules provider', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.queryByTestId('settings-ai-connect')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-advanced')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-rules-note')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-base-url')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    expect(screen.getByTestId('settings-ai-connect')).toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-advanced')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-rules-note')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-provider-rules'));
    expect(screen.queryByTestId('settings-ai-connect')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-advanced')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-rules-note')).toBeInTheDocument();
  });

  it('persists the built-in rules choice when switching back from a saved provider', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-rules'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'rules' }));
    expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads the stored AI settings when the editor is expanded', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    expect(await screen.findByTestId('settings-ai')).toBeInTheDocument();
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('settings-ai-provider-openai')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: 'settings.ai.model' })).toHaveValue('gpt-4o');
  });

  it('saves and tests the selected provider in one connect step', async () => {
    const spy = vi.fn().mockResolvedValue({
      providerId: 'anthropic',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    vi.mocked(window.electronAPI.aiSetSettings).mockImplementation(spy);
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: true, message: 'Connected', latencyMs: 42 });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-anthropic'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'anthropic' })));
    await waitFor(() => expect(screen.getByTestId('settings-ai-status')).toHaveTextContent('Connected (42 ms)'));
  });

  it('deep-links to the provider key page for remote providers', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    const link = screen.getByTestId('settings-ai-get-key');
    expect(link).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('pastes the clipboard into the API key field', async () => {
    const readText = vi.fn().mockResolvedValue('sk-clip');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-paste'));
    await waitFor(() => expect(screen.getByLabelText('settings.ai.apiKey')).toHaveValue('sk-clip'));
  });

  it('edits the AI model and API key fields', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    const key = screen.getByLabelText('settings.ai.apiKey') as HTMLInputElement;
    fireEvent.change(key, { target: { value: 'sk-1' } });
    expect(key).toHaveValue('sk-1');
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    fireEvent.change(model, { target: { value: 'gpt-4o-mini' } });
    expect(model).toHaveValue('gpt-4o-mini');
  });

  it('loads model suggestions from the provider API when advanced is opened', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI.aiListModels).mockResolvedValue({
      ok: true,
      models: ['gpt-4o-mini', 'gpt-6-astra', 'gpt-4.1'],
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    await user.click(model);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('gpt-6-astra')).toBeInTheDocument();
    await user.click(within(listbox).getByText('gpt-6-astra'));
    expect(model).toHaveValue('gpt-6-astra');
  });

  it('disables remote providers while offline and shows the network tooltip', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    for (const id of ['openai', 'anthropic', 'gemini']) {
      expect(screen.getByTestId(`settings-ai-provider-${id}`)).toBeDisabled();
    }
    expect(screen.getByTestId('settings-ai-provider-rules')).toBeEnabled();
    expect(screen.getByTestId('settings-ai-provider-local')).toBeEnabled();
    const remote = screen.getByTestId('settings-ai-provider-openai');
    fireEvent.mouseOver(remote.closest('span') as HTMLElement);
    expect(await screen.findByText('settings.ai.requiresNetwork')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('falls back to the built-in rules provider when the connection drops', async () => {
    let online = true;
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    online = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByTestId('settings-ai-offline-fallback')).toHaveTextContent('settings.ai.offlineFallback');
    expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'rules' }));
    spy.mockRestore();
  });

  it('keeps the model field usable when the provider list fetch fails', async () => {
    vi.mocked(window.electronAPI.aiListModels).mockRejectedValue(new Error('offline'));
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    expect(model).toBeEnabled();
    fireEvent.change(model, { target: { value: 'my-own-model' } });
    expect(model).toHaveValue('my-own-model');
  });

  it('ignores a malformed model-list result', async () => {
    vi.mocked(window.electronAPI.aiListModels).mockResolvedValue({ ok: true } as never);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: 'settings.ai.model' })).toBeEnabled();
  });

  it('shows the persisted connected status when the editor loads a verified view', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: true,
      connectedAt: 1,
      connectedModel: 'gpt-4o',
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(await screen.findByTestId('settings-ai-connected')).toHaveTextContent('settings.ai.statusConnected');
  });

  it('shows the connected status from the refreshed view after a successful connect', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({
      ok: true,
      message: 'Connected to openai.',
      latencyMs: 42,
      model: 'gpt-4o-mini',
      view: {
        providerId: 'openai',
        model: '',
        hasKey: true,
        keyHint: '••••',
        storedInsecurely: false,
        encryptionAvailable: true,
        connected: true,
        connectedAt: 2,
        connectedModel: 'gpt-4o-mini',
      },
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-connected')).toBeInTheDocument();
  });

  const connectedOpenAiView = {
    providerId: 'openai' as const,
    model: '',
    hasKey: true,
    keyHint: '••••••••',
    storedInsecurely: false,
    encryptionAvailable: true,
    connected: true,
    connectedAt: 2,
    connectedModel: 'gpt-4o-mini',
  };

  it('shows a saved-key affordance and removes the stored key', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: '',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.getByLabelText('settings.ai.apiKey')).toHaveAttribute('placeholder', 'settings.ai.keySavedPlaceholder');
    fireEvent.click(screen.getByTestId('settings-ai-remove-key'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'openai', clearKey: true }));
    await waitFor(() => expect(screen.queryByTestId('settings-ai-remove-key')).not.toBeInTheDocument());
  });

  it('shows only the selected provider own saved-key state when switching', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
      providerSummaries: {
        anthropic: { model: 'claude-x', hasKey: false, keyHint: '', storedInsecurely: false },
        gemini: { model: '', hasKey: true, keyHint: '••••••••', storedInsecurely: false },
      },
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');

    // OpenAI has a key: the saved-key affordance shows and no key is typed in.
    expect(screen.getByTestId('settings-ai-remove-key')).toBeInTheDocument();
    expect(screen.getByLabelText('settings.ai.apiKey')).toHaveAttribute('placeholder', 'settings.ai.keySavedPlaceholder');

    // Anthropic stores no key: the editor must not claim one is saved.
    fireEvent.click(screen.getByTestId('settings-ai-provider-anthropic'));
    expect(screen.getByTestId('settings-ai-provider-anthropic')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('settings-ai-remove-key')).not.toBeInTheDocument();
    expect(screen.getByLabelText('settings.ai.apiKey')).toHaveAttribute('placeholder', 'settings.ai.apiKeyPlaceholder');

    // Gemini stores a key: its own affordance comes back for it.
    fireEvent.click(screen.getByTestId('settings-ai-provider-gemini'));
    expect(screen.getByTestId('settings-ai-remove-key')).toBeInTheDocument();
    expect(screen.getByLabelText('settings.ai.apiKey')).toHaveAttribute('placeholder', 'settings.ai.keySavedPlaceholder');

    // Switching never persists the selection (that would activate the provider).
    expect(window.electronAPI.aiSetSettings).not.toHaveBeenCalled();
  });

  it('keeps showing the connected provider in the header and dots after selecting another', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: true,
      connectedAt: 5,
      connectedModel: 'gpt-4o-mini',
      activeConnection: { providerId: 'openai', model: 'gpt-4o-mini', at: 5 },
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.getByTestId('settings-ai-connected-dot-openai')).toBeInTheDocument();

    // Selecting a different provider must not hide the one connection.
    fireEvent.click(screen.getByTestId('settings-ai-provider-anthropic'));
    expect(screen.getByTestId('settings-ai-connected-dot-openai')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-connected-dot-anthropic')).not.toBeInTheDocument();
    // And it must not claim the freshly selected provider is connected.
    expect(screen.queryByTestId('settings-ai-connected')).not.toBeInTheDocument();
    expect(window.electronAPI.aiSetSettings).not.toHaveBeenCalled();
  });

  it('shows a save error when removing the key returns an unusable view', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: '',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    vi.mocked(window.electronAPI.aiSetSettings).mockResolvedValue({} as never);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-remove-key'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.saveFailed');
    expect(screen.getByTestId('settings-ai-remove-key')).toBeInTheDocument();
  });

  it('surfaces a key-removal rejection as an error', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: '',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    vi.mocked(window.electronAPI.aiSetSettings).mockRejectedValue(new Error('boom'));
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-remove-key'));
    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
  });

  it('switches the connect button to a connected state after a successful test', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({
      ok: true,
      message: 'Connected to openai.',
      latencyMs: 42,
      model: 'gpt-4o-mini',
      view: connectedOpenAiView,
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await screen.findByTestId('settings-ai-connected');
    expect(screen.getByTestId('settings-ai-connect')).toHaveTextContent('settings.ai.connected');
    expect(screen.getByTestId('settings-ai-connected-dot-openai')).toBeInTheDocument();
  });

  it('marks the connection stale when settings change after connecting', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({
      ok: true,
      message: 'Connected to openai.',
      latencyMs: 42,
      model: 'gpt-4o-mini',
      view: connectedOpenAiView,
    });
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await screen.findByTestId('settings-ai-connected');
    fireEvent.change(screen.getByLabelText('settings.ai.apiKey'), { target: { value: 'sk-new' } });
    expect(screen.queryByTestId('settings-ai-connected')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-stale')).toHaveTextContent('settings.ai.staleStatus');
    expect(screen.getByTestId('settings-ai-connect')).toHaveTextContent('settings.ai.connect');
  });

  it('restores the connected state from the session cache when remounted', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({
      ok: true,
      message: 'Connected to openai.',
      latencyMs: 42,
      model: 'gpt-4o-mini',
      view: connectedOpenAiView,
    });
    const first = renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await screen.findByTestId('settings-ai-connected');
    first.unmount();
    vi.mocked(window.electronAPI.aiGetSettings).mockClear();
    renderSettings();
    expect(screen.getByTestId('settings-ai-header-status')).toHaveTextContent('settings.ai.headerConnected');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-ai-connected')).toBeInTheDocument();
  });

  it('shows the endpoint for local and the model under Advanced', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-local'));
    expect(screen.getByTestId('settings-ai-base-url')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    expect(screen.getByTestId('settings-ai-model')).toBeInTheDocument();
  });

  it('edits the local provider base URL', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-local'));
    const base = screen.getByRole('textbox', { name: 'settings.ai.baseUrl' }) as HTMLInputElement;
    fireEvent.change(base, { target: { value: 'http://127.0.0.1:11434/v1' } });
    expect(base).toHaveValue('http://127.0.0.1:11434/v1');
  });

  it('edits the OpenAI base URL from the advanced panel', async () => {
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'settings.ai.baseUrl' })).toBeInTheDocument());
    const base = screen.getByRole('textbox', { name: 'settings.ai.baseUrl' }) as HTMLInputElement;
    await waitFor(() => expect(base).toBeEnabled());
    fireEvent.change(base, { target: { value: 'https://proxy.example/v1' } });
    await waitFor(() => expect(base).toHaveValue('https://proxy.example/v1'));
  });

  it('shows a save error when the bridge returns an unusable view', async () => {
    vi.mocked(window.electronAPI.aiSetSettings).mockResolvedValue({} as never);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.saveFailed');
  });

  it('surfaces a save rejection as an error', async () => {
    vi.mocked(window.electronAPI.aiSetSettings).mockRejectedValue(new Error('boom'));
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
  });

  it('reports a failed connection test without a reason as a generic error', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: false } as never);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.testFailed');
  });

  it('shows a localized message for a classified connection failure', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: false, message: 'x', reason: 'invalidKey', status: 401 } as never);
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.errors.invalidKey');
  });

  it('surfaces a connection-test rejection as an error', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockRejectedValue(new Error('boom'));
    renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
  });

  it('has no axe violations with the AI editor expanded', async () => {
    const { container } = renderSettings();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await assertNoAxeViolations(container);
  });
});
