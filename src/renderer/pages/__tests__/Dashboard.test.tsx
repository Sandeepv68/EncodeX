import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { resetFeatureFlagsForTests } from '../../hooks/useFeatureFlags';
import { useDashboardLayoutStore } from '../../stores/dashboardLayoutStore';
import { MAX_CUSTOM_GROUPS } from '../../constants/dashboard';

const { dndHandlers, dndState } = vi.hoisted(() => ({
  dndHandlers: {
    onDragStart: null as ((event: { active: { id: string } }) => void) | null,
    onDragEnd: null as ((event: { active: { id: string }; over: { id: string } | null }) => void) | null,
    onDragCancel: null as (() => void) | null,
  },
  dndState: {
    active: null as { id: string } | null,
    over: null as { id: string; rect: { top: number; left: number; width: number; height: number } } | null,
  },
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragEnd,
      onDragCancel,
    }: {
      children: ReactNode;
      onDragStart?: (event: never) => void;
      onDragEnd?: (event: never) => void;
      onDragCancel?: () => void;
    }) => {
      dndHandlers.onDragStart = onDragStart as typeof dndHandlers.onDragStart;
      dndHandlers.onDragEnd = onDragEnd as typeof dndHandlers.onDragEnd;
      dndHandlers.onDragCancel = onDragCancel ?? null;
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
    useDndContext: () => dndState,
  };
});

