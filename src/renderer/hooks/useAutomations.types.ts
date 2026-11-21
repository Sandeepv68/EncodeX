import type { AutomationState } from '../stores/types';

export type UseAutomationsResult = AutomationState & {
  selectInput: () => Promise<void>;
  run: () => string | null;
  cancel: (runId: string) => void;
};
