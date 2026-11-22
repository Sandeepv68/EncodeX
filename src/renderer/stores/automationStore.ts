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
import type {
  AutomationBackend,
  AutomationDefinition,
  AutomationGraph,
  AutomationIssue,
  AutomationMediaKind,
  AutomationProgressEvent,
  AutomationRuntime,
  AutomationRunLogEntry,
  AutomationRunState,
} from '../../shared/automations/types';
import { validateAutomation } from '../../shared/automations/validate';

/** Per-store logger. @const {Logger} */
const log = new Logger('renderer/stores/automationStore');

const MAX_RUN_HISTORY = 20;
const MAX_RUN_EVENTS = 80;

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
    validationIssues: issuesForState(state, activeDefinition),
    isDirty: dirty,
  };
}

function effectiveMediaKind(state: AutomationState, definition: AutomationDefinition | null): AutomationMediaKind | undefined {
  if (state.detectedMediaKind && state.detectedMediaKind !== 'unknown') return state.detectedMediaKind;
  const input = definition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
  if (input?.data.kind === AUTOMATION_KIND.INPUT && input.data.mediaKind && input.data.mediaKind !== 'unknown') {
    return input.data.mediaKind;
  }
  return undefined;
}

function issuesForState(state: AutomationState, definition: AutomationDefinition | null = state.activeDefinition): AutomationIssue[] {
  if (!definition) return [];
  const availableBackends = AUTOMATION_BACKENDS.filter((backend) => state.backendStatus[backend]);
  const runtime: AutomationRuntime = {
    inputPath: state.runtimeInputPath ?? undefined,
    mediaKind: effectiveMediaKind(state, definition),
  };
  return validateAutomation(definition, { ...runtime, availableBackends });
}

function pruneRuns(
  runs: Record<string, AutomationRunState>,
  selectedRunId: string | null,
): { runs: Record<string, AutomationRunState>; selectedRunId: string | null } {
  const ids = Object.keys(runs);
  if (ids.length <= MAX_RUN_HISTORY) return { runs, selectedRunId };
  const ordered = ids
    .map((id, index) => ({ run: runs[id], index }))
    .sort((a, b) => b.run.updatedAt - a.run.updatedAt || b.run.startedAt - a.run.startedAt || b.index - a.index)
    .map(({ run }) => run);
  const retained = new Set(ordered.slice(0, MAX_RUN_HISTORY).map((run) => run.runId));
  const next: Record<string, AutomationRunState> = {};
  for (const id of ids) {
    if (retained.has(id)) next[id] = runs[id];
  }
  return {
    runs: next,
    selectedRunId: selectedRunId && retained.has(selectedRunId) ? selectedRunId : (ordered[0]?.runId ?? null),
  };
}

function isMeaningfulRunEvent(
  previous: AutomationRunState,
  event: AutomationProgressEvent,
  next: Pick<AutomationRunState, 'message' | 'outputPath' | 'error' | 'nodeStatuses' | 'stageStatuses'>,
): boolean {
  return (
    previous.status !== event.status ||
    event.status === AUTOMATION_RUN_STATUS.SUCCEEDED ||
    event.status === AUTOMATION_RUN_STATUS.FAILED ||
    event.status === AUTOMATION_RUN_STATUS.CANCELLED ||
    (Boolean(event.nodeId) && previous.nodeStatuses[event.nodeId] !== event.status) ||
    (Boolean(event.stageId) && previous.stageStatuses[event.stageId ?? ''] !== event.status) ||
    next.message !== previous.message ||
    next.outputPath !== previous.outputPath ||
    next.error !== previous.error
  );
}

function createRunLogEntry(event: AutomationProgressEvent, timestamp: number): AutomationRunLogEntry {
  const message = event.message ?? event.error;
  return {
    timestamp,
    status: event.status,
    ...(message !== undefined ? { message } : {}),
    ...(event.nodeId ? { nodeId: event.nodeId } : {}),
    ...(event.stageId ? { stageId: event.stageId } : {}),
  };
}

function isActiveAutomationRun(run: AutomationRunState): boolean {
  return run.status === AUTOMATION_RUN_STATUS.QUEUED || run.status === AUTOMATION_RUN_STATUS.RUNNING;
}

