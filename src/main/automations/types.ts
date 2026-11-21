/**
 * @fileoverview Types for main-process automation runtime modules.
 */

import type { IpcSender } from '../ipc/types';
import type { ITranscoder } from '../transcoders/types';
import type { AutomationProgressEvent, AutomationSettings } from '../../shared/automations/types';
import type { TranscoderType } from '../../shared/types';

export type AutomationEventKind = 'status' | 'progress' | 'event';

export interface AutomationBusEvent {
  kind: AutomationEventKind;
  payload: AutomationProgressEvent;
}

export interface ActiveAutomationRun {
  runId: string;
  automationId: string;
  runDirectory: string;
  keepIntermediateFiles: boolean;
  cancelled: boolean;
  terminal: boolean;
  cancelCurrent?: () => void;
}

export type AutomationTranscoderFactory = (type: TranscoderType) => ITranscoder;

export interface AutomationStepExecution {
  promise: Promise<void>;
  cancel: () => void;
}

export interface AutomationTempContext {
  userDataDir: string;
  settings: Pick<AutomationSettings, 'tempDirectoryMode' | 'keepIntermediateFiles'>;
  runtimeTempRoot?: string;
}

export interface AutomationRunnerOptions {
  userDataDir: string;
  eventBus?: import('./events').AutomationEventBus;
  transcoderFactory?: AutomationTranscoderFactory;
  checkBmfAvailability?: () => { available: boolean; missing: string[] };
  runIdGenerator?: () => string;
}

export type AutomationForwardSender = IpcSender;
