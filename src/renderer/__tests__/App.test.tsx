import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useErrorStore } from '../stores/errorStore';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
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
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useLogStore.setState({ entries: [] });
    useToastStore.setState({ toasts: [] });
    useAudioExtractStore.setState({ isConverting: false });
  });

  it('renders the dashboard on the initial route', async () => {
    renderApp();
    expect(screen.queryByText('app.name')).not.toBeInTheDocument();
    expect(await screen.findByText('dashboard.welcome')).toBeInTheDocument();
  });

  it('renders the footer with the app name and version', async () => {
    renderApp();
    expect(await screen.findByText('dashboard.welcome')).toBeInTheDocument();
    expect(screen.getByText(/footer.version/)).toBeInTheDocument();
    expect(screen.getByText('footer.poweredBy')).toBeInTheDocument();
  });

  it('navigates to the convert page via the drawer', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome');
    const drawerItem = screen.getAllByText('nav.convert')[0].closest('[role="button"]')!;
    fireEvent.click(drawerItem);
    expect(await screen.findByText('convert.title', {}, { timeout: 5000 })).toBeInTheDocument();
  }, 20000);

  it('stores log messages received from the main process', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome');
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
    await screen.findByText('dashboard.welcome');
    expect(screen.getByText('Conversion exploded')).toBeInTheDocument();
    expect(screen.getByText('encoder crashed')).toBeInTheDocument();
  });

  it('renders the mobile menu button and opens the drawer on mobile', async () => {
    vi.stubGlobal('matchMedia', createMatchMedia(true));
    renderApp();
    await screen.findByText('dashboard.welcome');
    const menuButton = document.querySelector('[data-icon="bars"]')!.closest('button')!;
    fireEvent.click(menuButton);
    fireEvent.click(screen.getAllByText('nav.convert')[0]);
    expect(await screen.findByText('convert.title')).toBeInTheDocument();
  });

  it('shows a red blip on the audio-extract nav item while an extraction is running', async () => {
    useAudioExtractStore.setState({ isConverting: true });
    renderApp();
    await screen.findByText('dashboard.welcome');
    expect(screen.getByTestId('nav-audio-extract-blip')).toBeInTheDocument();
  });

  it('hides the audio-extract blip when no extraction is running', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome');
    expect(screen.queryByTestId('nav-audio-extract-blip')).not.toBeInTheDocument();
  });
});
