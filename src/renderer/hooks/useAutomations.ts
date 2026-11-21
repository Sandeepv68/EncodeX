/**
 * @fileoverview Hook exposing the Automations editor store and its actions.
 *
 * Graph editing, validation, and library persistence are centralised here so
 * the page and its child components share one UI-safe action surface. The
 * wrappers turn failed bridge calls into error toasts and return the same safe
 * values as the store. Native run progress arrives in a later phase.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutomationStore } from '../stores/automationStore';
import { useToastStore } from '../stores/toastStore';
import { openFileDialog } from '../utils/fileDialog';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import type { AutomationProgressEvent } from '../../shared/automations/types';
import { newAutomationRunId } from '../../shared/automations/defaults';
import type { UseAutomationsResult } from './useAutomations.types';

/** Hook used by the Automations page and its child components. */
export function useAutomations(): UseAutomationsResult {
  const store = useAutomationStore();
  const { t } = useTranslation();
  const showWarning = useToastStore((state) => state.warning);
  const showInfo = useToastStore((state) => state.info);
  const showSuccess = useToastStore((state) => state.success);
  const showError = useToastStore((state) => state.error);

  const initialize = useCallback(() => useAutomationStore.getState().initialize(), []);

  const save = useCallback(async () => {
    const saved = await useAutomationStore.getState().saveAutomation();
    if (saved) showSuccess(t('automations.saveSuccess'));
    else showError(t('automations.saveFailed'));
    return saved;
  }, [showError, showSuccess, t]);

  const saveAs = useCallback(
    async (name: string) => {
      const saved = await useAutomationStore.getState().saveAutomationAs(name);
      if (saved) showSuccess(t('automations.saveAsSuccess', { name: saved.name }));
      else showError(t('automations.saveAsFailed'));
      return saved;
    },
    [showError, showSuccess, t],
  );

  const load = useCallback(
    async (id: string) => {
      const loaded = await useAutomationStore.getState().loadAutomation(id);
      if (loaded) showInfo(t('automations.loadSuccess', { name: loaded.name }));
      else showError(t('automations.loadFailed'));
      return loaded;
    },
    [showError, showInfo, t],
  );

  const remove = useCallback(
    async (id: string) => {
      const deleted = await useAutomationStore.getState().deleteAutomation(id);
      if (deleted) showSuccess(t('automations.deleteSuccess'));
      else showError(t('automations.deleteFailed'));
      return deleted;
    },
    [showError, showSuccess, t],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const duplicated = await useAutomationStore.getState().duplicateAutomation(id);
      if (duplicated) showSuccess(t('automations.duplicateSuccess', { name: duplicated.name }));
      else showError(t('automations.duplicateFailed'));
      return duplicated;
    },
    [showError, showSuccess, t],
  );

  const importDefinition = useCallback(async () => {
    const imported = await useAutomationStore.getState().importAutomation();
    if (imported) showSuccess(t('automations.importSuccess', { name: imported.name }));
    else showError(t('automations.importFailed'));
    return imported;
  }, [showError, showSuccess, t]);

  const exportDefinition = useCallback(
    async (id: string) => {
      const path = await useAutomationStore.getState().exportAutomation(id);
      if (path) showSuccess(t('automations.exportSuccess'));
      else showError(t('automations.exportFailed'));
      return path;
    },
    [showError, showSuccess, t],
  );

  const selectInput = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return;
    const current = useAutomationStore.getState();
    const input = current.activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
    if (!input) return;
    current.updateNode(input.id, { data: { kind: AUTOMATION_KIND.INPUT, path } });
  }, []);

  const run = useCallback(() => {
    const current = useAutomationStore.getState();
    const issues = current.validate();
    if (issues.length > 0) {
      showWarning(t('automations.validationFailed', { count: issues.length }));
      return null;
    }
    const runId = newAutomationRunId();
    current.startRun(runId);
    showInfo(t('automations.runQueued'));
    return runId;
  }, [showInfo, showWarning, t]);

  const cancel = useCallback(
    (runId: string) => {
      const event: AutomationProgressEvent = {
        runId,
        automationId: useAutomationStore.getState().activeDefinition?.id ?? '',
        nodeId: '',
        status: AUTOMATION_RUN_STATUS.CANCELLED,
        message: t('automations.runCancelled'),
      };
      useAutomationStore.getState().updateRun(event);
    },
    [t],
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
    run,
    cancel,
  };
}
