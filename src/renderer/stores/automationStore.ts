/**
 * @fileoverview Zustand store for the Automations graph editor.
 *
 * Definitions, selection, validation results, and local run state live in
 * memory; library persistence is routed through the preload bridge when it is
 * available and falls back to the in-memory library otherwise.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { bridgePromise } from '../utils/bridge-call';
import type { AutomationBridge, AutomationState } from './types';
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
      nodes: definition.graph.nodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } })),
      edges: definition.graph.edges.map((edge) => ({ ...edge })),
    },
    settings: { ...definition.settings },
  };
}

function automationBridge(): AutomationBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { electronAPI?: AutomationBridge }).electronAPI ?? null;
}

function upsertDefinition(definitions: AutomationDefinition[], definition: AutomationDefinition): AutomationDefinition[] {
  const index = definitions.findIndex((item) => item.id === definition.id);
  if (index === -1) return [...definitions, cloneDefinition(definition)];
  return definitions.map((item) => (item.id === definition.id ? cloneDefinition(definition) : item));
}

function activationPatch(state: AutomationState, definition: AutomationDefinition, dirty: boolean): Partial<AutomationState> {
  const activeDefinition = cloneDefinition(definition);
  return {
    activeDefinition,
    selectedNodeId: null,
    validationIssues: issuesFor(activeDefinition, state.backendStatus),
    isDirty: dirty,
  };
}

/** Validates a candidate definition with the current backend availability. */
function issuesFor(definition: AutomationDefinition, backendStatus: Record<AutomationBackend, boolean>): AutomationIssue[] {
  const availableBackends = AUTOMATION_BACKENDS.filter((backend) => backendStatus[backend]);
  return validateAutomation(definition, { availableBackends });
}

