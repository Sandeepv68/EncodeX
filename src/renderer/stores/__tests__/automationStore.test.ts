import { beforeEach, describe, expect, it } from 'vitest';
import { useAutomationStore } from '../automationStore';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';

describe('automationStore', () => {
  beforeEach(() => {
    useAutomationStore.setState({
      definitions: [],
      activeDefinition: null,
      selectedNodeId: null,
      validationIssues: [],
      isDirty: false,
      runs: {},
    });
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
});
