import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Settings from '../Settings';
import { ColorModeProvider } from '../../ColorModeContext';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAiSettingsStore } from '../../stores/aiSettingsStore';
import { useAiConnectionStore } from '../../stores/aiConnectionStore';
import { useToastStore } from '../../stores/toastStore';
import { HWACCEL_DEFAULTS, ENCODER_TYPE_DEFAULT } from '../../../shared/hwaccel-settings';
import {
  WINDOW_ALWAYS_ON_TOP_STORAGE_KEY,
  LAUNCH_AT_LOGIN_STORAGE_KEY,
  DESKTOP_NOTIFICATIONS_STORAGE_KEY,
} from '../../../shared/constants';
import { THEME_STORAGE_KEY } from '../../../shared/app-constants';
import type { AIProviderId } from '../../../shared/ai/types';
import type { SettingsLocationState } from '../../types';
import { assertNoAxeViolations } from '../../../test-utils/axe';
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';

vi.mock('../../../shared/analytics/AnalyticsService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../shared/analytics/AnalyticsService')>();
  return { ...mod, recordAnalyticsEvent: vi.fn() };
});

const recordAnalyticsMock = vi.mocked(recordAnalyticsEvent);

const defaultElectronAPI = window.electronAPI;

/**
 * Renders the Settings page the way the app does: inside a router (it reads
 * the location state to find out whether the AI editor should be revealed)
 * and inside the color-mode provider that installs the MUI theme.
 * @param {SettingsLocationState} [state] - The location state to render with.
 * @returns {import('@testing-library/react').RenderResult} The render result.
 */
function renderSettings(state?: SettingsLocationState) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/settings', state }]}>
      <ColorModeProvider>
        <Settings />
      </ColorModeProvider>
    </MemoryRouter>,
  );
}

/**
 * Renders the page and then activates one of the non-default tabs.
 * @param {'advanced'|'ai'} tab - The tab to select.
 * @param {SettingsLocationState} [state] - The location state to render with.
 * @returns {import('@testing-library/react').RenderResult} The render result.
 */
