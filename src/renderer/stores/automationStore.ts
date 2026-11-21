/**
 * @fileoverview Zustand store for the Automations graph editor.
 *
 * Phase 1 keeps definitions, selection, validation results, and local run
 * state in memory. Persistence and native execution are wired in later phases
 * through the same actions, so pages and components do not change shape.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import type { AutomationState } from './types';
import {
  AUTOMATION_BACKENDS,
  DEFAULT_AUTOMATION_NAME,
  createAutomationDefinition,
  createAutomationNode,
  newAutomationId,
  newAutomationNodeId,
} from '../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition, AutomationGraph, AutomationIssue } from '../../shared/automations/types';
import { validateAutomation } from '../../shared/automations/validate';

/** Per-store logger. @const {Logger} */
const log = new Logger('renderer/stores/automationStore');

/** Builds a fresh backend availability map with every backend enabled. */
function initialBackendStatus(): Record<AutomationBackend, boolean> {
  return AUTOMATION_BACKENDS.reduce<Record<AutomationBackend, boolean>>(
    (status, backend) => {
      status[backend] = true;
      return status;
    },
    {} as Record<AutomationBackend, boolean>,
  );
}

/** Deep-enough copy of a definition so editing never mutates a saved library entry. */
function cloneDefinition(definition: AutomationDefinition): AutomationDefinition {
  return {
    ...definition,
    graph: {
      nodes: definition.graph.nodes.map((node) => ({ ...node, position: { ...node.position } })),
      edges: definition.graph.edges.map((edge) => ({ ...edge })),
    },
  };
}

/** Validates a candidate definition with the current backend availability. */
function issuesFor(definition: AutomationDefinition, backendStatus: Record<AutomationBackend, boolean>): AutomationIssue[] {
  const availableBackends = AUTOMATION_BACKENDS.filter((backend) => backendStatus[backend]);
  return validateAutomation(definition, { availableBackends });
}

/** Produces the state patch shared by all graph mutations. */
function graphPatch(
  state: AutomationState,
  graph: AutomationGraph,
  selectedNodeId: string | null = state.selectedNodeId,
): Partial<AutomationState> {
  const activeDefinition = state.activeDefinition ? { ...state.activeDefinition, graph, updatedAt: Date.now() } : state.activeDefinition;
  if (!activeDefinition) return {};
  return {
    activeDefinition,
    selectedNodeId,
    validationIssues: issuesFor(activeDefinition, state.backendStatus),
    isDirty: true,
  };
}

