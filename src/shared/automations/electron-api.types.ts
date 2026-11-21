/**
 * @fileoverview Renderer bridge typings for the Phase 2 automation library API.
 *
 * Augments the exported `ElectronAPI` interface without editing renderer files.
 */

import type { AutomationDefinition, AutomationDuplicateRequest } from './types';

/** Automation methods added to `window.electronAPI`. */
export interface AutomationElectronApi {
  automationList(): Promise<AutomationDefinition[]>;
  automationGet(id: string): Promise<AutomationDefinition | null>;
  automationSave(definition: AutomationDefinition): Promise<AutomationDefinition>;
  automationDelete(id: string): Promise<boolean>;
  automationDuplicate(request: AutomationDuplicateRequest): Promise<AutomationDefinition | null>;
  automationImport(): Promise<AutomationDefinition | null>;
  automationExport(id: string): Promise<string | null>;
}

declare module '../../renderer/electron-api' {
  interface ElectronAPI extends AutomationElectronApi {}
}