function renderSettingsOn(tab: 'advanced' | 'ai', state?: SettingsLocationState) {
  const result = renderSettings(state);
  fireEvent.click(screen.getByTestId(`settings-tab-${tab}`));
  return result;
}

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAiSettingsStore.getState().reset();
    // The app hydrates the connection mirror at startup; the tests start from
    // a cold mirror so the mount load is exercised.
    useAiConnectionStore.getState().reset();
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'rules',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    // Mirrors src/main/ai/settings.ts: an update with `activate: false` targets
    // a provider without making it the active one, so the active provider (the
    // one the Copilot plans with) survives a mere selection.
    let activeProvider: AIProviderId = 'rules';
    vi.mocked(window.electronAPI.aiSetSettings).mockImplementation((update) => {
      if (update?.activate !== false && update?.providerId) activeProvider = update.providerId;
      return Promise.resolve({
        providerId: activeProvider,
        model: update?.model ?? '',
        hasKey: false,
        keyHint: '',
        storedInsecurely: false,
        encryptionAvailable: true,
        connected: false,
        ...(update?.providerId ? { selectedProviderId: update.providerId } : {}),
      });
    });
    vi.mocked(window.electronAPI.aiResetSettings).mockResolvedValue({
      providerId: 'rules',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
      selectedProviderId: 'rules',
    });
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
    for (const tab of ['general', 'advanced', 'ai'] as const) {
      const { container, unmount } = renderSettings();
      if (tab !== 'general') fireEvent.click(screen.getByTestId(`settings-tab-${tab}`));
      await assertNoAxeViolations(container);
      unmount();
    }
  });

  describe('tabs', () => {
    it('renders a labelled tablist with General selected by default', () => {
      renderSettings();
      expect(screen.getByRole('tablist', { name: 'settings.tabs.ariaLabel' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'settings.tabs.general' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'settings.tabs.advanced' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'settings.tabs.ai' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('settings-tabpanel-general')).toBeVisible();
      expect(screen.getByTestId('settings-tabpanel-advanced')).not.toBeVisible();
      expect(screen.getByTestId('settings-tabpanel-ai')).not.toBeVisible();
    });

    it('wires each tab to its panel through aria-controls and aria-labelledby', () => {
      renderSettings();
      for (const tab of ['general', 'advanced', 'ai']) {
        const tabEl = screen.getByTestId(`settings-tab-${tab}`);
        const panel = screen.getByTestId(`settings-tabpanel-${tab}`);
        expect(tabEl).toHaveAttribute('aria-controls', `settings-tabpanel-${tab}`);
        expect(panel).toHaveAttribute('id', `settings-tabpanel-${tab}`);
        expect(panel).toHaveAttribute('aria-labelledby', `settings-tab-${tab}`);
      }
    });

    it('reveals only the selected panel when tabs are clicked', async () => {
      const user = userEvent.setup();
      renderSettings();
      await user.click(screen.getByRole('tab', { name: 'settings.tabs.advanced' }));
      expect(screen.getByTestId('settings-tabpanel-advanced')).toBeVisible();
      expect(screen.getByTestId('settings-tabpanel-general')).not.toBeVisible();
      await user.click(screen.getByRole('tab', { name: 'settings.tabs.ai' }));
      expect(screen.getByTestId('settings-tabpanel-ai')).toBeVisible();
      expect(screen.getByTestId('settings-tabpanel-advanced')).not.toBeVisible();
      await user.click(screen.getByRole('tab', { name: 'settings.tabs.general' }));
      expect(screen.getByTestId('settings-tabpanel-general')).toBeVisible();
      expect(screen.getByTestId('settings-tabpanel-ai')).not.toBeVisible();
    });

    it('moves the selection with the keyboard', async () => {
      const user = userEvent.setup();
      renderSettings();
      const general = screen.getByRole('tab', { name: 'settings.tabs.general' });
      const advanced = screen.getByRole('tab', { name: 'settings.tabs.advanced' });
      const ai = screen.getByRole('tab', { name: 'settings.tabs.ai' });
      await user.click(general);
      await user.keyboard('{ArrowRight}');
      expect(advanced).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(advanced).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{End}');
      expect(ai).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(ai).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{Home}');
      expect(general).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(general).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps store-backed toggles after a tab round-trip', () => {
      renderSettings();
      fireEvent.click(alwaysOnTopSwitch());
      fireEvent.click(screen.getByTestId('settings-tab-advanced'));
      expect(screen.getByTestId('settings-tabpanel-general')).not.toBeVisible();
      fireEvent.click(screen.getByTestId('settings-tab-general'));
      expect(alwaysOnTopSwitch()).toBeChecked();
      expect(useSettingsStore.getState().alwaysOnTop).toBe(true);
    });

    it('keeps an MCP port draft when switching tabs and back', async () => {
      renderSettingsOn('ai');
      fireEvent.click(mcpSwitch());
      const port = await screen.findByRole('spinbutton', { name: 'settings.mcpPort' });
      fireEvent.change(port, { target: { value: '9000' } });
      fireEvent.click(screen.getByTestId('settings-tab-general'));
      fireEvent.click(screen.getByTestId('settings-tab-ai'));
      expect(screen.getByRole('spinbutton', { name: 'settings.mcpPort' })).toHaveValue(9000);
    });

    it('selects the AI tab when a deep link arrives while already mounted', async () => {
      /**
       * Renders a button that re-navigates to Settings with the AI deep-link
       * state, simulating a second navigation while the page is mounted.
       * @returns {JSX.Element} The harness button.
       */
      function DeepLinkButton() {
        const navigate = useNavigate();
        return (
          <button type="button" onClick={() => navigate('/settings', { state: { openAiProvider: true } })}>
            deep-link
          </button>
        );
      }

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <ColorModeProvider>
            <DeepLinkButton />
            <Settings />
          </ColorModeProvider>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByTestId('settings-tab-advanced'));
      expect(screen.getByRole('tab', { name: 'settings.tabs.advanced' })).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'deep-link' }));
      expect(screen.getByRole('tab', { name: 'settings.tabs.ai' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('settings-tabpanel-ai')).toBeVisible();
    });
  });

  describe('tab analytics', () => {
    /**
     * Returns the payloads of the recorded `settings_tab_viewed` events.
     * @returns {Array<{ tab: string }>} The recorded tab-view payloads.
     */
    const tabEvents = (): { tab: string }[] =>
      recordAnalyticsMock.mock.calls
        .map(([event]) => event)
        .filter((event) => event.name === 'settings_tab_viewed')
        .map((event) => event.props as { tab: string });

    it('does not record a tab view on the initial render', () => {
      renderSettings();
      expect(tabEvents()).toHaveLength(0);
    });

    it('records one tab view per user-initiated change', () => {
      renderSettings();
      fireEvent.click(screen.getByTestId('settings-tab-advanced'));
      fireEvent.click(screen.getByTestId('settings-tab-ai'));
      expect(tabEvents().map((payload) => payload.tab)).toEqual(['advanced', 'ai']);
    });

    it('does not record a tab view when the selected tab is clicked again', () => {
      renderSettings();
      fireEvent.click(screen.getByTestId('settings-tab-general'));
      expect(tabEvents()).toHaveLength(0);
    });

    it('does not record the deep-link auto-selection as a tab view', () => {
      renderSettingsOn('ai', { openAiProvider: true });
      expect(tabEvents()).toHaveLength(0);
    });
  });

  it('names the hwaccel mode and encoder type selects', () => {
    renderSettingsOn('advanced');
    expect(screen.getByRole('combobox', { name: 'settings.hwaccelMode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'settings.encoderType' })).toBeInTheDocument();
  });

  const hwaccelSwitch = () => screen.getByRole('switch', { name: 'settings.hardwareAcceleration' });
  const alwaysOnTopSwitch = () => screen.getByRole('switch', { name: 'settings.alwaysOnTop' });
  const launchAtLoginSwitch = () => screen.getByRole('switch', { name: 'settings.launchAtLogin' });
  const desktopNotificationsSwitch = () => screen.getByRole('switch', { name: 'settings.desktopNotifications' });

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

  it('lists a dark variant for every accent theme', () => {
    renderSettings();
    for (const id of ['ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate']) {
      expect(screen.getByRole('button', { name: `settings.themes.${id}Dark` })).toBeInTheDocument();
    }
  });

  it('switches to an accent dark variant and persists it', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'settings.themes.oceanDark' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('ocean-dark');
    expect(screen.getByRole('button', { name: 'settings.themes.oceanDark' })).toHaveAttribute('aria-pressed', 'true');
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
    renderSettingsOn('advanced');
    expect(screen.getByText('settings.hardwareAcceleration')).toBeInTheDocument();
    expect(screen.getByText('settings.hwaccelMode')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('hides the mode dropdown when hardware acceleration is disabled', () => {
    renderSettingsOn('advanced');
    fireEvent.click(hwaccelSwitch());
    expect(screen.queryByText('settings.hwaccelMode')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false);
  });

  it('updates the hwaccel mode when a mode is selected', () => {
    renderSettingsOn('advanced');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.hwaccelModeEncode' }));
    expect(useSettingsStore.getState().hwaccelMode).toBe('encode');
  });

  it('renders the encoder type dropdown when hardware acceleration is enabled', () => {
    renderSettingsOn('advanced');
    expect(screen.getByText('settings.encoderType')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('hides the encoder type dropdown when hardware acceleration is disabled', () => {
    renderSettingsOn('advanced');
    fireEvent.click(hwaccelSwitch());
    expect(screen.queryByText('settings.encoderType')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('updates the encoder type when an option is selected', () => {
    renderSettingsOn('advanced');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.encoderTypeHardware' }));
    expect(useSettingsStore.getState().encoderType).toBe('hardware');
  });

  it('shows info tooltips on the hardware acceleration settings', async () => {
    renderSettingsOn('advanced');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.hardwareAccelerationHint' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hardwareAccelerationHint');
  });

  it('shows an info tooltip for the mode setting', async () => {
    renderSettingsOn('advanced');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.hwaccelModeHint' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.hwaccelModeHint');
  });

  it('shows an info tooltip for the encoder type setting', async () => {
    renderSettingsOn('advanced');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.encoderTypeHint' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.encoderTypeHint');
  });

  it('keeps the hardware acceleration tooltip when disabled but hides the others', () => {
    renderSettingsOn('advanced');
    const advancedPanel = screen.getByTestId('settings-tabpanel-advanced');
    expect(within(advancedPanel).getAllByTestId('info-tooltip')).toHaveLength(4);
    fireEvent.click(hwaccelSwitch());
    expect(within(advancedPanel).getAllByTestId('info-tooltip')).toHaveLength(2);
  });

  it('renders the error-reporting row and toggles consent via the main process', async () => {
    const spy = vi.fn().mockResolvedValue({ enabled: false, backend: 'noop' });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, monitoringSetEnabled: spy },
      writable: true,
    });
    renderSettingsOn('advanced');
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
    renderSettingsOn('ai');
    expect(screen.getByText('settings.mcpServer')).toBeInTheDocument();
    expect(mcpSwitch()).not.toBeChecked();
    expect(screen.queryByTestId('settings-mcp-port')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-token')).not.toBeInTheDocument();
  });

  it('leaves the MCP server off on a first load, before the user opts in', async () => {
    // A fresh install has no `mcp-settings.json`, so the main process reports
    // the disabled default and the switch must render off.
    vi.mocked(window.electronAPI.mcpGetSettings).mockResolvedValue({ enabled: false, port: 8765, token: '' });
    useSettingsStore.setState({ mcpEnabled: false, mcpPort: 8765, mcpToken: '' });
    renderSettingsOn('ai');
    await waitFor(() => expect(mcpSwitch()).not.toBeChecked());
    expect(screen.queryByTestId('settings-mcp-port')).not.toBeInTheDocument();
  });

  it('hides the AI use-case link until the MCP server is enabled', () => {
    renderSettingsOn('ai');
    expect(screen.queryByTestId('settings-mcp-ai-use-cases-link')).not.toBeInTheDocument();
  });

  it('reveals the AI use-case documentation link when the MCP server is enabled', async () => {
    renderSettingsOn('ai');
    fireEvent.click(mcpSwitch());
    const link = await screen.findByTestId('settings-mcp-ai-use-cases-link');
    expect(link).toHaveAttribute('href', 'https://encodex.in/features#let-an-ai-assistant-drive');
    expect(link).toHaveTextContent('settings.mcpAiUseCases');
  });

  it('shows an info tooltip for the MCP server setting', async () => {
    renderSettingsOn('ai');
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.mcpServerHint' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.mcpServerHint');
  });

  it('reveals the MCP port and generate action but no token field when enabled', async () => {
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
    fireEvent.click(mcpSwitch());
    fireEvent.click(await screen.findByTestId('settings-mcp-generate-token'));
    await waitFor(() => expect(mcpTokenInput().value).toHaveLength(43));
    fireEvent.change(mcpTokenInput(), { target: { value: 'secret' } });
    fireEvent.blur(mcpTokenInput());
    expect(spy).toHaveBeenCalledWith({ enabled: true, port: 8765, token: 'secret' });
    await waitFor(() => expect(useSettingsStore.getState().mcpToken).toBe('secret'));
  });

  it('hides the MCP connection details when the server is disabled', () => {
    renderSettingsOn('ai');
    expect(screen.queryByTestId('settings-mcp-endpoint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mcp-authorization')).not.toBeInTheDocument();
  });

  it('reveals the MCP endpoint URL when the server is enabled', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' }) },
      writable: true,
    });
    renderSettingsOn('ai');
    fireEvent.click(mcpSwitch());
    const endpoint = await screen.findByRole('textbox', { name: 'settings.mcpEndpoint' });
    expect(endpoint).toHaveValue('http://127.0.0.1:8765/mcp');
  });

  it('does not show the Authorization row until a token is configured', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: '' }) },
      writable: true,
    });
    renderSettingsOn('ai');
    fireEvent.click(mcpSwitch());
    await screen.findByTestId('settings-mcp-endpoint');
    expect(screen.queryByTestId('settings-mcp-authorization')).not.toBeInTheDocument();
  });

  it('shows the Authorization header row when a token is configured', async () => {
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, mcpSetSettings: vi.fn().mockResolvedValue({ enabled: true, port: 8765, token: 'secret' }) },
      writable: true,
    });
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
    fireEvent.click(mcpSwitch());
    await screen.findByTestId('settings-mcp-endpoint');
    fireEvent.click(screen.getByTestId('settings-mcp-copy-endpoint'));
    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:8765/mcp');
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'settings.mcpCopied')).toBe(true),
    );
  });

  it('toggles token visibility when the reveal button is clicked', async () => {
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.alwaysOnTopHint' }));
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

  it('toggles desktop notifications and notifies the main process', () => {
    const spy = vi.fn().mockResolvedValue({ enabled: true, supported: true });
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, notificationsSetEnabled: spy },
      writable: true,
    });
    renderSettings();
    expect(desktopNotificationsSwitch()).toBeInTheDocument();
    fireEvent.click(desktopNotificationsSwitch());
    expect(useSettingsStore.getState().desktopNotificationsEnabled).toBe(true);
    expect(spy).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(DESKTOP_NOTIFICATIONS_STORAGE_KEY)).toBe('true');
  });

  it('shows an info tooltip for the launch-at-startup setting', async () => {
    renderSettings();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'settings.launchAtLoginHint' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('settings.launchAtLoginHint');
  });

  it('keeps the AI provider editor collapsed until the toggle is clicked', async () => {
    renderSettingsOn('ai');
    expect(screen.getByText('settings.ai.title')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai')).not.toBeInTheDocument();
    // The stored settings are restored in the background, but the editor
    // itself stays collapsed until the user asks for it.
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalled());
    expect(screen.queryByTestId('settings-ai')).not.toBeInTheDocument();
  });

  it('opens the AI provider editor and scrolls it into view when the page is asked to', async () => {
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });

    try {
      renderSettingsOn('ai', { openAiProvider: true });
      expect(screen.getByRole('tab', { name: 'settings.tabs.ai' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('settings-tabpanel-ai')).toBeVisible();
      expect(await screen.findByTestId('settings-ai')).toBeInTheDocument();
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('keeps the offline defaults when the loaded settings are malformed', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({} as never);
    renderSettingsOn('ai');
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'true');
  });

  it('retries the background load after a rejected bridge call', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockRejectedValueOnce(new Error('bridge unavailable')).mockResolvedValueOnce({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettingsOn('ai');
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('settings-ai-provider-openai')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a provider button for every AI provider', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    for (const id of ['rules', 'openai', 'anthropic', 'gemini', 'local']) {
      expect(screen.getByTestId(`settings-ai-provider-${id}`)).toBeInTheDocument();
    }
  });

  it('renders each provider as a horizontal icon | separator | name button', async () => {
    renderSettingsOn('ai');
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

  it('offers connect but hides advanced and key fields for the built-in rules provider', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.getByTestId('settings-ai-connect')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-advanced')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-rules-note')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-base-url')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'openai', activate: false }));
    expect(screen.getByTestId('settings-ai-connect')).toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-advanced')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-rules-note')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-provider-rules'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'rules' }));
    expect(screen.getByTestId('settings-ai-connect')).toBeInTheDocument();
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
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-rules'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'rules' }));
    expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads the stored AI settings and restores the selected provider', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    expect(await screen.findByTestId('settings-ai')).toBeInTheDocument();
    await waitFor(() => expect(window.electronAPI.aiGetSettings).toHaveBeenCalledTimes(1));
    // The provider the user selected last is auto-selected when the app loads.
    await waitFor(() => expect(screen.getByTestId('settings-ai-provider-openai')).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: 'settings.ai.model' })).toHaveValue('gpt-4o');
  });

  it('restores the persisted provider selection when the page loads', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'rules',
      selectedProviderId: 'anthropic',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await waitFor(() => expect(screen.getByTestId('settings-ai-provider-anthropic')).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'false');
  });

  it('auto-selects the provider the app already knows at startup', async () => {
    // The app hydrates the connection mirror at startup, so the selection is
    // restored without a round-trip.
    useAiConnectionStore.getState().patch({
      providerId: 'openai',
      selectedProviderId: 'anthropic',
      model: 'gpt-4o',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await waitFor(() => expect(screen.getByTestId('settings-ai-provider-anthropic')).toHaveAttribute('aria-pressed', 'true'));
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
  });

  it('persists the provider selection without activating it for the Copilot', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-gemini'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'gemini', activate: false }));
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
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-anthropic'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'anthropic' })));
    await waitFor(() => expect(screen.getByTestId('settings-ai-status')).toHaveTextContent('Connected (42 ms)'));
  });

  it('deep-links to the provider key page for remote providers', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'openai', activate: false }));
    const link = screen.getByTestId('settings-ai-get-key');
    expect(link).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('pastes the clipboard into the API key field', async () => {
    const readText = vi.fn().mockResolvedValue('sk-clip');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-paste'));
    await waitFor(() => expect(screen.getByLabelText('settings.ai.apiKey')).toHaveValue('sk-clip'));
  });

  it('edits the AI model and API key fields', async () => {
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.change(screen.getByLabelText('settings.ai.apiKey'), { target: { value: 'sk-test' } });
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    await user.click(model);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('gpt-6-astra')).toBeInTheDocument();
    await user.click(within(listbox).getByText('gpt-6-astra'));
    expect(model).toHaveValue('gpt-6-astra');
  });

  it('disables remote providers while offline and shows the network tooltip', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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

  it('disables model suggestions until an API key is available', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    expect(model).toBeDisabled();
    expect(screen.getByText('settings.ai.modelNoKeyHelp')).toBeInTheDocument();
    expect(window.electronAPI.aiListModels).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('settings.ai.apiKey'), { target: { value: 'sk-test' } });
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    expect(model).toBeEnabled();
  });

  it('keeps the model field usable when the provider list fetch fails', async () => {
    vi.mocked(window.electronAPI.aiListModels).mockRejectedValue(new Error('offline'));
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.change(screen.getByLabelText('settings.ai.apiKey'), { target: { value: 'sk-test' } });
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    expect(model).toBeEnabled();
    fireEvent.change(model, { target: { value: 'my-own-model' } });
    expect(model).toHaveValue('my-own-model');
  });

  it('ignores a malformed model-list result', async () => {
    vi.mocked(window.electronAPI.aiListModels).mockResolvedValue({ ok: true } as never);
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.change(screen.getByLabelText('settings.ai.apiKey'), { target: { value: 'sk-test' } });
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
    renderSettingsOn('ai');
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
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.example.com/v1',
        hasKey: true,
        keyHint: '••••',
        storedInsecurely: false,
        encryptionAvailable: true,
        connected: true,
        connectedAt: 2,
        connectedModel: 'gpt-4o-mini',
      },
    });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    fireEvent.change(screen.getByLabelText('settings.ai.model'), { target: { value: 'stale-model' } });
    fireEvent.change(screen.getByLabelText('settings.ai.baseUrl'), { target: { value: 'https://stale.example.com/v1' } });
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-connected')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('settings.ai.model')).toHaveValue('gpt-4o-mini'));
    await waitFor(() => expect(screen.getByLabelText('settings.ai.baseUrl')).toHaveValue('https://api.example.com/v1'));
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

  it('shows the local runtime glyph in the connection badge', async () => {
    const connectedLocalView = {
      providerId: 'local' as const,
      model: 'llama3.2',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: true,
      connectedAt: 2,
      connectedModel: 'llama3.2',
    };
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue(connectedLocalView);
    useAiConnectionStore.getState().patch(connectedLocalView);
    renderSettingsOn('ai');
    const status = await screen.findByTestId('settings-ai-header-status');
    expect(status.querySelector('[data-icon="server"]')).not.toBeNull();
    expect(status.querySelector('[data-icon="robot"]')).toBeNull();
  });

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
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(screen.getByLabelText('settings.ai.apiKey')).toHaveAttribute('placeholder', 'settings.ai.keySavedPlaceholder');
    fireEvent.click(screen.getByTestId('settings-ai-remove-key'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'openai', clearKey: true }));
    await waitFor(() => expect(screen.queryByTestId('settings-ai-remove-key')).not.toBeInTheDocument());
  });

  it('resets every AI provider to the first-load defaults after confirmation', async () => {
    vi.mocked(window.electronAPI.aiGetSettings).mockResolvedValue({
      providerId: 'openai',
      model: 'gpt-4o',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: true,
      connectedAt: 5,
      connectedModel: 'gpt-4o',
      activeConnection: { providerId: 'openai', model: 'gpt-4o', at: 5 },
      selectedProviderId: 'openai',
    });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await waitFor(() => expect(screen.getByTestId('settings-ai-provider-openai')).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByTestId('settings-ai-reset'));
    expect(await screen.findByText('settings.ai.resetConfirmMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-reset-confirm'));

    await waitFor(() => expect(window.electronAPI.aiResetSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('settings-ai-provider-rules')).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByTestId('settings-ai-status')).toHaveTextContent('settings.ai.resetComplete');
    expect(screen.queryByTestId('settings-ai-connected-dot-openai')).not.toBeInTheDocument();
    expect(window.electronAPI.aiSetSettings).not.toHaveBeenCalled();
  });

  it('reports an invalid response from the AI reset bridge', async () => {
    vi.mocked(window.electronAPI.aiResetSettings).mockResolvedValue({} as never);
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');

    fireEvent.click(screen.getByTestId('settings-ai-reset'));
    expect(await screen.findByText('settings.ai.resetConfirmMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-reset-confirm'));

    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.saveFailed');
    await waitFor(() => expect(screen.queryByText('settings.ai.resetConfirmMessage')).not.toBeInTheDocument());
  });

  it('reports a rejected AI reset bridge call', async () => {
    vi.mocked(window.electronAPI.aiResetSettings).mockRejectedValue(new Error('reset boom'));
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');

    fireEvent.click(screen.getByTestId('settings-ai-reset'));
    expect(await screen.findByText('settings.ai.resetConfirmMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-reset-confirm'));

    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('settings.ai.resetConfirmMessage')).not.toBeInTheDocument());
  });

  it('closes the AI reset dialog from the escape key', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-reset'));
    expect(await screen.findByText('settings.ai.resetConfirmMessage')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByText('settings.ai.resetConfirmMessage')).not.toBeInTheDocument());
    expect(window.electronAPI.aiResetSettings).not.toHaveBeenCalled();
  });

  it('does not reset providers when the reset dialog is cancelled', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-reset'));
    expect(await screen.findByText('settings.ai.resetConfirmMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-reset-cancel'));
    expect(window.electronAPI.aiResetSettings).not.toHaveBeenCalled();
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
    renderSettingsOn('ai');
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

    // Switching persists the selection, but it never activates the provider:
    // the Copilot keeps planning with the provider it was configured for.
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'gemini', activate: false }));
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
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await screen.findByTestId('settings-ai-connected-dot-openai');

    // Selecting a different provider must not hide the one connection.
    fireEvent.click(screen.getByTestId('settings-ai-provider-anthropic'));
    await waitFor(() => expect(screen.getByTestId('settings-ai-connected-dot-openai')).toBeInTheDocument());
    expect(screen.queryByTestId('settings-ai-connected-dot-anthropic')).not.toBeInTheDocument();
    // And it must not claim the freshly selected provider is connected.
    expect(screen.queryByTestId('settings-ai-connected')).not.toBeInTheDocument();
    // The selection is remembered, but it does not take the connection over.
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'anthropic', activate: false }));
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    renderSettingsOn('ai');
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
    const first = renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    await screen.findByTestId('settings-ai-connected');
    first.unmount();
    vi.mocked(window.electronAPI.aiGetSettings).mockClear();
    renderSettingsOn('ai');
    expect(screen.getByTestId('settings-ai-header-status')).toHaveTextContent('settings.ai.headerConnected');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    expect(window.electronAPI.aiGetSettings).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-ai-connected')).toBeInTheDocument();
  });

  it('shows the endpoint for local and the model under Advanced', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-local'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'local', activate: false }));
    expect(screen.getByTestId('settings-ai-base-url')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    expect(screen.getByTestId('settings-ai-model')).toBeInTheDocument();
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalled());
  });

  it('edits the local provider base URL', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-local'));
    await waitFor(() => expect(window.electronAPI.aiSetSettings).toHaveBeenCalledWith({ providerId: 'local', activate: false }));
    const base = screen.getByRole('textbox', { name: 'settings.ai.baseUrl' }) as HTMLInputElement;
    fireEvent.change(base, { target: { value: 'http://127.0.0.1:11434/v1' } });
    expect(base).toHaveValue('http://127.0.0.1:11434/v1');
  });

  it('loads local model suggestions without an API key', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI.aiListModels).mockResolvedValue({ ok: true, models: ['llama3'] });
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-local'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(window.electronAPI.aiListModels).toHaveBeenCalledWith({ providerId: 'local' }));
    const model = screen.getByRole('combobox', { name: 'settings.ai.model' });
    await user.click(model);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('llama3')).toBeInTheDocument();
  });

  it('edits the OpenAI base URL from the advanced panel', async () => {
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-advanced'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'settings.ai.baseUrl' })).toBeInTheDocument());
    const base = screen.getByRole('textbox', { name: 'settings.ai.baseUrl' }) as HTMLInputElement;
    await waitFor(() => expect(base).toBeEnabled());
    fireEvent.change(base, { target: { value: 'https://proxy.example/v1' } });
    await waitFor(() => expect(base).toHaveValue('https://proxy.example/v1'));
  });

  it('shows a save error when the bridge returns an unusable view', async () => {
    vi.mocked(window.electronAPI.aiSetSettings).mockResolvedValue({} as never);
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.saveFailed');
  });

  it('surfaces a save rejection as an error', async () => {
    vi.mocked(window.electronAPI.aiSetSettings).mockRejectedValue(new Error('boom'));
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
  });

  it('reports a failed connection test without a reason as a generic error', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: false } as never);
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.testFailed');
  });

  it('shows a localized message for a classified connection failure', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockResolvedValue({ ok: false, message: 'x', reason: 'invalidKey', status: 401 } as never);
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toHaveTextContent('settings.ai.errors.invalidKey');
  });

  it('surfaces a connection-test rejection as an error', async () => {
    vi.mocked(window.electronAPI.aiConnectTest).mockRejectedValue(new Error('boom'));
    renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    fireEvent.click(screen.getByTestId('settings-ai-provider-openai'));
    fireEvent.click(screen.getByTestId('settings-ai-connect'));
    expect(await screen.findByTestId('settings-ai-error')).toBeInTheDocument();
  });

  it('has no axe violations with the AI editor expanded', async () => {
    const { container } = renderSettingsOn('ai');
    fireEvent.click(screen.getByTestId('settings-ai-toggle'));
    await screen.findByTestId('settings-ai');
    await assertNoAxeViolations(container);
  });
});
