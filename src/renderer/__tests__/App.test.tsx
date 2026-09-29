import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useErrorStore } from '../stores/errorStore';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { useTermsStore } from '../stores/termsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DRAWER_CONDENSED_STORAGE_KEY, DEFAULT_DRAWER_CONDENSED } from '../../shared/constants';
import type { LogEntry } from '../../shared/types';

const onLogMessageMock = vi.mocked(window.electronAPI.onLogMessage);

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

function createMatchMedia(matches: boolean) {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    useSettingsStore.setState({ drawerCondensed: DEFAULT_DRAWER_CONDENSED });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useLogStore.setState({ entries: [] });
    useToastStore.setState({ toasts: [] });
    useAudioExtractStore.setState({ isConverting: false });
    useVideoCutStore.getState().setIsCutting(false);
    useTermsStore.setState({ requiresAcceptance: false, dialogOpen: false });
  });

  it('renders the dashboard on the initial route', async () => {
    renderApp();
    expect(screen.queryByText('app.name')).not.toBeInTheDocument();
    expect(await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it('renders the footer with the app name and version', async () => {
    renderApp();
    expect(await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText(/footer.version/)).toBeInTheDocument();
    expect(screen.getByText('footer.poweredBy')).toBeInTheDocument();
  });

  it('navigates to the convert page via the drawer', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    fireEvent.click(screen.getByTestId('nav-item-convert'));
    expect(await screen.findByText('convert.title', {}, { timeout: 10000 })).toBeInTheDocument();
  }, 20000);

  it('opens the permanent drawer condensed with icon-only nav rows', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    const drawerItem = screen.getByTestId('nav-item-convert');
    expect(within(drawerItem).queryByText('nav.convert')).not.toBeInTheDocument();
    fireEvent.mouseOver(drawerItem);
    expect((await screen.findByRole('tooltip')).textContent).toBe('nav.convert');
  });

  it('persists the drawer layout when the user expands the drawer', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

    fireEvent.click(screen.getByTestId('drawer-condense-button'));
    expect(useSettingsStore.getState().drawerCondensed).toBe(false);
    expect(within(screen.getByTestId('nav-item-convert')).getByText('nav.convert')).toBeInTheDocument();
    expect(localStorage.getItem(DRAWER_CONDENSED_STORAGE_KEY)).toBe('false');

    fireEvent.click(screen.getByTestId('drawer-condense-button'));
    expect(useSettingsStore.getState().drawerCondensed).toBe(true);
    expect(within(screen.getByTestId('nav-item-convert')).queryByText('nav.convert')).not.toBeInTheDocument();
    expect(localStorage.getItem(DRAWER_CONDENSED_STORAGE_KEY)).toBe('true');
  });

  it('stores log messages received from the main process', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    const callback = onLogMessageMock.mock.calls[0][0];
    const entry: LogEntry = { timestamp: '2026-07-31T12:00:00.000Z', level: 'INFO', text: 'incoming log', source: 'main' };
    callback(entry);
    expect(useLogStore.getState().entries).toContainEqual(entry);
  });

  it('shows the error snackbar when the error store has an error', async () => {
    useErrorStore.setState({
      currentError: { code: 'CONVERSION_FAILED', message: 'Conversion exploded', detail: 'encoder crashed', timestamp: Date.now() },
    });
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    expect(screen.getByText('Conversion exploded')).toBeInTheDocument();
    expect(screen.getByText('encoder crashed')).toBeInTheDocument();
  });

  it('renders the mobile menu button and opens the drawer on mobile', async () => {
    vi.stubGlobal('matchMedia', createMatchMedia(true));
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    const menuButton = document.querySelector('[data-icon="bars"]')!.closest('button')!;
    fireEvent.click(menuButton);
    fireEvent.click(await screen.findByTestId('nav-item-convert', {}, { timeout: 10000 }));
    expect(await screen.findByText('convert.title', {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it('shows a red blip on the audio-extract nav item while an extraction is running', async () => {
    useAudioExtractStore.setState({ isConverting: true });
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    expect(screen.getByTestId('nav-audio-extract-blip')).toBeInTheDocument();
  });

  it('hides the audio-extract blip when no extraction is running', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    expect(screen.queryByTestId('nav-audio-extract-blip')).not.toBeInTheDocument();
  });

  it('shows a red blip on the video-cut nav item while a cut is running', async () => {
    useVideoCutStore.getState().setIsCutting(true);
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    expect(screen.getByTestId('nav-video-cut-blip')).toBeInTheDocument();
  });

  it('hides the video-cut blip when no cut is running', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });
    expect(screen.queryByTestId('nav-video-cut-blip')).not.toBeInTheDocument();
  });
});
