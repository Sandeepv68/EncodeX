/**
 * @fileoverview Public main-process automation runtime exports.
 */

export { AutomationEventBus } from './events';
export { AutomationRunner, forwardAutomationEvents } from './runner';
export { cleanupAutomationIntermediates, ensureAutomationTempRoot, resolveAutomationTempRoot } from './temp-files';
export { conversionOptionsForStep, executeAutomationStep } from './step-executors';
