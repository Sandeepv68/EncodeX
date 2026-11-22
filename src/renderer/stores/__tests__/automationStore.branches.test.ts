import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationStore } from '../automationStore';
import {
  AUTOMATION_BACKENDS,
  createAutomationDefinition,
  createAutomationEdge,
  createAutomationNode,
} from '../../../shared/automations/defaults';
import { AUTOMATION_KIND } from '../../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition } from '../../../shared/automations/types';

const api = window.electronAPI as unknown as Record<string, unknown>;
const originalApi = { ...api };

function backendStatus(): Record<AutomationBackend, boolean> {
  return AUTOMATION_BACKENDS.reduce<Record<AutomationBackend, boolean>>(
    (status, backend) => {
      status[backend] = true;
      return status;
    },
    {} as Record<AutomationBackend, boolean>,
  );
}

function graphDefinition(): AutomationDefinition {
  return createAutomationDefinition('a', 'Alpha', 1, {
    graph: {
      nodes: [
        createAutomationNode('n1', AUTOMATION_KIND.INPUT, { x: 0, y: 0 }, { data: { kind: AUTOMATION_KIND.INPUT, path: '/in' } }),
        createAutomationNode('n2', AUTOMATION_KIND.OUTPUT, { x: 1, y: 0 }, { data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out' } }),
      ],
      edges: [createAutomationEdge('n1', 'n2')],
    },
  });
}

function resetStore(): void {
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
    backendStatus: backendStatus(),
  });
}

describe('automationStore branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(api, originalApi);
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(api, originalApi);
  });

  it('deep-clones graph nodes and edges while saving', async () => {
    const source = graphDefinition();
    useAutomationStore.setState({ activeDefinition: source });
    const saved = await useAutomationStore.getState().saveAutomation();
    expect(saved?.graph.nodes).toHaveLength(2);
    expect(saved?.graph.edges).toHaveLength(1);

    if (saved) {
      saved.graph.nodes[0].position.x = 99;
      saved.graph.edges[0].id = 'changed';
    }
    expect(source.graph.nodes[0].position.x).toBe(0);
    expect(source.graph.edges[0].id).toBe('n1->n2');
  });

  it('ignores graph mutations when no definition is active', () => {
    const store = useAutomationStore.getState();
    expect(store.addNode(AUTOMATION_KIND.INPUT, { x: 0, y: 0 })).toBe('');
    store.removeNode('missing');
    store.updateNode('missing', { label: 'x' });
    store.addEdge({ id: 'edge', source: 'a', target: 'b' });
    store.removeEdge('edge');
    expect(store.addStage('Stage')).toBe('');
    expect(useAutomationStore.getState().activeDefinition).toBeNull();
  });

  it('rejects initialization when an existing definition is malformed', async () => {
    useAutomationStore.setState({ definitions: [null as unknown as AutomationDefinition] });
    await expect(useAutomationStore.getState().initialize()).rejects.toThrow();
  });

  it('falls back when initialization or loading rejects', async () => {
    api.automationList = vi.fn().mockRejectedValue(new Error('list failed'));
    await expect(useAutomationStore.getState().initialize()).resolves.toEqual([]);

    api.automationGet = vi.fn().mockRejectedValue(new Error('get failed'));
    await expect(useAutomationStore.getState().loadAutomation('a')).resolves.toBeNull();
  });

  it('returns local definitions when the bridge is absent', async () => {
    delete api.automationSave;
    delete api.automationGet;
    delete api.automationList;
    useAutomationStore.setState({ activeDefinition: graphDefinition() });

    await expect(useAutomationStore.getState().saveAutomation()).resolves.toMatchObject({ id: 'a' });
    await expect(useAutomationStore.getState().saveAutomationAs('Copy')).resolves.toMatchObject({ name: 'Copy' });
    useAutomationStore.setState({ definitions: [graphDefinition()] });
    await expect(useAutomationStore.getState().loadAutomation('a')).resolves.toMatchObject({ name: 'Alpha' });
    await expect(useAutomationStore.getState().initialize()).resolves.toMatchObject([{ id: 'a' }]);
  });

  it('returns null for empty save-as requests and active-less validation', async () => {
    await expect(useAutomationStore.getState().saveAutomationAs('   ')).resolves.toBeNull();
    expect(useAutomationStore.getState().validate()).toEqual([]);
  });

  it('restores state after failed save-as operations', async () => {
    api.automationSave = vi.fn().mockRejectedValue(new Error('save failed'));
    useAutomationStore.setState({ activeDefinition: graphDefinition(), isDirty: true });
    await expect(useAutomationStore.getState().saveAutomationAs('Copy')).resolves.toBeNull();
    expect(useAutomationStore.getState().activeDefinition?.name).toBe('Alpha');
    expect(useAutomationStore.getState().isDirty).toBe(true);
  });

  it('handles false and rejected library results safely', async () => {
    api.automationDelete = vi.fn().mockResolvedValue(false);
    api.automationDuplicate = vi.fn().mockResolvedValue(null);
    api.automationImport = vi.fn().mockResolvedValue(null);
    await expect(useAutomationStore.getState().deleteAutomation('a')).resolves.toBe(false);
    await expect(useAutomationStore.getState().duplicateAutomation('a')).resolves.toBeNull();
    await expect(useAutomationStore.getState().importAutomation()).resolves.toBeNull();

    api.automationDelete = vi.fn().mockRejectedValue(new Error('delete failed'));
    api.automationDuplicate = vi.fn().mockRejectedValue(new Error('duplicate failed'));
    api.automationImport = vi.fn().mockRejectedValue(new Error('import failed'));
    api.automationExport = vi.fn().mockRejectedValue(new Error('export failed'));
    await expect(useAutomationStore.getState().deleteAutomation('a')).resolves.toBe(false);
    await expect(useAutomationStore.getState().duplicateAutomation('a')).resolves.toBeNull();
    await expect(useAutomationStore.getState().importAutomation()).resolves.toBeNull();
    await expect(useAutomationStore.getState().exportAutomation('a')).resolves.toBeNull();
  });

  it('validates an active definition and ignores unknown run updates', () => {
    useAutomationStore.setState({ activeDefinition: graphDefinition() });
    expect(useAutomationStore.getState().validate()).toEqual([]);
    expect(() =>
      useAutomationStore.getState().updateRun({
        runId: 'missing',
        automationId: 'a',
        nodeId: 'n1',
        status: 'running',
      }),
    ).not.toThrow();
  });

  it('tolerates a missing window object', async () => {
    vi.stubGlobal('window', undefined);
    await expect(useAutomationStore.getState().initialize()).resolves.toEqual([]);
  });
});