/** Zustand store backing the Automations editor. @const */
export const useAutomationStore = create<AutomationState>((set, get) => ({
  definitions: [],
  activeDefinition: null,
  selectedNodeId: null,
  validationIssues: [],
  isDirty: false,
  runs: {},
  backendStatus: initialBackendStatus(),

  setDefinitions: (definitions) => set({ definitions }),

  newAutomation: () => {
    const activeDefinition = createAutomationDefinition(newAutomationId(), DEFAULT_AUTOMATION_NAME);
    log.info(activeDefinition.id);
    set({ activeDefinition, selectedNodeId: null, validationIssues: issuesFor(activeDefinition, get().backendStatus), isDirty: true });
  },

  loadAutomation: (id) => {
    const saved = get().definitions.find((definition) => definition.id === id);
    if (!saved) return;
    const activeDefinition = cloneDefinition(saved);
    set({
      activeDefinition,
      selectedNodeId: null,
      validationIssues: issuesFor(activeDefinition, get().backendStatus),
      isDirty: false,
    });
  },

  saveAutomation: () => {
    const active = get().activeDefinition;
    if (!active) return;
    const saved = { ...cloneDefinition(active), updatedAt: Date.now() };
    set((state) => {
      const index = state.definitions.findIndex((definition) => definition.id === saved.id);
      const definitions =
        index === -1 ? [...state.definitions, saved] : state.definitions.map((item) => (item.id === saved.id ? saved : item));
      return { definitions, activeDefinition: saved, isDirty: false };
    });
    log.info(saved.id);
  },

  renameAutomation: (name) =>
    set((state) => ({
      activeDefinition: state.activeDefinition ? { ...state.activeDefinition, name, updatedAt: Date.now() } : null,
      isDirty: state.activeDefinition ? true : state.isDirty,
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (kind, position, stageId) => {
    const state = get();
    if (!state.activeDefinition) return '';
    const id = newAutomationNodeId();
    const node = createAutomationNode(id, kind, position, stageId ? { stageId } : {});
    const graph = {
      ...state.activeDefinition.graph,
      nodes: [...state.activeDefinition.graph.nodes, node],
    };
    set(graphPatch(state, graph, id));
    return id;
  },

  removeNode: (id) => {
    const state = get();
    if (!state.activeDefinition) return;
    const graph = {
      nodes: state.activeDefinition.graph.nodes.filter((node) => node.id !== id),
      edges: state.activeDefinition.graph.edges.filter((edge) => edge.source !== id && edge.target !== id),
    };
    set(graphPatch(state, graph, state.selectedNodeId === id ? null : state.selectedNodeId));
  },

  updateNode: (id, patch) => {
    const state = get();
    if (!state.activeDefinition) return;
    const graph = {
      ...state.activeDefinition.graph,
      nodes: state.activeDefinition.graph.nodes.map((node) => (node.id === id ? { ...node, ...patch, id: node.id } : node)),
    };
    set(graphPatch(state, graph));
  },

  addEdge: (edge) => {
    const state = get();
    if (!state.activeDefinition) return;
    const exists = state.activeDefinition.graph.edges.some((current) => current.source === edge.source && current.target === edge.target);
    if (exists) return;
    const graph = {
      ...state.activeDefinition.graph,
      edges: [...state.activeDefinition.graph.edges, { ...edge, id: edge.id || newAutomationNodeId() }],
    };
    set(graphPatch(state, graph));
  },

  removeEdge: (id) => {
    const state = get();
    if (!state.activeDefinition) return;
    const graph = {
      ...state.activeDefinition.graph,
      edges: state.activeDefinition.graph.edges.filter((edge) => edge.id !== id),
    };
    set(graphPatch(state, graph));
  },

  addStage: (name) => {
    const state = get();
    if (!state.activeDefinition) return '';
    const id = newAutomationNodeId();
    const node = createAutomationNode(
      id,
      AUTOMATION_KIND.STAGE,
      {
        x: 0,
        y: state.activeDefinition.graph.nodes.length * 2,
      },
      { stageId: id, data: { kind: AUTOMATION_KIND.STAGE, name } },
    );
    const graph = { ...state.activeDefinition.graph, nodes: [...state.activeDefinition.graph.nodes, node] };
    set(graphPatch(state, graph, id));
    return id;
  },

  renameStage: (id, name) => {
    get().updateNode(id, { label: name, data: { kind: AUTOMATION_KIND.STAGE, name } });
  },

  validate: () => {
    const state = get();
    if (!state.activeDefinition) {
      set({ validationIssues: [] });
      return [];
    }
    const issues = issuesFor(state.activeDefinition, state.backendStatus);
    set({ validationIssues: issues });
    return issues;
  },

  setBackendStatus: (backend, available) =>
    set((state) => {
      const backendStatus = { ...state.backendStatus, [backend]: available };
      const activeDefinition = state.activeDefinition;
      return {
        backendStatus,
        validationIssues: activeDefinition ? issuesFor(activeDefinition, backendStatus) : state.validationIssues,
      };
    }),

  startRun: (runId) =>
    set((state) => ({
      runs: {
        ...state.runs,
        [runId]: { runId, status: AUTOMATION_RUN_STATUS.QUEUED, progress: 0, nodeStatuses: {} },
      },
    })),

  updateRun: (event) =>
    set((state) => {
      const previous = state.runs[event.runId];
      if (!previous) return {};
      const run = {
        ...previous,
        status: event.status,
        progress: event.progress ?? previous.progress,
        message: event.message ?? previous.message,
        nodeStatuses: { ...previous.nodeStatuses, [event.nodeId]: event.status },
      };
      return { runs: { ...state.runs, [event.runId]: run } };
    }),
}));
