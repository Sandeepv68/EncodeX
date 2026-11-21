/**
 * @fileoverview Executes compiled automation plans in the main process.
 */

import * as path from 'path';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { aggregateProgress } from '../queue/mux-job-runner';
import { checkBmfAvailable } from '../transcoders/bmf-availability';
import { compileAutomation } from '../../shared/automations/compile';
import { newAutomationRunId } from '../../shared/automations/defaults';
import { parseAutomationDefinition } from '../../shared/automations/schema';
import { createError, ErrorCode, ERROR_MESSAGES, cancelledError, formatError } from '../../shared/errors';
import type {
  AutomationDefinition,
  AutomationPlan,
  AutomationProgressEvent,
  AutomationRuntime,
  AutomationRunStatus,
  AutomationStep,
} from '../../shared/automations/types';
import { AutomationEventBus } from './events';
import { executeAutomationStep } from './step-executors';
import { cleanupAutomationIntermediates, ensureAutomationTempRoot } from './temp-files';
import type { ActiveAutomationRun, AutomationForwardSender, AutomationRunnerOptions, AutomationTranscoderFactory } from './types';

const log = new Logger('main/automations/runner');

function runEvent(
  runId: string,
  automationId: string,
  status: AutomationRunStatus,
  nodeId = '',
  extra: Partial<AutomationProgressEvent> = {},
): AutomationProgressEvent {
  return { runId, automationId, nodeId, status, ...extra };
}

function formatPlanError(plan: AutomationPlan): Error {
  const detail = plan.issues.map((issue) => issue.message).join('; ') || plan.summary;
  const appError = createError(ErrorCode.INVALID_FORMAT, ERROR_MESSAGES.INVALID_FORMAT, detail);
  const err = new Error(appError.message);
  err.name = 'AppError';
  (err as Error & { code?: string; detail?: string; timestamp?: number }).code = appError.code;
  (err as Error & { code?: string; detail?: string; timestamp?: number }).detail = appError.detail;
  (err as Error & { code?: string; detail?: string; timestamp?: number }).timestamp = appError.timestamp;
  return err;
}

function isCancelledError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === ErrorCode.CANCELLED;
}

export class AutomationRunner {
  private readonly eventBus: AutomationEventBus;
  private readonly transcoderFactory?: AutomationTranscoderFactory;
  private readonly checkBmfAvailability: () => { available: boolean; missing: string[] };
  private readonly runIdGenerator: () => string;
  private readonly activeRuns = new Map<string, ActiveAutomationRun>();

  constructor(private readonly options: AutomationRunnerOptions) {
    this.eventBus = options.eventBus ?? new AutomationEventBus();
    this.transcoderFactory = options.transcoderFactory;
    this.checkBmfAvailability = options.checkBmfAvailability ?? checkBmfAvailable;
    this.runIdGenerator = options.runIdGenerator ?? newAutomationRunId;
  }

  get events(): AutomationEventBus {
    return this.eventBus;
  }

  start(definition: AutomationDefinition, runtime: AutomationRuntime = {}): string {
    const parsed = parseAutomationDefinition(definition);
    const runId = this.runIdGenerator();
    const tempRoot = ensureAutomationTempRoot({
      userDataDir: this.options.userDataDir,
      settings: parsed.settings,
      runtimeTempRoot: runtime.tempRoot,
    });
    const plan = compileAutomation(parsed, { ...runtime, tempRoot: path.join(tempRoot, runId) });
    if (!plan.valid) {
      throw formatPlanError(plan);
    }

    const bmfStatus = this.checkBmfAvailability();
    const usesBmf = plan.steps.some((step) => (step.backend ?? parsed.settings.defaultBackend) === 'BMF');
    if (usesBmf && !bmfStatus.available) {
      throw createError(
        ErrorCode.BMF_NOT_AVAILABLE,
        ERROR_MESSAGES[ErrorCode.BMF_NOT_AVAILABLE],
        `Missing BMF tools: ${bmfStatus.missing.join(', ')}`,
      );
    }

    const active: ActiveAutomationRun = { runId, automationId: parsed.id, cancelled: false };
    this.activeRuns.set(runId, active);

    this.eventBus.emitStatus(runEvent(runId, parsed.id, 'queued'));
    this.eventBus.emitProgress(runEvent(runId, parsed.id, 'queued', '', { progress: 0 }));

    void this.executePlan(active, parsed, plan).finally(() => {
      this.activeRuns.delete(runId);
    });

    return runId;
  }

