import type { AutomationIssueCode, AutomationRunStatus } from '../../shared/automations/types';

export interface AutomationStatusProps {
  $status?: AutomationRunStatus;
  $selected?: boolean;
  $hasIssue?: boolean;
}

export interface KindBadgeProps {
  $code?: AutomationIssueCode;
}

export interface RunDetailProps {
  $error?: boolean;
}
