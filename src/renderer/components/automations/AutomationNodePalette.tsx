/** Draggable palette of node kinds for the Automations canvas. */

import { useTranslation } from 'react-i18next';
import { AUTOMATION_NODE_KINDS } from '../../../shared/automations/node-kinds';
import { useAutomationStore } from '../../stores/automationStore';
import { EditorPanel, PaletteItem, PanelHint, PanelTitle } from '../../styles/Automations.styles';
import { AUTOMATION_DND_MIME } from './AutomationNode.types';
import type { DragEvent } from 'react';

/** Shows the available node kinds and supports click-to-add or drag-to-canvas. */
export default function AutomationNodePalette() {
  const { t } = useTranslation();
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const addNode = useAutomationStore((state) => state.addNode);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, kind: string) => {
    event.dataTransfer.setData(AUTOMATION_DND_MIME, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAdd = (kind: string) => {
    const count = activeDefinition?.graph.nodes.length ?? 0;
    addNode(kind as (typeof AUTOMATION_NODE_KINDS)[number], { x: 1, y: count * 2 });
  };

  return (
    <EditorPanel role="complementary" aria-label={t('automations.paletteLabel')}>
      <PanelTitle variant="subtitle1">{t('automations.paletteTitle')}</PanelTitle>
      <PanelHint>{t('automations.paletteHint')}</PanelHint>
      {AUTOMATION_NODE_KINDS.map((kind) => (
        <PaletteItem
          key={kind}
          draggable
          variant="text"
          onDragStart={(event) => handleDragStart(event, kind)}
          onClick={() => handleAdd(kind)}
          aria-label={t(`automations.node.${kind}`)}
        >
          {t(`automations.node.${kind}`)}
        </PaletteItem>
      ))}
    </EditorPanel>
  );
}
