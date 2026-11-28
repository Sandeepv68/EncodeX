/**
 * @fileoverview Executes compiled automation plans in the main process.
 */

import { Logger } from '../../shared/logger';
import { LOG_HISTORY_RECORD_FAILED } from '../../shared/log-constants';
import { IPC } from '../../shared/ipc-channels';
import { aggregateProgress } from '../queue/mux-job-runner';
import { checkBmfAvailable } from '../transcoders/bmf-availability';
import { compileAutomation } from '../../shared/automations/compile';
import { newAutomationRunId } from '../../shared/automations/defaults';
import { parseAutomationDefinition } from '../../shared/automations/schema';
import { HISTORY_LIMITS } from '../../shared/history/limits';
import type { HistoryStatus } from '../../shared/history/types';
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
import { cleanupAutomationRunDirectory, ensureAutomationRunDirectory, resolveAutomationRunDirectory } from './temp-files';
import type { ActiveAutomationRun, AutomationForwardSender, AutomationRunnerOptions, AutomationTranscoderFactory } from './types';

const log = new Logger('main/automations/runner');
const activeRunners = new Set<AutomationRunner>();

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

function historyStatus(status: AutomationRunStatus): HistoryStatus | undefined {
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') return status;
  return undefined;
}

function historyError(err: unknown): string | undefined {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
}

function historyErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export class AutomationRunner {
  private readonly eventBus: AutomationEventBus;
  private readonly historyRecorder?: AutomationRunnerOptions['historyRecorder'];
  private readonly transcoderFactory?: AutomationTranscoderFactory;
  private readonly checkBmfAvailability: () => { available: boolean; missing: string[] };
  private readonly runIdGenerator: () => string;
  private readonly activeRuns = new Map<string, ActiveAutomationRun>();

  constructor(private readonly options: AutomationRunnerOptions) {
    this.eventBus = options.eventBus ?? new AutomationEventBus();
    this.historyRecorder = options.historyRecorder;
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
    const tempContext = {
      userDataDir: this.options.userDataDir,
      settings: parsed.settings,
      runtimeTempRoot: runtime.tempRoot,
    };
    const runDirectory = resolveAutomationRunDirectory(tempContext, runId);
    const plan = compileAutomation(parsed, { ...runtime, tempRoot: runDirectory });
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

    ensureAutomationRunDirectory(tempContext, runId);
    const active: ActiveAutomationRun = {
      runId,
      automationId: parsed.id,
      automationName: parsed.name,
      inputPath: plan.inputPath,
      outputPath: plan.outputPath,
      stepCount: plan.steps.length,
      startedAt: Date.now(),
      runDirectory,
      keepIntermediateFiles: parsed.settings.keepIntermediateFiles,
      cancelled: false,
      terminal: false,
    };
    this.activeRuns.set(runId, active);
    activeRunners.add(this);

    this.eventBus.emitStatus(runEvent(runId, parsed.id, 'queued'));
    this.eventBus.emitProgress(runEvent(runId, parsed.id, 'queued', '', { progress: 0 }));

    void this.executePlan(active, parsed, plan)
      .catch((err) => {
        log.error('Automation run crashed', err);
      })
      .finally(() => {
        active.terminal = true;
        active.cancelCurrent = undefined;
        this.activeRuns.delete(runId);
        if (this.activeRuns.size === 0) activeRunners.delete(this);
      });

    return runId;
  }

  cancel(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active || active.terminal) return false;
    if (active.cancelled) return true;
    active.cancelled = true;
    const cancelCurrent = active.cancelCurrent;
    active.cancelCurrent = undefined;
    cancelCurrent?.();
    return true;
  }

  cancelAll(): number {
    let count = 0;
    for (const active of [...this.activeRuns.values()]) {
      if (this.cancel(active.runId)) count += 1;
      cleanupAutomationRunDirectory(active.runDirectory, active.keepIntermediateFiles);
    }
    if (this.activeRuns.size === 0) activeRunners.delete(this);
    return count;
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
    if (active.terminal) return;
    const payload = runEvent(active.runId, active.automationId, status, step.nodeId, { stageId: step.stageId, ...extra });
    this.eventBus.emitStatus(payload);
    this.eventBus.emitProgress(payload);
  }

  private recordHistory(active: ActiveAutomationRun, status: AutomationRunStatus, extra: Partial<AutomationProgressEvent>): void {
    const recorder = this.historyRecorder;
    const entryStatus = historyStatus(status);
    if (!recorder || !entryStatus) return;
    const message = extra.error ? historyError(extra.error) : undefined;
    const code = extra.error ? historyErrorCode(extra.error) : undefined;
    const outputs = [...new Set([active.outputPath, extra.outputPath].filter(Boolean))] as string[];
    void recorder
      .record({
        family: 'automation',
        source: 'automation',
        status: entryStatus,
        startedAt: active.startedAt,
        finishedAt: Date.now(),
        inputs: active.inputPath ? [active.inputPath] : [],
        outputs: outputs.slice(0, HISTORY_LIMITS.maxPaths),
        runId: active.runId,
        metadata: {
          automationId: active.automationId,
          ...(active.automationName ? { automationName: active.automationName } : {}),
          ...(active.stepCount !== undefined ? { steps: active.stepCount } : {}),
        },
        ...(message ? { error: { message, ...(code ? { code } : {}) } } : {}),
      })
      .catch((recordError: unknown) => {
        log.warn(LOG_HISTORY_RECORD_FAILED, active.runId, historyError(recordError) ?? String(recordError));
      });
  }

  private finishRun(active: ActiveAutomationRun, status: AutomationRunStatus, extra: Partial<AutomationProgressEvent> = {}): void {
    if (active.terminal) return;
    active.terminal = true;
    active.cancelCurrent = undefined;
    this.emitRun(active, status, extra);
    this.recordHistory(active, status, extra);
  }

  private async executePlan(active: ActiveAutomationRun, definition: AutomationDefinition, plan: AutomationPlan): Promise<void> {
    const completedOutputs = new Map<string, string>();
    let currentInput = plan.inputPath;
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
        currentInput = step.outputPath;
        const percent = aggregateProgress(index, plan.steps.length, 100);
        this.emitNode(active, step, 'succeeded', { progress: percent, outputPath: step.outputPath });
        this.emitRun(active, 'running', { progress: percent });
      }

      if (cancelled || active.cancelled) {
        this.finishRun(active, 'cancelled', { message: 'Automation cancelled' });
        return;
      }

      this.finishRun(active, 'succeeded', { progress: 100, outputPath: plan.outputPath, message: 'Automation completed' });
    } catch (err) {
      const formatted = formatError(err);
      const wasCancelled = active.cancelled || isCancelledError(err) || isCancelledError(formatted);
      if (wasCancelled) {
        for (const step of plan.steps) {
          if (!completedOutputs.has(step.nodeId)) {
            this.emitNode(active, step, 'cancelled', { message: 'Cancelled' });
          }
        }
        this.finishRun(active, 'cancelled', { message: 'Automation cancelled', error: formatted.message });
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
      this.finishRun(active, 'failed', { error: formatted.message, message: formatted.message });
      log.error('Automation run failed', formatted);
    } finally {
      cleanupAutomationRunDirectory(active.runDirectory, definition.settings.keepIntermediateFiles);
    }
  }
}

export function cancelAllAutomationRuns(): number {
  let count = 0;
  for (const runner of [...activeRunners]) {
    count += runner.cancelAll();
  }
  return count;
}

/** Forwards runner events to IPC push channels. */
export function forwardAutomationEvents(runner: AutomationRunner, send: AutomationForwardSender): void {
  runner.events.on('status', (payload: AutomationProgressEvent) => send(IPC.AUTOMATION_STATUS, payload));
  runner.events.on('progress', (payload: AutomationProgressEvent) => send(IPC.AUTOMATION_PROGRESS, payload));
  runner.events.on('event', (event: { payload: AutomationProgressEvent }) => send(IPC.AUTOMATION_EVENT, event.payload));
}
