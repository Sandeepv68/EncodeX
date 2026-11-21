/**
 * @fileoverview Renderer bridge typings for the automation library and run APIs.
 *
 * Augments the exported `ElectronAPI` interface without editing renderer files.
 */

import type { AutomationDefinition, AutomationDuplicateRequest, AutomationProgressEvent, AutomationStartRequest } from './types';

/** Automation methods added to `window.electronAPI`. */
export interface AutomationElectronApi {
  automationList(): Promise<AutomationDefinition[]>;
  automationGet(id: string): Promise<AutomationDefinition | null>;
  automationSave(definition: AutomationDefinition): Promise<AutomationDefinition>;
  automationDelete(id: string): Promise<boolean>;
  automationDuplicate(request: AutomationDuplicateRequest): Promise<AutomationDefinition | null>;
  automationImport(): Promise<AutomationDefinition | null>;
  automationExport(id: string): Promise<string | null>;
  automationStart(request: AutomationStartRequest): Promise<string>;
  automationCancel(runId: string): Promise<boolean>;
  onAutomationStatus(cb: (event: AutomationProgressEvent) => void): () => void;
  onAutomationProgress(cb: (event: AutomationProgressEvent) => void): () => void;
  onAutomationEvent(cb: (event: AutomationProgressEvent) => void): () => void;
}

declare module '../../renderer/electron-api' {
  interface ElectronAPI extends AutomationElectronApi {}
}
