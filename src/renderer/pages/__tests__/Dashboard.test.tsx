import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { resetFeatureFlagsForTests } from '../../hooks/useFeatureFlags';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';

beforeEach(() => {
  localStorage.clear();
  useDashboardLayoutStore.getState().resetLayout();
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

  it('renders icon-only view and edit actions', async () => {
    await renderDashboard();
    expect(screen.getByTestId('dashboard-actions-row')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-view-toggle-button')).toHaveTextContent('');
    expect(screen.queryByTestId('dashboard-view-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-links-view-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-edit-button')).toHaveTextContent('');
  });

  it('toggles the Quick Links panel in place while keeping the dashboard chrome', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-view-toggle-button'));
    expect(screen.getByTestId('quick-links-panel')).toBeInTheDocument();
    expect(screen.getByText('dashboard.welcome 👋')).toBeInTheDocument();
    expect(screen.queryByText('nav.convert')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByTestId('dashboard-edit-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-view-toggle-button'));
    expect(screen.queryByTestId('quick-links-panel')).not.toBeInTheDocument();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
  });

  it('reveals drag handles and group controls only after Edit is clicked', async () => {
    await renderDashboard();
    expect(screen.queryByTestId('dashboard-drag-handle-/convert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    expect(screen.getByTestId('dashboard-edit-button')).toHaveAttribute('aria-label', 'dashboard.edit.done');
    expect(screen.getByTestId('dashboard-group-bar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-group-favourites').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('dashboard-drag-handle-/convert')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-group-button-/convert')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    expect(screen.queryByTestId('dashboard-drag-handle-/convert')).not.toBeInTheDocument();
  });

  it('shows a dismissible edit hint alert in edit mode', async () => {
    await renderDashboard();
    expect(screen.queryByTestId('dashboard-edit-hint')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    const hint = screen.getByTestId('dashboard-edit-hint');
    expect(hint).toHaveAttribute('role', 'alert');
    expect(hint).toHaveTextContent('dashboard.edit.hint');
    fireEvent.click(within(hint).getByRole('button', { name: 'gettingStarted.dismiss' }));
    expect(screen.queryByTestId('dashboard-edit-hint')).not.toBeInTheDocument();
  });

  it('assigns a card to Favourites from its group menu', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-group-button-/convert'));
    fireEvent.click(screen.getByTestId('dashboard-assign-favourites'));
    expect(useDashboardLayoutStore.getState().assignments['/convert']).toBe('favourites');
    expect(screen.getByTestId('dashboard-section-favourites')).toHaveTextContent('nav.convert');
    expect(screen.getByTestId('dashboard-section-favourites').querySelector('svg')).not.toBeNull();
  });

  it('creates a custom group from a card menu and assigns that card', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-group-button-/convert'));
    fireEvent.click(screen.getByTestId('dashboard-assign-new-group'));
    expect(screen.getByTestId('dashboard-group-name-label')).toHaveTextContent('dashboard.edit.groupName');
    expect(screen.getByTestId('dashboard-group-name-input')).toHaveAttribute('id', 'dashboard-group-name');
    expect(screen.getByTestId('dashboard-save-group')).toBeDisabled();
    fireEvent.change(screen.getByTestId('dashboard-group-name-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('dashboard-save-group')).toBeDisabled();
    fireEvent.change(screen.getByTestId('dashboard-group-name-input'), { target: { value: 'My tools' } });
    expect(screen.getByTestId('dashboard-save-group')).toBeEnabled();
    fireEvent.click(screen.getByTestId('dashboard-save-group'));
    const { customGroups, assignments } = useDashboardLayoutStore.getState();
    expect(customGroups).toHaveLength(1);
    expect(customGroups[0].name).toBe('My tools');
    expect(assignments['/convert']).toBe(customGroups[0].id);
    expect(screen.getByTestId(`dashboard-section-${customGroups[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`dashboard-section-${customGroups[0].id}`).querySelector('svg')).not.toBeNull();
  });

  it('keeps saved groups visible after leaving edit mode', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-group-button-/convert'));
    fireEvent.click(screen.getByTestId('dashboard-assign-favourites'));
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));

    expect(screen.getByTestId('dashboard-section-favourites')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-section-favourites')).toHaveTextContent('dashboard.groups.favourites');
    expect(screen.queryByTestId('dashboard-group-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-drag-handle-/convert')).not.toBeInTheDocument();
  });

  it('resets the layout from the edit group bar', async () => {
    useDashboardLayoutStore.getState().assignGroup('/convert', 'favourites');
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-reset-layout-button'));
    expect(useDashboardLayoutStore.getState().assignments['/convert']).toBeUndefined();
    expect(screen.queryByTestId('dashboard-section-favourites')).not.toBeInTheDocument();
  });
});
