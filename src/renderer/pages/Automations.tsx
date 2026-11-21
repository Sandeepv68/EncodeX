/**
 * @fileoverview Automations page: visual pipeline editor (Phase 1 shell).
 *
 * This page composes the shared editor store, React Flow canvas, node palette,
 * inspector, stage list, validation console, and local run panel. Persistence
 * and native execution are intentionally deferred to later phases.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider } from '@xyflow/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import PageContainer from '../components/PageContainer';
import AutomationCanvas from '../components/automations/AutomationCanvas';
import AutomationInspector from '../components/automations/AutomationInspector';
import AutomationLibraryDrawer from '../components/automations/AutomationLibraryDrawer';
import AutomationNodePalette from '../components/automations/AutomationNodePalette';
import AutomationRunPanel from '../components/automations/AutomationRunPanel';
import AutomationStageList from '../components/automations/AutomationStageList';
import AutomationToolbar from '../components/automations/AutomationToolbar';
import { useAutomations } from '../hooks/useAutomations';
import { EditorGrid, EditorLayout } from '../styles/Automations.styles';

/** Renders the `/automations` route. */
export default function Automations() {
  const { t } = useTranslation();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { activeDefinition, validationIssues, isDirty, newAutomation, renameAutomation, saveAutomation, selectInput, run } =
    useAutomations();

  useEffect(() => {
    if (!activeDefinition) newAutomation();
  }, [activeDefinition, newAutomation]);

  return (
    <PageContainer title={t('automations.title')} icon={<FontAwesomeIcon icon={faDiagramProject} />} paper={false} fill>
      <EditorLayout>
        <AutomationToolbar
          name={activeDefinition?.name ?? ''}
          issueCount={validationIssues.length}
          isDirty={isDirty}
          hasDefinition={!!activeDefinition}
          onRename={renameAutomation}
          onNew={() => {
            newAutomation();
            setLibraryOpen(false);
          }}
          onOpenLibrary={() => setLibraryOpen(true)}
          onSave={saveAutomation}
          onSelectInput={selectInput}
          onRun={run}
        />
        <EditorGrid>
          <AutomationNodePalette />
          <ReactFlowProvider>
            <AutomationCanvas />
          </ReactFlowProvider>
          <AutomationStageList />
        </EditorGrid>
        <AutomationInspector />
        <AutomationRunPanel />
      </EditorLayout>
      <AutomationLibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </PageContainer>
  );
}