export function latestAutomationRun(state: AutomationState): AutomationRunState | undefined {
  const ids = Object.keys(state.runs);
  let latest: AutomationRunState | undefined;
  for (const id of ids) {
    const run = state.runs[id];
    if (!latest) {
      latest = run;
      continue;
    }
    if (run.updatedAt > latest.updatedAt || (run.updatedAt === latest.updatedAt && run.startedAt >= latest.startedAt)) {
      latest = run;
    }
  }
  return latest;
}

export function currentAutomationRun(state: AutomationState): AutomationRunState | undefined {
  if (state.selectedRunId) {
    const selected = state.runs[state.selectedRunId];
    if (selected) return selected;
  }
  return latestAutomationRun(state);
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
    validationIssues: issuesForState(state, activeDefinition),
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
  runtimeInputPath: null,
  detectedMediaKind: null,
  selectedRunId: null,
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
    set({ activeDefinition, selectedNodeId: null, validationIssues: issuesForState(get(), activeDefinition), isDirty: true });
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
          validationIssues: issuesForState(state, activeDefinition),
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
    const issues = issuesForState(state);
    set({ validationIssues: issues });
    return issues;
  },

  setBackendStatus: (backend, available) =>
    set((state) => {
      const backendStatus = { ...state.backendStatus, [backend]: available };
      const activeDefinition = state.activeDefinition;
      return {
        backendStatus,
        validationIssues: issuesForState({ ...state, backendStatus }, activeDefinition),
      };
    }),

  setRuntimeInputPath: (path) =>
    set((state) => ({
      runtimeInputPath: path,
      detectedMediaKind: null,
      validationIssues: issuesForState({ ...state, runtimeInputPath: path, detectedMediaKind: null }),
    })),

  setDetectedMediaKind: (mediaKind) =>
    set((state) => ({
      detectedMediaKind: mediaKind,
      validationIssues: issuesForState({ ...state, detectedMediaKind: mediaKind }),
    })),

  selectRun: (runId) => set({ selectedRunId: runId }),

  clearRuns: () =>
    set((state) => {
      const runs = Object.fromEntries(Object.entries(state.runs).filter(([, run]) => isActiveAutomationRun(run)));
      const selectedRunId = state.selectedRunId && runs[state.selectedRunId] ? state.selectedRunId : null;
      return { runs, selectedRunId };
    }),

  startRun: (runId, automationId, automationName) =>
    set((state) => {
      const timestamp = Date.now();
      const run: AutomationRunState = {
        runId,
        status: AUTOMATION_RUN_STATUS.QUEUED,
        progress: 0,
        automationId: automationId ?? state.activeDefinition?.id ?? '',
        automationName: automationName ?? state.activeDefinition?.name ?? '',
        startedAt: timestamp,
        updatedAt: timestamp,
        nodeStatuses: {},
        stageStatuses: {},
        events: [],
        ...(state.runtimeInputPath ? { runtimeInputPath: state.runtimeInputPath } : {}),
      };
      return pruneRuns({ ...state.runs, [runId]: run }, runId);
    }),

  updateRun: (event) =>
    set((state) => {
      const previous = state.runs[event.runId];
      if (!previous) return {};
      const timestamp = Date.now();
      const nodeStatuses = event.nodeId ? { ...previous.nodeStatuses, [event.nodeId]: event.status } : previous.nodeStatuses;
      const stageStatuses = event.stageId ? { ...previous.stageStatuses, [event.stageId]: event.status } : previous.stageStatuses;
      const message = event.message !== undefined ? event.message : previous.message;
      const outputPath = event.outputPath !== undefined ? event.outputPath : previous.outputPath;
      const error = event.error !== undefined ? event.error : previous.error;
      const nextDetails = { message, outputPath, error, nodeStatuses, stageStatuses };
      const events = isMeaningfulRunEvent(previous, event, nextDetails)
        ? [...previous.events, createRunLogEntry(event, timestamp)].slice(-MAX_RUN_EVENTS)
        : previous.events.slice(-MAX_RUN_EVENTS);
      const run: AutomationRunState = {
        ...previous,
        status: event.status,
        progress: event.progress ?? previous.progress,
        automationId: previous.automationId || event.automationId,
        message,
        outputPath,
        error,
        nodeStatuses,
        stageStatuses,
        events,
        updatedAt: timestamp,
      };
      return pruneRuns({ ...state.runs, [event.runId]: run }, state.selectedRunId);
    }),
}));
