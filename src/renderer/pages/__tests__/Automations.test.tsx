import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from '../../../test-utils/page-render';
import { useAutomationStore } from '../../stores/automationStore';
import { useToastStore } from '../../stores/toastStore';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import type { AutomationDefinition } from '../../../shared/automations/types';
import type { MediaInfo } from '../../../shared/types';

const electronApi = window.electronAPI as unknown as Record<string, unknown>;
const originalMethods = { ...electronApi };
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const defaultMediaInfo: MediaInfo = {
  file: '/in.mp4',
  format: 'mp4',
  size: 100,
  duration: 5,
  bitrate: '100k',
  streams: [{ index: 0, type: 'video', codec: 'h264' }],
};

function definition(id: string, name: string): AutomationDefinition {
  return createAutomationDefinition(id, name, 1);
}

function runnableDefinition(): AutomationDefinition {
  const candidate = definition('a', 'Alpha');
  candidate.graph = {
    nodes: [
      createAutomationNode(
        'n1',
        AUTOMATION_KIND.INPUT,
        { x: 0, y: 0 },
        {
          data: { kind: AUTOMATION_KIND.INPUT, path: '/in.mp4', mediaKind: 'video' },
        },
      ),
      createAutomationNode(
        'n2',
        AUTOMATION_KIND.OUTPUT,
        { x: 1, y: 0 },
        {
          data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out.mp4' },
        },
      ),
    ],
    edges: [createAutomationEdge('n1', 'n2')],
  };
  return candidate;
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
      runtimeInputPath: null,
      detectedMediaKind: null,
      selectedRunId: null,
    });
    useToastStore.setState({ toasts: [] });
    bridge().automationList = vi.fn().mockResolvedValue([]);
    bridge().automationGet = vi.fn().mockResolvedValue(null);
    bridge().automationSave = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationDelete = vi.fn().mockResolvedValue(false);
    bridge().automationDuplicate = vi.fn().mockResolvedValue(null);
    bridge().automationImport = vi.fn().mockResolvedValue(null);
    bridge().automationExport = vi.fn().mockResolvedValue(null);
    bridge().automationStart = vi.fn().mockResolvedValue('run-page');
    bridge().automationCancel = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    const current = bridge();
    for (const key of Object.keys(current)) {
      if (!(key in originalMethods)) delete current[key];
    }
    Object.assign(current, originalMethods);
    getMediaInfoMock.mockReset().mockResolvedValue(defaultMediaInfo);
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

  it('starts a run from the toolbar and records it in the run panel', async () => {
    const start = vi.fn().mockResolvedValue('run-page');
    bridge().automationStart = start;
    useAutomationStore.setState({ activeDefinition: runnableDefinition() });
    renderPage('Automations');

    fireEvent.click(screen.getByRole('button', { name: 'automations.run' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ definition: expect.any(Object) })));
    await waitFor(() => expect(useAutomationStore.getState().runs['run-page']?.status).toBe(AUTOMATION_RUN_STATUS.QUEUED));
    expect(hasToast('automations.runQueued')).toBe(true);
  });

  it('cancels and reruns from the run console', async () => {
    const start = vi.fn().mockResolvedValue('run-page');
    const cancel = vi.fn().mockResolvedValue(true);
    bridge().automationStart = start;
    bridge().automationCancel = cancel;
    useAutomationStore.setState({ activeDefinition: runnableDefinition() });
    renderPage('Automations');

    fireEvent.click(screen.getByRole('button', { name: 'automations.run' }));
    await waitFor(() => expect(useAutomationStore.getState().runs['run-page']?.status).toBe(AUTOMATION_RUN_STATUS.QUEUED));
    fireEvent.click(screen.getAllByRole('button', { name: 'automations.cancelRun' })[0]);
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('run-page'));
    fireEvent.click(screen.getByRole('button', { name: 'automations.rerun' }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
  });

  it('probes the runtime input from the run console', async () => {
    const info: MediaInfo = {
      file: '/override.mov',
      format: 'mov',
      size: 100,
      duration: 5,
      bitrate: '100k',
      streams: [{ index: 0, type: 'video', codec: 'h264' }],
    };
    getMediaInfoMock.mockResolvedValue(info);
    useAutomationStore.setState({
      activeDefinition: runnableDefinition(),
      runtimeInputPath: '/override.mov',
    });
    renderPage('Automations');

    fireEvent.click(screen.getByRole('button', { name: 'automations.probeInput' }));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/override.mov', 'FFMPEG'));
    expect(useAutomationStore.getState().detectedMediaKind).toBe('video');
  });

  it('shows run history details, stage timeline, and events', async () => {
    const definition = runnableDefinition();
    const stageId = definition.id;
    useAutomationStore.setState({
      activeDefinition: definition,
      selectedRunId: 'run-history',
      runs: {
        'run-history': {
          runId: 'run-history',
          automationId: definition.id,
          automationName: 'Alpha',
          startedAt: 1,
          updatedAt: 2,
          status: AUTOMATION_RUN_STATUS.FAILED,
          progress: 75,
          runtimeInputPath: '/in.mp4',
          outputPath: '/out.mp4',
          error: 'boom',
          nodeStatuses: {},
          stageStatuses: { [stageId]: AUTOMATION_RUN_STATUS.FAILED },
          events: [
            {
              timestamp: 2,
              status: AUTOMATION_RUN_STATUS.FAILED,
              message: 'step failed',
              nodeId: 'n1',
              stageId,
            },
          ],
        },
      },
    });
    renderPage('Automations');
    await waitFor(() => expect(useAutomationStore.getState().isInitialized).toBe(true));

    expect(screen.getByText('automations.stageTimeline')).toBeInTheDocument();
    expect(screen.getByText('automations.runEvents')).toBeInTheDocument();
    expect(screen.getByText('/out.mp4')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByText('step failed')).toBeInTheDocument();
  });

  it('filters palette operations by the selected media kind', async () => {
    const definition = runnableDefinition();
    const input = definition.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
    if (input?.data.kind === AUTOMATION_KIND.INPUT) input.data.mediaKind = 'audio';
    useAutomationStore.setState({ activeDefinition: definition });
    renderPage('Automations');
    await waitFor(() => expect(useAutomationStore.getState().isInitialized).toBe(true));

    expect(screen.getByRole('button', { name: 'automations.node.input' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'automations.node.compressImage' })).not.toBeInTheDocument();
    expect(screen.getByText('automations.paletteFilteredHint')).toBeInTheDocument();
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
