/** Draggable palette of node kinds for the Automations canvas. */

import { useTranslation } from 'react-i18next';
import {
  AUTOMATION_NODE_KINDS,
  automationOperationSupportsMedia,
  isExecutableAutomationNodeKind,
} from '../../../shared/automations/node-kinds';
import { AUTOMATION_KIND } from '../../../shared/automations/types';
import type { AutomationMediaKind } from '../../../shared/automations/types';
import { useAutomationStore } from '../../stores/automationStore';
import { EditorPanel, PaletteItem, PanelHint, PanelTitle } from '../../styles/Automations.styles';
import { AUTOMATION_DND_MIME } from './AutomationNode.types';
import type { DragEvent } from 'react';

/** Shows the available node kinds and supports click-to-add or drag-to-canvas. */
export default function AutomationNodePalette() {
  const { t } = useTranslation();
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const addNode = useAutomationStore((state) => state.addNode);
  const detectedMediaKind = useAutomationStore((state) => state.detectedMediaKind) ?? 'unknown';
  const inputNode = activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
  const inputMediaKind = inputNode?.data.kind === AUTOMATION_KIND.INPUT ? inputNode.data.mediaKind : undefined;
  const effectiveMediaKind: AutomationMediaKind = detectedMediaKind !== 'unknown' ? detectedMediaKind : (inputMediaKind ?? 'unknown');
  const isFiltered = effectiveMediaKind !== 'unknown';
  const visibleKinds = AUTOMATION_NODE_KINDS.filter(
    (kind) => !isExecutableAutomationNodeKind(kind) || !isFiltered || automationOperationSupportsMedia(kind, effectiveMediaKind),
  );

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
      <PanelTitle variant="h2">{t('automations.paletteTitle')}</PanelTitle>
      <PanelHint>{t('automations.paletteHint')}</PanelHint>
      {isFiltered && (
        <PanelHint>{t('automations.paletteFilteredHint', { mediaKind: t(`automations.mediaKind.${effectiveMediaKind}`) })}</PanelHint>
      )}
      {visibleKinds.map((kind) => (
        <PaletteItem
          key={kind}
          data-testid={`automation-palette-${kind}`}
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
