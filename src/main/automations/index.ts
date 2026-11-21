/**
 * @fileoverview Public main-process automation runtime exports.
 */

export { AutomationEventBus } from './events';
export { AutomationRunner, cancelAllAutomationRuns, forwardAutomationEvents } from './runner';
export {
  cleanupAutomationIntermediates,
  cleanupAutomationRunDirectory,
  ensureAutomationRunDirectory,
  ensureAutomationTempRoot,
  resolveAutomationRunDirectory,
  resolveAutomationTempRoot,
} from './temp-files';
export { conversionOptionsForStep, executeAutomationStep } from './step-executors';
