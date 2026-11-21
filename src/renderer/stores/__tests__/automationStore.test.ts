import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentAutomationRun, latestAutomationRun, useAutomationStore } from '../automationStore';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import type { AutomationDefinition, AutomationProgressEvent } from '../../../shared/automations/types';
import { AUTOMATION_BACKENDS, createAutomationDefinition } from '../../../shared/automations/defaults';

const electronApi = window.electronAPI as unknown as Record<string, unknown>;
const originalMethods = { ...electronApi };

function definition(id: string, name: string): AutomationDefinition {
  return createAutomationDefinition(id, name, 1);
}

function bridge(): Record<string, unknown> {
  return window.electronAPI as unknown as Record<string, unknown>;
}

function progressEvent(overrides: Partial<AutomationProgressEvent> = {}): AutomationProgressEvent {
  return {
    runId: 'run-1',
    automationId: 'automation-1',
    nodeId: 'node-1',
    stageId: 'stage-1',
    status: AUTOMATION_RUN_STATUS.RUNNING,
    progress: 42,
    ...overrides,
  };
}

describe('automationStore', () => {
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
      backendStatus: AUTOMATION_BACKENDS.reduce<Record<string, boolean>>(
        (status, backend) => ({ ...status, [backend]: true }),
        {},
      ) as Record<(typeof AUTOMATION_BACKENDS)[number], boolean>,
    });
  });

  afterEach(() => {
    (globalThis as unknown as { electronAPI: unknown }).electronAPI = electronApi;
    const current = bridge();
    for (const key of Object.keys(current)) {
      if (!(key in originalMethods)) delete current[key];
    }
    Object.assign(current, originalMethods);
  });

  it('creates a definition with default validation issues', () => {
    useAutomationStore.getState().newAutomation();
    const state = useAutomationStore.getState();
    expect(state.activeDefinition?.version).toBe(1);
    expect(state.activeDefinition?.graph.nodes).toHaveLength(0);
    expect(state.validationIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['empty_graph', 'missing_input', 'missing_output']),
    );
    expect(state.isDirty).toBe(true);
  });

  it('adds, updates, selects, and removes nodes', () => {
    const store = useAutomationStore.getState();
    store.newAutomation();
    const id = useAutomationStore.getState().addNode(AUTOMATION_KIND.INPUT, { x: 0, y: 0 });
    expect(useAutomationStore.getState().selectedNodeId).toBe(id);
    useAutomationStore.getState().updateNode(id, { label: 'Source' });
    expect(useAutomationStore.getState().activeDefinition?.graph.nodes[0].label).toBe('Source');
    useAutomationStore.getState().selectNode(null);
    expect(useAutomationStore.getState().selectedNodeId).toBeNull();
    useAutomationStore.getState().removeNode(id);
    expect(useAutomationStore.getState().activeDefinition?.graph.nodes).toHaveLength(0);
  });

  it('creates and renames stages', () => {
    useAutomationStore.getState().newAutomation();
    const id = useAutomationStore.getState().addStage('Stage A');
    useAutomationStore.getState().renameStage(id, 'Stage B');
    const stage = useAutomationStore.getState().activeDefinition?.graph.nodes.find((node) => node.id === id);
    expect(stage?.data).toEqual({ kind: AUTOMATION_KIND.STAGE, name: 'Stage B' });
  });

  it('adds and removes edges without duplicates', () => {
    useAutomationStore.getState().newAutomation();
    const source = useAutomationStore.getState().addNode(AUTOMATION_KIND.INPUT, { x: 0, y: 0 });
    const target = useAutomationStore.getState().addNode(AUTOMATION_KIND.OUTPUT, { x: 1, y: 0 });
    useAutomationStore.getState().addEdge({ id: 'edge-1', source, target });
    useAutomationStore.getState().addEdge({ id: 'edge-2', source, target });
    expect(useAutomationStore.getState().activeDefinition?.graph.edges).toHaveLength(1);
    useAutomationStore.getState().removeEdge('edge-1');
    expect(useAutomationStore.getState().activeDefinition?.graph.edges).toHaveLength(0);
  });

  it('saves and reloads an automation definition', () => {
    useAutomationStore.getState().newAutomation();
    const id = useAutomationStore.getState().activeDefinition!.id;
    useAutomationStore.getState().renameAutomation('Pipeline');
    useAutomationStore.getState().saveAutomation();
    expect(useAutomationStore.getState().definitions).toHaveLength(1);
    expect(useAutomationStore.getState().isDirty).toBe(false);
    useAutomationStore.getState().newAutomation();
    useAutomationStore.getState().loadAutomation(id);
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Pipeline');
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('tracks local run progress events', () => {
    useAutomationStore.getState().newAutomation();
    useAutomationStore.getState().startRun('run-1');
    expect(useAutomationStore.getState().runs['run-1'].status).toBe(AUTOMATION_RUN_STATUS.QUEUED);
    useAutomationStore.getState().updateRun({
      runId: 'run-1',
      automationId: 'automation-1',
      nodeId: 'node-1',
      status: AUTOMATION_RUN_STATUS.RUNNING,
      progress: 42,
    });
    const run = useAutomationStore.getState().runs['run-1'];
    expect(run.status).toBe(AUTOMATION_RUN_STATUS.RUNNING);
    expect(run.progress).toBe(42);
    expect(run.nodeStatuses['node-1']).toBe(AUTOMATION_RUN_STATUS.RUNNING);
  });

  it('records run metadata, stage status, and meaningful log events', () => {
    useAutomationStore.getState().newAutomation();
    useAutomationStore.getState().startRun('run-1', 'auto-9', 'Pipeline');
    useAutomationStore.getState().updateRun(progressEvent());
    useAutomationStore.getState().updateRun(progressEvent({ progress: 43 }));

    const state = useAutomationStore.getState();
    const run = state.runs['run-1'];
    expect(run).toMatchObject({
      runId: 'run-1',
      automationId: 'auto-9',
      automationName: 'Pipeline',
      status: AUTOMATION_RUN_STATUS.RUNNING,
      progress: 43,
    });
    expect(state.selectedRunId).toBe('run-1');
    expect(run.stageStatuses['stage-1']).toBe(AUTOMATION_RUN_STATUS.RUNNING);
    expect(run.events).toEqual([expect.objectContaining({ stageId: 'stage-1', status: AUTOMATION_RUN_STATUS.RUNNING })]);
  });

  it('bounds run history to the latest 20 runs', () => {
    for (let index = 0; index < 21; index += 1) {
      useAutomationStore.getState().startRun(`run-${index}`, 'auto-1', 'Pipeline');
    }
    const state = useAutomationStore.getState();
    expect(Object.keys(state.runs)).toHaveLength(20);
    expect(state.runs['run-0']).toBeUndefined();
    expect(state.runs['run-20']).toBeDefined();
    expect(state.selectedRunId).toBe('run-20');
  });

  it('separates inspected run selection from the latest run', () => {
    useAutomationStore.getState().startRun('run-old');
    useAutomationStore.getState().startRun('run-new');
    useAutomationStore.getState().selectRun('run-old');
    const state = useAutomationStore.getState();

    expect(currentAutomationRun(state)?.runId).toBe('run-old');
    expect(latestAutomationRun(state)?.runId).toBe('run-new');
  });

  it('keeps active runs when clearing history', () => {
    useAutomationStore.getState().startRun('run-active');
    useAutomationStore.getState().startRun('run-complete');
    useAutomationStore.getState().updateRun({
      runId: 'run-complete',
      automationId: 'automation-1',
      nodeId: 'node-1',
      status: AUTOMATION_RUN_STATUS.SUCCEEDED,
      progress: 100,
    });
    useAutomationStore.getState().clearRuns();
    const state = useAutomationStore.getState();

    expect(Object.keys(state.runs)).toEqual(['run-active']);
    expect(state.selectedRunId).toBeNull();
  });

  it('clears detected media when the runtime input path changes', () => {
    useAutomationStore.getState().setDetectedMediaKind('audio');
    useAutomationStore.getState().setRuntimeInputPath('/clip.png');
    expect(useAutomationStore.getState().detectedMediaKind).toBeNull();
  });

  it('initializes the library from the bridge', async () => {
    bridge().automationList = vi.fn().mockResolvedValue([definition('a', 'Alpha'), definition('b', 'Beta')]);
    const definitions = await useAutomationStore.getState().initialize();
    expect(definitions.map((item) => item.name)).toEqual(['Alpha', 'Beta']);
    expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha', 'Beta']);
    expect(useAutomationStore.getState().isInitialized).toBe(true);
  });

  it('persists a save through the bridge and clears dirty state', async () => {
    const persist = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationSave = persist;
    useAutomationStore.getState().newAutomation();
    useAutomationStore.getState().renameAutomation('Persisted');
    const saved = await useAutomationStore.getState().saveAutomation();
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Persisted' }));
    expect(saved?.name).toBe('Persisted');
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Persisted');
    expect(useAutomationStore.getState().definitions).toHaveLength(1);
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('restores dirty state when a bridge save rejects', async () => {
    bridge().automationSave = vi.fn().mockRejectedValue(new Error('failed'));
    useAutomationStore.getState().newAutomation();
    useAutomationStore.getState().renameAutomation('Unsaved');
    const saved = await useAutomationStore.getState().saveAutomation();
    expect(saved).toBeNull();
    expect(useAutomationStore.getState().definitions).toHaveLength(0);
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Unsaved');
    expect(useAutomationStore.getState().isDirty).toBe(true);
  });

  it('saves a copy under a new id and name', async () => {
    const persist = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationSave = persist;
    useAutomationStore.getState().setDefinitions([definition('a', 'Alpha')]);
    useAutomationStore.getState().loadAutomation('a');
    const originalId = useAutomationStore.getState().activeDefinition?.id;
    const saved = await useAutomationStore.getState().saveAutomationAs('Alpha Copy');
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha Copy' }));
    expect(saved?.id).not.toBe(originalId);
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Alpha Copy');
    expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha', 'Alpha Copy']);
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('loads the authoritative definition from the bridge', async () => {
    bridge().automationGet = vi.fn().mockResolvedValue(definition('a', 'Remote Alpha'));
    useAutomationStore.getState().newAutomation();
    const loaded = await useAutomationStore.getState().loadAutomation('a');
    expect(loaded?.name).toBe('Remote Alpha');
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Remote Alpha');
    expect(useAutomationStore.getState().definitions).toHaveLength(1);
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('adopts duplicated and imported definitions from the bridge', async () => {
    bridge().automationDuplicate = vi.fn().mockResolvedValue(definition('copy', 'Alpha Copy'));
    bridge().automationImport = vi.fn().mockResolvedValue(definition('imported', 'Imported'));
    const duplicated = await useAutomationStore.getState().duplicateAutomation('a');
    expect(duplicated?.name).toBe('Alpha Copy');
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Alpha Copy');
    expect(useAutomationStore.getState().isDirty).toBe(false);
    const imported = await useAutomationStore.getState().importAutomation();
    expect(imported?.name).toBe('Imported');
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Imported');
    expect(useAutomationStore.getState().definitions.map((item) => item.name)).toEqual(['Alpha Copy', 'Imported']);
    expect(useAutomationStore.getState().isDirty).toBe(false);
  });

  it('exports and deletes through the bridge', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    bridge().automationExport = vi.fn().mockResolvedValue('/tmp/alpha.json');
    bridge().automationDelete = remove;
    useAutomationStore.getState().setDefinitions([definition('a', 'Alpha')]);
    await expect(useAutomationStore.getState().exportAutomation('a')).resolves.toBe('/tmp/alpha.json');
    await expect(useAutomationStore.getState().deleteAutomation('a')).resolves.toBe(true);
    expect(remove).toHaveBeenCalledWith('a');
    expect(useAutomationStore.getState().definitions).toHaveLength(0);
  });

  it('returns safe values when the bridge is missing', async () => {
    (globalThis as unknown as { electronAPI: unknown }).electronAPI = undefined;
    useAutomationStore.getState().setDefinitions([]);
    await expect(useAutomationStore.getState().initialize()).resolves.toEqual([]);
    await expect(useAutomationStore.getState().saveAutomation()).resolves.toBeNull();
    await expect(useAutomationStore.getState().loadAutomation('a')).resolves.toBeNull();
    await expect(useAutomationStore.getState().deleteAutomation('a')).resolves.toBe(false);
    await expect(useAutomationStore.getState().duplicateAutomation('a')).resolves.toBeNull();
    await expect(useAutomationStore.getState().importAutomation()).resolves.toBeNull();
    await expect(useAutomationStore.getState().exportAutomation('a')).resolves.toBeNull();
  });
});