  cancel(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) return false;
    active.cancelled = true;
    active.cancelCurrent?.();
    return true;
  }

  private emitRun(active: ActiveAutomationRun, status: AutomationRunStatus, extra: Partial<AutomationProgressEvent> = {}): void {
    const payload = runEvent(active.runId, active.automationId, status, '', extra);
    this.eventBus.emitStatus(payload);
    this.eventBus.emitProgress(payload);
  }

  private emitNode(
    active: ActiveAutomationRun,
    step: AutomationStep,
    status: AutomationRunStatus,
    extra: Partial<AutomationProgressEvent> = {},
  ): void {
    const payload = runEvent(active.runId, active.automationId, status, step.nodeId, { stageId: step.stageId, ...extra });
    this.eventBus.emitStatus(payload);
    this.eventBus.emitProgress(payload);
  }

  private async executePlan(active: ActiveAutomationRun, definition: AutomationDefinition, plan: AutomationPlan): Promise<void> {
    const intermediates: string[] = [];
    const completedOutputs = new Map<string, string>();
    let currentInput = plan.inputPath;
    let failed = false;
    let cancelled = false;

    this.emitRun(active, 'running', { progress: 0, message: 'Running automation' });

    try {
      if (!currentInput) {
        throw createError(ErrorCode.INPUT_NOT_SPECIFIED, ERROR_MESSAGES.INPUT_NOT_SPECIFIED);
      }
      if (active.cancelled) throw cancelledError();

      for (let index = 0; index < plan.steps.length; index += 1) {
        const step = plan.steps[index];
        if (active.cancelled) {
          this.emitNode(active, step, 'cancelled', { message: 'Cancelled' });
          for (const remaining of plan.steps.slice(index + 1)) {
            this.emitNode(active, remaining, 'cancelled', { message: 'Cancelled' });
          }
          cancelled = true;
          break;
        }

        this.emitNode(active, step, 'running', { progress: aggregateProgress(index, plan.steps.length, 0) });
        const execution = executeAutomationStep(
          step,
          currentInput,
          (progress) => {
            const percent = aggregateProgress(index, plan.steps.length, progress.percent ?? 0);
            this.emitNode(active, step, 'running', { progress: percent, message: progress.time });
            this.emitRun(active, 'running', { progress: percent, message: `Running ${step.kind}` });
          },
          this.transcoderFactory,
        );
        active.cancelCurrent = execution.cancel;

        try {
          await execution.promise;
        } finally {
          if (active.cancelCurrent === execution.cancel) active.cancelCurrent = undefined;
        }

        if (active.cancelled) {
          this.emitNode(active, step, 'cancelled', { message: 'Cancelled' });
          for (const remaining of plan.steps.slice(index + 1)) {
            this.emitNode(active, remaining, 'cancelled', { message: 'Cancelled' });
          }
          cancelled = true;
          break;
        }

        completedOutputs.set(step.nodeId, step.outputPath);
        if (index < plan.steps.length - 1) intermediates.push(step.outputPath);
        currentInput = step.outputPath;
        const percent = aggregateProgress(index, plan.steps.length, 100);
        this.emitNode(active, step, 'succeeded', { progress: percent, outputPath: step.outputPath });
        this.emitRun(active, 'running', { progress: percent });
      }

      if (cancelled || active.cancelled) {
        this.emitRun(active, 'cancelled', { message: 'Automation cancelled' });
        return;
      }

      this.emitRun(active, 'succeeded', { progress: 100, outputPath: plan.outputPath, message: 'Automation completed' });
    } catch (err) {
      failed = true;
      const formatted = formatError(err);
      const wasCancelled = active.cancelled || isCancelledError(err) || isCancelledError(formatted);
      if (wasCancelled) {
        const currentIndex = plan.steps.findIndex((step) => !completedOutputs.has(step.nodeId) && step.outputPath !== currentInput);
        for (const step of plan.steps) {
          if (!completedOutputs.has(step.nodeId)) {
            this.emitNode(active, step, 'cancelled', { message: 'Cancelled' });
          }
        }
        this.emitRun(active, 'cancelled', { message: 'Automation cancelled', error: formatted.message });
        return;
      }

      const remaining = plan.steps.filter((step) => !completedOutputs.has(step.nodeId));
      for (const step of remaining) {
        const status: AutomationRunStatus = step === remaining[0] ? 'failed' : 'cancelled';
        this.emitNode(
          active,
          step,
          status,
          status === 'failed' ? { error: formatted.message, message: formatted.message } : { message: 'Cancelled' },
        );
      }
      this.emitRun(active, 'failed', { error: formatted.message, message: formatted.message });
      log.error('Automation run failed', formatted);
    } finally {
      cleanupAutomationIntermediates(intermediates, definition.settings.keepIntermediateFiles);
      if (failed) {
        // intermediates already cleaned; final output may be partial by design of transcoder.
      }
    }
  }
}

/** Forwards runner events to IPC push channels. */
export function forwardAutomationEvents(runner: AutomationRunner, send: AutomationForwardSender): void {
  runner.events.on('status', (payload: AutomationProgressEvent) => send(IPC.AUTOMATION_STATUS, payload));
  runner.events.on('progress', (payload: AutomationProgressEvent) => send(IPC.AUTOMATION_PROGRESS, payload));
  runner.events.on('event', (event: { payload: AutomationProgressEvent }) => send(IPC.AUTOMATION_EVENT, event.payload));
}
