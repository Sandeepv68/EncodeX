/**
 * @fileoverview Hook exposing the Automations editor store and its actions.
 *
 * Graph editing, validation, and library persistence are centralised here so
 * the page and its child components share one UI-safe action surface. The
 * wrappers turn failed bridge calls into error toasts and return the same safe
 * values as the store. Native run progress is relayed into the run state.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutomationStore } from '../stores/automationStore';
import { useErrorStore } from '../stores/errorStore';
import { notify } from '../utils/notify';
import { bridgePromise } from '../utils/bridge-call';
import { openFileDialog } from '../utils/fileDialog';
import { AUTOMATION_BACKENDS } from '../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import type {
  AutomationMediaKind,
  AutomationProgressEvent,
  AutomationRuntime,
  AutomationStartRequest,
} from '../../shared/automations/types';
import { validateAutomation } from '../../shared/automations/validate';
import { isImageFile } from '../../shared/file-extensions';
import type { MediaInfo } from '../../shared/types';
import type { UseAutomationsResult } from './useAutomations.types';

const MAX_PENDING_RUN_EVENTS = 64;
const MAX_PENDING_RUN_IDS = 16;

function inferAutomationMediaKind(info: MediaInfo, path: string): AutomationMediaKind {
  if (isImageFile(path)) return 'image';
  const streams = (info.streams ?? []).filter((stream) => !stream.disposition?.includes('attached_pic'));
  if (streams.some((stream) => stream.type === 'video')) return 'video';
  if (streams.some((stream) => stream.type === 'audio')) return 'audio';
  return 'unknown';
}

/** Hook used by the Automations page and its child components. */
export function useAutomations(): UseAutomationsResult {
  const store = useAutomationStore();
  const { t } = useTranslation();
  const recordError = useErrorStore((state) => state.recordError);
  const pendingRunEvents = useRef<Map<string, AutomationProgressEvent[]>>(new Map());

  const flushPendingRunEvents = useCallback((runId: string) => {
    const queued = pendingRunEvents.current.get(runId);
    if (!queued) return;
    pendingRunEvents.current.delete(runId);
    for (const event of queued) useAutomationStore.getState().updateRun(event);
  }, []);

  const applyRunEvent = useCallback((event: AutomationProgressEvent) => {
    const state = useAutomationStore.getState();
    if (!state.runs[event.runId]) {
      if (!pendingRunEvents.current.has(event.runId)) {
        while (pendingRunEvents.current.size >= MAX_PENDING_RUN_IDS) {
          const oldest = pendingRunEvents.current.keys().next().value;
          if (oldest === undefined) break;
          pendingRunEvents.current.delete(oldest);
        }
      }
      const queued = pendingRunEvents.current.get(event.runId) ?? [];
      if (queued.length < MAX_PENDING_RUN_EVENTS) {
        queued.push(event);
        pendingRunEvents.current.set(event.runId, queued);
      }
      return;
    }
    state.updateRun(event);
  }, []);

  const startRun = useCallback(
    (runId: string, automationId?: string, automationName?: string) => {
      useAutomationStore.getState().startRun(runId, automationId, automationName);
      flushPendingRunEvents(runId);
    },
    [flushPendingRunEvents],
  );

  useEffect(() => {
    const handle = (event: AutomationProgressEvent) => applyRunEvent(event);
    const subscribe = (method?: (cb: (event: AutomationProgressEvent) => void) => () => void) => {
      try {
        return method?.(handle);
      } catch {
        return undefined;
      }
    };
    const api = window.electronAPI;
    const unsubscribeStatus = subscribe(api?.onAutomationStatus);
    const unsubscribeProgress = subscribe(api?.onAutomationProgress);
    const unsubscribeEvent = subscribe(api?.onAutomationEvent);
    const unsubscribeStore = useAutomationStore.subscribe((state) => {
      for (const runId of [...pendingRunEvents.current.keys()]) {
        if (state.runs[runId]) flushPendingRunEvents(runId);
      }
    });
    return () => {
      unsubscribeStatus?.();
      unsubscribeProgress?.();
      unsubscribeEvent?.();
      unsubscribeStore();
    };
  }, [applyRunEvent, flushPendingRunEvents]);

  const initialize = useCallback(async () => {
    const definitions = await useAutomationStore.getState().initialize();
    try {
      const status = await window.electronAPI?.getBmfStatus?.();
      if (status) useAutomationStore.getState().setBackendStatus('BMF', status.available);
    } catch {
      useAutomationStore.getState().setBackendStatus('BMF', false);
    }
    return definitions;
  }, []);

  const save = useCallback(async () => {
    const saved = await useAutomationStore.getState().saveAutomation();
    if (saved) notify.success('automations.saveSuccess');
    else notify.error('automations.saveFailed');
    return saved;
  }, []);

  const saveAs = useCallback(async (name: string) => {
    const saved = await useAutomationStore.getState().saveAutomationAs(name);
    if (saved) notify.success('automations.saveAsSuccess', { values: { name: saved.name } });
    else notify.error('automations.saveAsFailed');
    return saved;
  }, []);

  const load = useCallback(async (id: string) => {
    const loaded = await useAutomationStore.getState().loadAutomation(id);
    if (loaded) notify.info('automations.loadSuccess', { values: { name: loaded.name } });
    else notify.error('automations.loadFailed');
    return loaded;
  }, []);

  const remove = useCallback(async (id: string) => {
    const deleted = await useAutomationStore.getState().deleteAutomation(id);
    if (deleted) notify.success('automations.deleteSuccess');
    else notify.error('automations.deleteFailed');
    return deleted;
  }, []);

  const duplicate = useCallback(async (id: string) => {
    const duplicated = await useAutomationStore.getState().duplicateAutomation(id);
    if (duplicated) notify.success('automations.duplicateSuccess', { values: { name: duplicated.name } });
    else notify.error('automations.duplicateFailed');
    return duplicated;
  }, []);

  const importDefinition = useCallback(async () => {
    const imported = await useAutomationStore.getState().importAutomation();
    if (imported) notify.success('automations.importSuccess', { values: { name: imported.name } });
    else notify.error('automations.importFailed');
    return imported;
  }, []);

  const exportDefinition = useCallback(async (id: string) => {
    const path = await useAutomationStore.getState().exportAutomation(id);
    if (path) notify.success('automations.exportSuccess');
    else notify.error('automations.exportFailed');
    return path;
  }, []);

  const probeInput = useCallback(
    async (pathOverride?: string) => {
      const current = useAutomationStore.getState();
      const input = current.activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
      const path = pathOverride ?? current.runtimeInputPath ?? (input?.data.kind === AUTOMATION_KIND.INPUT ? input.data.path : undefined);
      if (!path) {
        current.setDetectedMediaKind(null);
        notify.warning('automations.probeNoInput');
        return null;
      }
      const probe = window.electronAPI?.getMediaInfo;
      if (!probe) {
        current.setDetectedMediaKind(null);
        notify.error('automations.probeUnavailable');
        return null;
      }
      try {
        const info = await bridgePromise(() => probe(path, 'FFMPEG'));
        const kind = inferAutomationMediaKind(info, path);
        useAutomationStore.getState().setDetectedMediaKind(kind);
        notify.success('automations.inputProbed');
        return kind;
      } catch (err) {
        useAutomationStore.getState().setDetectedMediaKind(null);
        notify.error('automations.probeFailed');
        recordError(err);
        return null;
      }
    },
    [recordError],
  );

  const selectInput = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return;
    const current = useAutomationStore.getState();
    current.setRuntimeInputPath(null);
    current.setDetectedMediaKind(null);
    const input = current.activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
    if (!input) return;
    current.updateNode(input.id, { data: { kind: AUTOMATION_KIND.INPUT, path } });
    await probeInput(path);
  }, [probeInput]);

  const selectRuntimeInput = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return null;
    useAutomationStore.getState().setRuntimeInputPath(path);
    return probeInput(path);
  }, [probeInput]);

  const run = useCallback(
    async (override: Partial<AutomationRuntime> = {}) => {
      const current = useAutomationStore.getState();
      const definition = current.activeDefinition;
      if (!definition) {
        notify.warning('automations.runNoDefinition');
        return null;
      }
      const input = definition.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
      const output = definition.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.OUTPUT);
      const nodeMediaKind = input?.data.kind === AUTOMATION_KIND.INPUT ? input.data.mediaKind : undefined;
      const runtime: AutomationRuntime = {
        inputPath: current.runtimeInputPath ?? (input?.data.kind === AUTOMATION_KIND.INPUT ? input.data.path : undefined),
        outputPath: output?.data.kind === AUTOMATION_KIND.OUTPUT ? output.data.path : undefined,
        mediaKind: current.detectedMediaKind ?? (nodeMediaKind && nodeMediaKind !== 'unknown' ? nodeMediaKind : undefined),
        availableBackends: AUTOMATION_BACKENDS.filter((backend) => current.backendStatus[backend]),
        ...override,
      };
      const issues = validateAutomation(definition, runtime);
      useAutomationStore.setState({ validationIssues: issues });
      if (issues.length > 0) {
        notify.warning('automations.validationFailed', { values: { count: issues.length } });
        return null;
      }
      const invoke = window.electronAPI?.automationStart;
      if (!invoke) {
        const message = t('automations.runUnavailable');
        notify.error('automations.runUnavailable');
        recordError(new Error(message));
        return null;
      }
      const request: AutomationStartRequest = { definition, runtime };
      try {
        const runId = await bridgePromise(() => invoke(request));
        if (typeof runId !== 'string' || runId.length === 0) {
          throw new Error(t('automations.runFailed'));
        }
        startRun(runId, definition.id, definition.name);
        notify.info('automations.runQueued');
        return runId;
      } catch (err) {
        notify.error('automations.runFailed');
        recordError(err);
        return null;
      }
    },
    [recordError, startRun, t],
  );

  const rerun = useCallback(() => run(), [run]);

  const cancel = useCallback(
    async (runId: string) => {
      const invoke = window.electronAPI?.automationCancel;
      if (!invoke) {
        const message = t('automations.cancelUnavailable');
        notify.error('automations.cancelUnavailable');
        recordError(new Error(message));
        return false;
      }
      try {
        const cancelled = await bridgePromise(() => invoke(runId));
        if (cancelled !== true) {
          notify.error('automations.cancelFailed');
          return false;
        }
        const current = useAutomationStore.getState();
        const event: AutomationProgressEvent = {
          runId,
          automationId: current.activeDefinition?.id ?? '',
          nodeId: '',
          status: AUTOMATION_RUN_STATUS.CANCELLED,
          message: t('automations.runCancelled'),
        };
        current.updateRun(event);
        notify.info('automations.runCancelled');
        return true;
      } catch (err) {
        notify.error('automations.cancelFailed');
        recordError(err);
        return false;
      }
    },
    [recordError, t],
  );

  return {
    ...store,
    initialize,
    saveAutomation: save,
    saveAutomationAs: saveAs,
    loadAutomation: load,
    deleteAutomation: remove,
    duplicateAutomation: duplicate,
    importAutomation: importDefinition,
    exportAutomation: exportDefinition,
    selectInput,
    selectRuntimeInput,
    probeInput,
    startRun,
    run,
    rerun,
    cancel,
  };
}
