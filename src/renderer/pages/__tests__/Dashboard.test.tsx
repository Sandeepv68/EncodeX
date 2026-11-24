import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { resetFeatureFlagsForTests } from '../../hooks/useFeatureFlags';

beforeEach(() => {
  resetFeatureFlagsForTests();
  vi.mocked(window.electronAPI.analyticsGetState).mockResolvedValue({
    enabled: true,
    backend: 'noop',
    featureFlags: { automations_page: true },
  });
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

async function renderDashboard() {
  const result = render(
    <MemoryRouter initialEntries={['/']}>
      <Dashboard />
      <LocationProbe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(window.electronAPI.analyticsGetState).toHaveBeenCalled());
  return result;
}

describe('Dashboard', () => {
  it('renders the welcome title and subtitle', async () => {
    await renderDashboard();
    expect(screen.getByText('dashboard.welcome 👋')).toBeInTheDocument();
    expect(screen.getByText('dashboard.subtitle')).toBeInTheDocument();
  });

  it('renders a feature card for every nav route except home, logs, settings, and about', async () => {
    await renderDashboard();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.mediaInfo')).toBeInTheDocument();
    expect(screen.getByText('nav.image')).toBeInTheDocument();
    expect(screen.getByText('nav.audio')).toBeInTheDocument();
    expect(screen.getByText('nav.cut')).toBeInTheDocument();
    expect(screen.getByText('nav.remux')).toBeInTheDocument();
    expect(screen.getByText('nav.demux')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.getByText('nav.automations')).toBeInTheDocument();
    expect(screen.queryByText('nav.logs')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.settings')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.about')).not.toBeInTheDocument();
  });

  it('navigates to the feature page when a card is clicked', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText('nav.convert'));
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
  });

  it('navigates to the batch queue page when its card is clicked', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText('nav.batchQueue'));
    expect(screen.getByTestId('location')).toHaveTextContent('/batch');
  });

  it('navigates to the demux page when its card is clicked', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText('nav.demux'));
    expect(screen.getByTestId('location')).toHaveTextContent('/demux');
  });

  it('renders the description text for each card', async () => {
    await renderDashboard();
    expect(screen.getByText('dashboard.descConvert')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descRemux')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descDemux')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descBatch')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descAutomations')).toBeInTheDocument();
  });

  it('navigates to the convert page when 1 is pressed', async () => {
    await renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
  });

  it('navigates to the audio extract page when 4 is pressed', async () => {
    await renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit4', key: '4' });
    expect(screen.getByTestId('location')).toHaveTextContent('/audio-extract');
  });

  it('navigates to the remux page when 6 is pressed', async () => {
    await renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit6', key: '6' });
    expect(screen.getByTestId('location')).toHaveTextContent('/remux');
  });

  it('navigates to the demux page when 7 is pressed', async () => {
    await renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit7', key: '7' });
    expect(screen.getByTestId('location')).toHaveTextContent('/demux');
  });

  it('navigates to the batch queue page when 8 is pressed', async () => {
    await renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit8', key: '8' });
    expect(screen.getByTestId('location')).toHaveTextContent('/batch');
  });

  it('renders the keyboard-shortcuts footer hint', async () => {
    await renderDashboard();
    expect(screen.getByTestId('dashboard-shortcuts-hint')).toHaveTextContent('dashboard.shortcutsFooter');
  });

  it('hides the automations card when the feature flag is disabled', async () => {
    vi.mocked(window.electronAPI.analyticsGetState).mockResolvedValue({
      enabled: true,
      backend: 'noop',
      featureFlags: { automations_page: false },
    });
    resetFeatureFlagsForTests();

    await renderDashboard();

    await waitFor(() => expect(screen.getByText('dashboard.welcome 👋')).toBeInTheDocument());
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.queryByText('nav.automations')).not.toBeInTheDocument();
  });
});
