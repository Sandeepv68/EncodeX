/**
 * @fileoverview Types shared by Automations React Flow components.
 */

import type { Node } from '@xyflow/react';
import type { AutomationIssueCode, AutomationNode, AutomationNodeKind, AutomationRunStatus } from '../../../shared/automations/types';

/** MIME type used to move node kinds from the palette onto the canvas. */
export const AUTOMATION_DND_MIME = 'application/x-encodex-automation-node';

/** Data attached to every custom React Flow node. */
export interface AutomationFlowNodeData extends Record<string, unknown> {
  automationNode: AutomationNode;
  label: string;
  status?: AutomationRunStatus;
  issueCodes: AutomationIssueCode[];
}

/** React Flow node specialised for the automation editor. */
export type AutomationFlowNode = Node<AutomationFlowNodeData, AutomationNodeKind>;

/** Props received by every custom automation node component. */
export type AutomationNodeComponentProps = { data: AutomationFlowNodeData; selected?: boolean };
