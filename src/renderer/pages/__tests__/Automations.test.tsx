import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from '../../../test-utils/page-render';
import { useAutomationStore } from '../../stores/automationStore';
import { useToastStore } from '../../stores/toastStore';
import { createAutomationDefinition } from '../../../shared/automations/defaults';
import type { AutomationDefinition } from '../../../shared/automations/types';

const electronApi = window.electronAPI as unknown as Record<string, unknown>;
const originalMethods = { ...electronApi };

function definition(id: string, name: string): AutomationDefinition {
  return createAutomationDefinition(id, name, 1);
}

function bridge(): Record<string, unknown> {
  return window.electronAPI as unknown as Record<string, unknown>;
}

function hasToast(message: string): boolean {
  return useToastStore.getState().toasts.some((toast) => toast.message === message);
}

describe('Automations page', () => {
  beforeEach(() => {
    useAutomationStore.setState({
      definitions: [],
      activeDefinition: null,
      selectedNodeId: null,
      validationIssues: [],
      isDirty: false,
      isInitialized: false,
      runs: {},
    });
    useToastStore.setState({ toasts: [] });
    bridge().automationList = vi.fn().mockResolvedValue([]);
    bridge().automationGet = vi.fn().mockResolvedValue(null);
    bridge().automationSave = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationDelete = vi.fn().mockResolvedValue(false);
    bridge().automationDuplicate = vi.fn().mockResolvedValue(null);
    bridge().automationImport = vi.fn().mockResolvedValue(null);
    bridge().automationExport = vi.fn().mockResolvedValue(null);
  });

  afterEach(() => {
    const current = bridge();
    for (const key of Object.keys(current)) {
      if (!(key in originalMethods)) delete current[key];
    }
    Object.assign(current, originalMethods);
  });

  it('renders the editor shell and creates an empty definition', async () => {
    renderPage('Automations');
    expect(screen.getByRole('heading', { name: 'automations.title' })).toBeInTheDocument();
    expect(screen.getByLabelText('automations.paletteLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('automations.inspectorLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('automations.runPanelLabel')).toBeInTheDocument();
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
  });

  it('adds a node from the palette', async () => {
    renderPage('Automations');
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
    const input = screen.getAllByText('automations.node.input')[0];
    fireEvent.click(input);
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.graph.nodes).toHaveLength(1));
  });

  it('initializes the library from the bridge before creating a blank definition', async () => {
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha')]);
    renderPage('Automations');
    await waitFor(() => expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha']));
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
    expect(useAutomationStore.getState().activeDefinition?.id).not.toBe('a');
  });

  it('initializes once under React StrictMode', async () => {
    const list = vi.fn().mockResolvedValue([]);
    bridge().automationList = list;
    renderPage('Automations', { wrap: (children) => <StrictMode>{children}</StrictMode> });
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition).not.toBeNull());
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps an existing active definition when initializing', async () => {
    const active = definition('a', 'Alpha');
    useAutomationStore.setState({ activeDefinition: active });
    renderPage('Automations');
    await waitFor(() => expect(bridge().automationList).toHaveBeenCalled());
    expect(useAutomationStore.getState().activeDefinition?.id).toBe('a');
  });

  it('saves the active definition and clears the dirty flag', async () => {
    const persist = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationSave = persist;
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha'), isDirty: true });
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.save' }));
    await waitFor(() => expect(persist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' })));
    expect(useAutomationStore.getState().isDirty).toBe(false);
    expect(hasToast('automations.saveSuccess')).toBe(true);
  });

  it('saves a copy from the Save As dialog', async () => {
    const persist = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationSave = persist;
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha'), definitions: [definition('a', 'Alpha')] });
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha')]);
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.saveAs' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('automations.fields.name'), { target: { value: 'Alpha Copy' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'automations.saveAsConfirm' }));
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.name).toBe('Alpha Copy'));
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha Copy' }));
    expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha', 'Alpha Copy']);
    expect(useAutomationStore.getState().isDirty).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('loads a saved definition from the library drawer', async () => {
    const get = vi.fn().mockResolvedValue(null);
    bridge().automationGet = get;
    useAutomationStore.setState({
      definitions: [definition('a', 'Alpha')],
      activeDefinition: definition('b', 'Beta'),
      isDirty: true,
    });
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha')]);
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.openLibrary' }));
    fireEvent.click(await screen.findByText('Alpha'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('a'));
    expect(useAutomationStore.getState().activeDefinition?.id).toBe('a');
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('duplicates the active definition', async () => {
    const duplicate = vi.fn().mockResolvedValue(definition('copy', 'Alpha Copy'));
    bridge().automationDuplicate = duplicate;
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha'), definitions: [definition('a', 'Alpha')] });
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha')]);
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.duplicate' }));
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.id).toBe('copy'));
    expect(duplicate).toHaveBeenCalledWith({ id: 'a' });
    expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha', 'Alpha Copy']);
    expect(useAutomationStore.getState().isDirty).toBe(false);
    expect(hasToast('automations.duplicateSuccess')).toBe(true);
  });

  it('imports a definition from the bridge', async () => {
    const importDefinition = vi.fn().mockResolvedValue(definition('imported', 'Imported'));
    bridge().automationImport = importDefinition;
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.import' }));
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.id).toBe('imported'));
    expect(importDefinition).toHaveBeenCalled();
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('exports the active definition', async () => {
    const exportDefinition = vi.fn().mockResolvedValue('/tmp/alpha.json');
    bridge().automationExport = exportDefinition;
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha') });
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.export' }));
    await waitFor(() => expect(exportDefinition).toHaveBeenCalledWith('a'));
    expect(hasToast('automations.exportSuccess')).toBe(true);
  });

  it('shows an error toast when an export bridge call fails', async () => {
    bridge().automationExport = vi.fn().mockRejectedValue(new Error('failed'));
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha') });
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.export' }));
    await waitFor(() => expect(hasToast('automations.exportFailed')).toBe(true));
  });

  it('deletes a definition from the library', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    bridge().automationDelete = remove;
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha'), definitions: [definition('a', 'Alpha')] });
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha')]);
    renderPage('Automations');
    fireEvent.click(screen.getByRole('button', { name: 'automations.delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a'));
    expect(useAutomationStore.getState().definitions).toHaveLength(0);
    expect(useAutomationStore.getState().activeDefinition?.id).not.toBe('a');
    expect(useAutomationStore.getState().isDirty).toBe(true);
  });
});
