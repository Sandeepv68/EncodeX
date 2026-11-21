/** Operation node rendered on the Automations React Flow canvas. */

import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AUTOMATION_RUN_STATUS } from '../../../../shared/automations/types';
import type { AutomationFlowNode } from '../AutomationNode.types';
import { KindBadge, NodeCard, NodeHeader, StatusChip } from '../../../styles/Automations.styles';

/** Renders an executable automation operation node. */
export default function OperationNode({ id, data, selected }: NodeProps<AutomationFlowNode>) {
  const { t } = useTranslation();
  return (
    <NodeCard
      data-testid={`automation-canvas-node-${id}`}
      $selected={selected}
      $status={data.status}
      $hasIssue={data.issueCodes.length > 0}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <NodeHeader>
        <Typography variant="subtitle2">{data.label}</Typography>
        <StatusChip
          label={t(`automations.status.${data.status ?? AUTOMATION_RUN_STATUS.QUEUED}`)}
          $status={data.status ?? AUTOMATION_RUN_STATUS.QUEUED}
          variant="outlined"
        />
      </NodeHeader>
      <KindBadge $code={data.issueCodes[0]}>{t(`automations.node.${data.automationNode.kind}`)}</KindBadge>
    </NodeCard>
  );
}
