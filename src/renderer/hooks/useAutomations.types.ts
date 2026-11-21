import type { AutomationDefinition } from '../../shared/automations/types';
import type { AutomationState } from '../stores/types';

export type UseAutomationsResult = Omit<
  AutomationState,
  | 'initialize'
  | 'saveAutomation'
  | 'saveAutomationAs'
  | 'loadAutomation'
  | 'deleteAutomation'
  | 'duplicateAutomation'
  | 'importAutomation'
  | 'exportAutomation'
> & {
  initialize: () => Promise<AutomationDefinition[]>;
  saveAutomation: () => Promise<AutomationDefinition | null>;
  saveAutomationAs: (name: string) => Promise<AutomationDefinition | null>;
  loadAutomation: (id: string) => Promise<AutomationDefinition | null>;
  deleteAutomation: (id: string) => Promise<boolean>;
  duplicateAutomation: (id: string) => Promise<AutomationDefinition | null>;
  importAutomation: () => Promise<AutomationDefinition | null>;
  exportAutomation: (id: string) => Promise<string | null>;
  selectInput: () => Promise<void>;
  run: () => Promise<string | null>;
  cancel: (runId: string) => Promise<boolean>;
};
