/**
 * @fileoverview Hook exposing the Automations editor store and its actions.
 *
 * Phase 1 wires graph editing, validation, and a local run placeholder. The
 * progress-event subscription and native execution are added in Phase 3,
 * together with the IPC channels, so this hook already centralises all run
 * entry points for the page.
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

  return { ...store, selectInput, run, cancel };
}
