import type { AutomationBackend, AutomationNode } from '../../../shared/automations/types';

export interface AutomationToolbarProps {
  name: string;
  issueCount: number;
  isDirty: boolean;
  hasDefinition: boolean;
  onRename: (name: string) => void;
  onNew: () => void;
  onOpenLibrary: () => void;
  onSave: () => void;
  onSelectInput: () => void;
  onRun: () => void;
}

export interface AutomationLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export interface AutomationOperationFieldsProps {
  node: AutomationNode;
  defaultBackend: AutomationBackend;
}
