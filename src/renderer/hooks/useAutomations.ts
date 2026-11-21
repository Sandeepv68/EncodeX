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
import { useToastStore } from '../stores/toastStore';
import { bridgePromise } from '../utils/bridge-call';
import { openFileDialog } from '../utils/fileDialog';
import { AUTOMATION_BACKENDS } from '../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import type { AutomationProgressEvent, AutomationRuntime, AutomationStartRequest } from '../../shared/automations/types';
import type { UseAutomationsResult } from './useAutomations.types';

const MAX_PENDING_RUN_EVENTS = 64;
const MAX_PENDING_RUN_IDS = 16;

/** Hook used by the Automations page and its child components. */
export function useAutomations(): UseAutomationsResult {
  const store = useAutomationStore();
  const { t } = useTranslation();
  const showWarning = useToastStore((state) => state.warning);
  const showInfo = useToastStore((state) => state.info);
  const showSuccess = useToastStore((state) => state.success);
  const showToastError = useToastStore((state) => state.error);
  const showAppError = useErrorStore((state) => state.showError);
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
    (runId: string) => {
      useAutomationStore.getState().startRun(runId);
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

  const initialize = useCallback(() => useAutomationStore.getState().initialize(), []);

  const save = useCallback(async () => {
    const saved = await useAutomationStore.getState().saveAutomation();
    if (saved) showSuccess(t('automations.saveSuccess'));
    else showToastError(t('automations.saveFailed'));
    return saved;
  }, [showSuccess, showToastError, t]);

  const saveAs = useCallback(
    async (name: string) => {
      const saved = await useAutomationStore.getState().saveAutomationAs(name);
      if (saved) showSuccess(t('automations.saveAsSuccess', { name: saved.name }));
      else showToastError(t('automations.saveAsFailed'));
      return saved;
    },
    [showSuccess, showToastError, t],
  );

  const load = useCallback(
    async (id: string) => {
      const loaded = await useAutomationStore.getState().loadAutomation(id);
      if (loaded) showInfo(t('automations.loadSuccess', { name: loaded.name }));
      else showToastError(t('automations.loadFailed'));
      return loaded;
    },
    [showInfo, showToastError, t],
  );

  const remove = useCallback(
    async (id: string) => {
      const deleted = await useAutomationStore.getState().deleteAutomation(id);
      if (deleted) showSuccess(t('automations.deleteSuccess'));
      else showToastError(t('automations.deleteFailed'));
      return deleted;
    },
    [showSuccess, showToastError, t],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const duplicated = await useAutomationStore.getState().duplicateAutomation(id);
      if (duplicated) showSuccess(t('automations.duplicateSuccess', { name: duplicated.name }));
      else showToastError(t('automations.duplicateFailed'));
      return duplicated;
    },
    [showSuccess, showToastError, t],
  );

  const importDefinition = useCallback(async () => {
    const imported = await useAutomationStore.getState().importAutomation();
    if (imported) showSuccess(t('automations.importSuccess', { name: imported.name }));
    else showToastError(t('automations.importFailed'));
    return imported;
  }, [showSuccess, showToastError, t]);

  const exportDefinition = useCallback(
    async (id: string) => {
      const path = await useAutomationStore.getState().exportAutomation(id);
      if (path) showSuccess(t('automations.exportSuccess'));
      else showToastError(t('automations.exportFailed'));
      return path;
    },
    [showSuccess, showToastError, t],
  );

  const selectInput = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return;
    const current = useAutomationStore.getState();
    const input = current.activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
    if (!input) return;
    current.updateNode(input.id, { data: { kind: AUTOMATION_KIND.INPUT, path } });
  }, []);

  const run = useCallback(async () => {
    const current = useAutomationStore.getState();
    const definition = current.activeDefinition;
    if (!definition) {
      showWarning(t('automations.runNoDefinition'));
      return null;
    }
    const issues = current.validate();
    if (issues.length > 0) {
      showWarning(t('automations.validationFailed', { count: issues.length }));
      return null;
    }
    const invoke = window.electronAPI?.automationStart;
    if (!invoke) {
      const message = t('automations.runUnavailable');
      showToastError(message);
      showAppError(new Error(message));
      return null;
    }
    const input = definition.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
    const output = definition.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.OUTPUT);
    const runtime: AutomationRuntime = {
      inputPath: input?.data.kind === AUTOMATION_KIND.INPUT ? input.data.path : undefined,
      outputPath: output?.data.kind === AUTOMATION_KIND.OUTPUT ? output.data.path : undefined,
      mediaKind: input?.data.kind === AUTOMATION_KIND.INPUT ? input.data.mediaKind : undefined,
      availableBackends: AUTOMATION_BACKENDS.filter((backend) => current.backendStatus[backend]),
    };
    const request: AutomationStartRequest = { definition, runtime };
    try {
      const runId = await bridgePromise(() => invoke(request));
      if (typeof runId !== 'string' || runId.length === 0) {
        throw new Error(t('automations.runFailed'));
      }
      startRun(runId);
      showInfo(t('automations.runQueued'));
      return runId;
    } catch (err) {
      showToastError(t('automations.runFailed'));
      showAppError(err);
      return null;
    }
  }, [showAppError, showInfo, showToastError, showWarning, startRun, t]);

  const cancel = useCallback(
    async (runId: string) => {
      const invoke = window.electronAPI?.automationCancel;
      if (!invoke) {
        const message = t('automations.cancelUnavailable');
        showToastError(message);
        showAppError(new Error(message));
        return false;
      }
      try {
        const cancelled = await bridgePromise(() => invoke(runId));
        if (cancelled !== true) {
          showToastError(t('automations.cancelFailed'));
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
        showInfo(t('automations.runCancelled'));
        return true;
      } catch (err) {
        showToastError(t('automations.cancelFailed'));
        showAppError(err);
        return false;
      }
    },
    [showAppError, showInfo, showToastError, t],
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
    startRun,
    run,
    cancel,
  };
}