let initialization: Promise<AutomationDefinition[]> | null = null;

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
  isInitialized: false,
  runs: {},
  backendStatus: initialBackendStatus(),

  setDefinitions: (definitions) => set({ definitions }),

  initialize: () => {
    if (initialization) return initialization;
    const invoke = automationBridge()?.automationList;
    const task = (async () => {
      let definitions = get().definitions.map(cloneDefinition);
      if (invoke) {
        try {
          const listed = await bridgePromise(() => invoke());
          if (Array.isArray(listed)) definitions = listed.map(cloneDefinition);
        } catch (err) {
          log.debug('automationList failed', err);
        }
      }
      set({ definitions, isInitialized: true });
      return definitions;
    })();
    initialization = task;
    void task.then(
      () => {
        if (initialization === task) initialization = null;
      },
      () => {
        if (initialization === task) initialization = null;
      },
    );
    return task;
  },

  newAutomation: () => {
    const activeDefinition = createAutomationDefinition(newAutomationId(), DEFAULT_AUTOMATION_NAME);
    log.info(activeDefinition.id);
    set({ activeDefinition, selectedNodeId: null, validationIssues: issuesFor(activeDefinition, get().backendStatus), isDirty: true });
  },

  loadAutomation: async (id) => {
    const local = get().definitions.find((definition) => definition.id === id);
    const fallback = local ? cloneDefinition(local) : null;
    if (fallback) set(activationPatch(get(), fallback, false));
    const invoke = automationBridge()?.automationGet;
    if (!invoke) return fallback;
    try {
      const remote = await bridgePromise(() => invoke(id));
      if (!remote) return fallback;
      const definition = cloneDefinition(remote);
      set((state) => ({ definitions: upsertDefinition(state.definitions, definition), ...activationPatch(state, definition, false) }));
      return cloneDefinition(definition);
    } catch (err) {
      log.debug('automationGet failed', err);
      return fallback;
    }
  },

  saveAutomation: async () => {
    const previous = get();
    const active = previous.activeDefinition;
    if (!active) return null;
    const saved = { ...cloneDefinition(active), updatedAt: Date.now() };
    set({
      definitions: upsertDefinition(previous.definitions, saved),
      activeDefinition: cloneDefinition(saved),
      isDirty: false,
    });
    const invoke = automationBridge()?.automationSave;
    if (!invoke) return cloneDefinition(saved);
    try {
      const persisted = await bridgePromise(() => invoke(cloneDefinition(saved)));
      const definition = cloneDefinition(persisted);
      set((state) => ({
        definitions: upsertDefinition(state.definitions, definition),
        activeDefinition: cloneDefinition(definition),
        isDirty: false,
      }));
      log.info(definition.id);
      return cloneDefinition(definition);
    } catch (err) {
      set({
        definitions: previous.definitions,
        activeDefinition: previous.activeDefinition,
        selectedNodeId: previous.selectedNodeId,
        validationIssues: previous.validationIssues,
        isDirty: previous.isDirty,
      });
      log.debug('automationSave failed', err);
      return null;
    }
  },

  saveAutomationAs: async (name) => {
    const trimmed = name.trim();
    const previous = get();
    const active = previous.activeDefinition;
    if (!trimmed || !active) return null;
    const now = Date.now();
    const saved: AutomationDefinition = {
      ...cloneDefinition(active),
      id: newAutomationId(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    };
    set({
      definitions: upsertDefinition(previous.definitions, saved),
      activeDefinition: cloneDefinition(saved),
      isDirty: false,
    });
    const invoke = automationBridge()?.automationSave;
    if (!invoke) return cloneDefinition(saved);
    try {
      const persisted = await bridgePromise(() => invoke(cloneDefinition(saved)));
      const definition = cloneDefinition(persisted);
      set((state) => ({
        definitions: upsertDefinition(state.definitions, definition),
        activeDefinition: cloneDefinition(definition),
        isDirty: false,
      }));
      return cloneDefinition(definition);
    } catch (err) {
      set({
        definitions: previous.definitions,
        activeDefinition: previous.activeDefinition,
        selectedNodeId: previous.selectedNodeId,
        validationIssues: previous.validationIssues,
        isDirty: previous.isDirty,
      });
      log.debug('automationSaveAs failed', err);
      return null;
    }
  },

  deleteAutomation: async (id) => {
    const invoke = automationBridge()?.automationDelete;
    if (!invoke) return false;
    try {
      const deleted = await bridgePromise(() => invoke(id));
      if (!deleted) return false;
      set((state) => {
        const definitions = state.definitions.filter((definition) => definition.id !== id);
        if (state.activeDefinition?.id !== id) return { definitions };
        const activeDefinition = createAutomationDefinition(newAutomationId(), DEFAULT_AUTOMATION_NAME);
        return {
          definitions,
          activeDefinition,
          selectedNodeId: null,
          validationIssues: issuesFor(activeDefinition, state.backendStatus),
          isDirty: true,
        };
      });
      return true;
    } catch (err) {
      log.debug('automationDelete failed', err);
      return false;
    }
  },

  duplicateAutomation: async (id) => {
    const invoke = automationBridge()?.automationDuplicate;
    if (!invoke) return null;
    try {
      const duplicated = await bridgePromise(() => invoke({ id }));
      if (!duplicated) return null;
      const definition = cloneDefinition(duplicated);
      set((state) => ({
        definitions: upsertDefinition(state.definitions, definition),
        ...activationPatch(state, definition, false),
      }));
      return cloneDefinition(definition);
    } catch (err) {
      log.debug('automationDuplicate failed', err);
      return null;
    }
  },

  importAutomation: async () => {
    const invoke = automationBridge()?.automationImport;
    if (!invoke) return null;
    try {
      const imported = await bridgePromise(() => invoke());
      if (!imported) return null;
      const definition = cloneDefinition(imported);
      set((state) => ({
        definitions: upsertDefinition(state.definitions, definition),
        ...activationPatch(state, definition, false),
      }));
      return cloneDefinition(definition);
    } catch (err) {
      log.debug('automationImport failed', err);
      return null;
    }
  },

  exportAutomation: async (id) => {
    const invoke = automationBridge()?.automationExport;
    if (!invoke || !id) return null;
    try {
      return (await bridgePromise(() => invoke(id))) ?? null;
    } catch (err) {
      log.debug('automationExport failed', err);
      return null;
    }
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
