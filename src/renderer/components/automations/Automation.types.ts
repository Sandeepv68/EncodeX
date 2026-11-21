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
  onSaveAs: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
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