beforeEach(() => {
  localStorage.clear();
  useDashboardLayoutStore.getState().resetLayout();
  resetFeatureFlagsForTests();
  dndHandlers.onDragStart = null;
  dndHandlers.onDragEnd = null;
  dndHandlers.onDragCancel = null;
  dndState.active = null;
  dndState.over = null;
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
    expect(screen.getByTestId('getting-started-card')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-view-toggle-button'));
    expect(screen.getByTestId('quick-links-panel')).toBeInTheDocument();
    expect(screen.getByText('dashboard.welcome 👋')).toBeInTheDocument();
    expect(screen.queryByText('nav.convert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByTestId('dashboard-edit-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-view-toggle-button'));
    expect(screen.queryByTestId('quick-links-panel')).not.toBeInTheDocument();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-card')).toBeInTheDocument();
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

  it('falls back to generic title and description keys for unknown routes', async () => {
    useDashboardLayoutStore.setState({ order: ['/mystery'] });
    await renderDashboard();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descBatch')).toBeInTheDocument();
  });

  it('shows the drag overlay and drop placeholder, then reorders cards', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    const before = [...useDashboardLayoutStore.getState().order];

    dndState.active = { id: '/convert' };
    dndState.over = { id: '/media-info', rect: { top: 1, left: 2, width: 3, height: 4 } };
    await act(async () => {
      dndHandlers.onDragStart!({ active: { id: '/convert' } });
    });
    expect(screen.getByTestId('dashboard-drop-placeholder')).toBeInTheDocument();
    expect(screen.getAllByText('nav.convert').length).toBeGreaterThan(1);

    dndState.active = null;
    dndState.over = null;
    await act(async () => {
      dndHandlers.onDragEnd!({ active: { id: '/convert' }, over: { id: '/media-info' } });
    });
    expect(useDashboardLayoutStore.getState().order).not.toEqual(before);
    expect(screen.queryByTestId('dashboard-drop-placeholder')).not.toBeInTheDocument();
  });

  it('ignores drag completion with no target or the same target and handles drag cancel', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    const before = [...useDashboardLayoutStore.getState().order];

    dndState.active = { id: '/convert' };
    dndState.over = { id: '/convert', rect: { top: 0, left: 0, width: 0, height: 0 } };
    await act(async () => {
      dndHandlers.onDragStart!({ active: { id: '/convert' } });
    });
    expect(screen.queryByTestId('dashboard-drop-placeholder')).not.toBeInTheDocument();

    await act(async () => {
      dndHandlers.onDragEnd!({ active: { id: '/convert' }, over: { id: '/convert' } });
    });
    await act(async () => {
      dndHandlers.onDragEnd!({ active: { id: '/convert' }, over: null });
    });
    expect(useDashboardLayoutStore.getState().order).toEqual(before);

    await act(async () => {
      dndHandlers.onDragStart!({ active: { id: '/convert' } });
    });
    await act(async () => {
      dndHandlers.onDragCancel!();
    });
    expect(screen.queryByTestId('dashboard-drop-placeholder')).not.toBeInTheDocument();
  });

  it('assigns cards to ungrouped and custom groups from the card menu', async () => {
    useDashboardLayoutStore.setState({ customGroups: [{ id: 'custom-1', name: 'Custom' }] });
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));

    fireEvent.click(screen.getByTestId('dashboard-group-button-/convert'));
    fireEvent.click(screen.getByTestId('dashboard-assign-ungrouped'));
    expect(useDashboardLayoutStore.getState().assignments['/convert']).toBeNull();

    fireEvent.click(screen.getByTestId('dashboard-group-button-/media-info'));
    fireEvent.click(screen.getByTestId('dashboard-assign-custom-1'));
    expect(useDashboardLayoutStore.getState().assignments['/media-info']).toBe('custom-1');
    expect(screen.getByTestId('dashboard-section-custom-1')).toHaveTextContent('nav.mediaInfo');
  });

  it('creates a group from the bar without assigning a card', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-new-group-button'));
    fireEvent.change(screen.getByTestId('dashboard-group-name-input'), { target: { value: 'Bar group' } });
    fireEvent.click(screen.getByTestId('dashboard-save-group'));
    expect(useDashboardLayoutStore.getState().customGroups.map((group) => group.name)).toEqual(['Bar group']);
    expect(Object.values(useDashboardLayoutStore.getState().assignments)).toHaveLength(0);
  });

  it('renames and deletes a custom group from the group menu', async () => {
    useDashboardLayoutStore.setState({
      customGroups: [{ id: 'custom-2', name: 'Old name' }],
      assignments: { '/convert': 'custom-2' },
    });
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));

    fireEvent.click(screen.getByTestId('dashboard-group-custom-2'));
    fireEvent.click(screen.getByTestId('dashboard-rename-group'));
    const input = screen.getByTestId('dashboard-group-name-input');
    expect(input).toHaveValue('Old name');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(useDashboardLayoutStore.getState().customGroups[0].name).toBe('Renamed');

    fireEvent.click(screen.getByTestId('dashboard-group-custom-2'));
    fireEvent.click(screen.getByTestId('dashboard-delete-group'));
    expect(screen.getByTestId('dashboard-confirm-delete-group')).toBeInTheDocument();
    const deleteDialog = screen.getByText('dashboard.edit.deleteGroupTitle').closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'dashboard.edit.cancel' }));
    expect(screen.queryByTestId('dashboard-confirm-delete-group')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-group-custom-2'));
    fireEvent.click(screen.getByTestId('dashboard-delete-group'));
    fireEvent.click(screen.getByTestId('dashboard-confirm-delete-group'));
    expect(useDashboardLayoutStore.getState().customGroups).toEqual([]);
    expect(useDashboardLayoutStore.getState().assignments['/convert']).toBeNull();
  });

  it('closes card menus and dialogs when Escape is pressed', async () => {
    useDashboardLayoutStore.setState({ customGroups: [{ id: 'custom-escape', name: 'Custom' }] });
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));

    fireEvent.click(screen.getByTestId('dashboard-group-button-/convert'));
    expect(screen.getByTestId('dashboard-card-group-menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('dashboard-card-group-menu'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('dashboard-card-group-menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-group-custom-escape'));
    expect(screen.getByTestId('dashboard-rename-group')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('dashboard-rename-group')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-new-group-button'));
    expect(screen.getByTestId('dashboard-group-name-input')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('dashboard-group-name-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-group-custom-escape'));
    fireEvent.click(screen.getByTestId('dashboard-rename-group'));
    expect(screen.getByTestId('dashboard-group-name-input')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('dashboard-group-name-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-group-custom-escape'));
    fireEvent.click(screen.getByTestId('dashboard-delete-group'));
    expect(screen.getByTestId('dashboard-confirm-delete-group')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('dashboard-confirm-delete-group')).not.toBeInTheDocument();
  });

  it('cancels the group dialog without creating a group', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-new-group-button'));
    fireEvent.change(screen.getByTestId('dashboard-group-name-input'), { target: { value: 'Discard me' } });
    const dialog = screen.getByText('dashboard.edit.newGroupTitle').closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'dashboard.edit.cancel' }));

    expect(screen.queryByTestId('dashboard-group-name-input')).not.toBeInTheDocument();
    expect(useDashboardLayoutStore.getState().customGroups).toEqual([]);
  });

  it('renders an empty group title when a saved custom group cannot be found', async () => {
    const customGroups = [{ id: 'custom-missing', name: 'Missing' }];
    Object.defineProperty(customGroups, 'find', { value: () => undefined });
    useDashboardLayoutStore.setState({ customGroups, assignments: { '/convert': 'custom-missing' } });

    await renderDashboard();

    const section = screen.getByTestId('dashboard-section-custom-missing');
    expect(section).toBeInTheDocument();
    expect(section).not.toHaveTextContent('Missing');
  });

  it('starts a rename with an empty draft when the custom group cannot be found', async () => {
    const customGroups = [{ id: 'custom-rename-missing', name: 'Missing' }];
    Object.defineProperty(customGroups, 'find', { value: () => undefined });
    useDashboardLayoutStore.setState({ customGroups });

    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-group-custom-rename-missing'));
    fireEvent.click(screen.getByTestId('dashboard-rename-group'));

    expect(screen.getByTestId('dashboard-group-name-input')).toHaveValue('');
  });

  it('ignores non-Enter keys and blank names in the group dialog', async () => {
    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-new-group-button'));
    const input = screen.getByTestId('dashboard-group-name-input');
    fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(input).toBeInTheDocument();
    expect(useDashboardLayoutStore.getState().customGroups).toEqual([]);
  });

  it('does not create a group once the custom group cap is reached', async () => {
    const customGroups = Array.from({ length: MAX_CUSTOM_GROUPS }, (_, index) => ({
      id: `custom-${index}`,
      name: `Group ${index}`,
    }));
    useDashboardLayoutStore.setState({ customGroups });

    await renderDashboard();
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    fireEvent.click(screen.getByTestId('dashboard-new-group-button'));
    fireEvent.change(screen.getByTestId('dashboard-group-name-input'), { target: { value: 'Another group' } });
    fireEvent.click(screen.getByTestId('dashboard-save-group'));

    expect(useDashboardLayoutStore.getState().customGroups).toHaveLength(MAX_CUSTOM_GROUPS);
  });
});
