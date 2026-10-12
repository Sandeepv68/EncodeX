/**
 * @fileoverview MCP Tasks extension store for EncodeX.
 *
 * Implements the SDK's experimental `TaskStore` interface so `convert_media`
 * and `batch_convert` can be registered as task-based tools (`taskSupport:
 * 'optional'`). The tasks extension is a thin, backward-compatible receipt
 * layer: a tool call still enqueues its queue job(s) synchronously and returns
 * the same `jobId`/`status` payload as before, but that result is delivered as
 * a task whose terminal status and payload are available immediately. Task-aware
 * clients receive a `CreateTaskResult` and can read it back through `tasks/get`
 * and `tasks/result`; clients without the extension transparently auto-poll and
 * get the identical result.
 *
 * The store is intentionally in-memory: tasks are short-lived receipts over
 * jobs that themselves live in memory, and the spec's TTL cleanup drops them.
 */

import { randomUUID } from 'node:crypto';
import type { CallToolResult, Request, RequestId, Result } from '@modelcontextprotocol/sdk/types.js';
import type { CreateTaskOptions, TaskStore } from '@modelcontextprotocol/sdk/experimental/tasks';

/** Task lifecycle status from the MCP Tasks spec. */
export type MCPTaskStatus = 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';

/** Public, serializable view of a task (matches the SDK `Task` schema). */
export interface MCPTask {
  taskId: string;
  status: MCPTaskStatus;
  ttl: number | null;
  createdAt: string;
  lastUpdatedAt: string;
  pollInterval?: number;
  statusMessage?: string;
}

/** Internal record backing an {@link MCPTask}. */
interface TaskRecord {
  taskId: string;
  status: MCPTaskStatus;
  ttl: number | null;
  pollInterval?: number;
  createdAt: string;
  lastUpdatedAt: string;
  statusMessage?: string;
  sessionId?: string;
  result?: Result;
}

/** Construction options for {@link MCPTaskStore}. */
export interface MCPTaskStoreOptions {
  /** Task lifetime in ms before cleanup; {@link DEFAULT_TASK_TTL_MS} by default. */
  ttlMs?: number;
  /** Suggested client poll interval in ms; {@link DEFAULT_TASK_POLL_MS} by default. */
  pollIntervalMs?: number;
}

/** Default task lifetime (1 hour) before the record is dropped. */
export const DEFAULT_TASK_TTL_MS = 3_600_000;
/** Default suggested poll interval (1s) for task clients. */
export const DEFAULT_TASK_POLL_MS = 1_000;

/** A minimal terminal result used when a task completed without a stored payload. */
function emptyResult(): CallToolResult {
  return { content: [{ type: 'text', text: 'Task has no result.' }], isError: true };
}

/**
 * In-memory `TaskStore` holding immediately-terminal task receipts.
 * @class MCPTaskStore
 */
export class MCPTaskStore implements TaskStore {
  private readonly ttlMs: number;
  private readonly pollIntervalMs: number;
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * @param {MCPTaskStoreOptions} [options] - TTL and poll-interval overrides.
   */
  constructor(options: MCPTaskStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TASK_TTL_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_TASK_POLL_MS;
  }

  /**
   * Creates a `working` task record; callers generally follow with
   * {@link storeTaskResult} to make it terminal in the same turn.
   * @param {CreateTaskOptions} taskParams - Client-requested ttl/pollInterval.
   * @param {RequestId} _requestId - The originating request id (unused).
   * @param {Request} _request - The originating request (unused).
   * @param {string} [sessionId] - Session owning the task.
   * @returns {Promise<MCPTask>} The freshly created task view.
   */
  async createTask(taskParams: CreateTaskOptions, _requestId: RequestId, _request: Request, sessionId?: string): Promise<MCPTask> {
    const now = new Date().toISOString();
    const ttl = taskParams.ttl ?? this.ttlMs;
    const taskId = randomUUID();
    const record: TaskRecord = {
      taskId,
      status: 'working',
      ttl,
      pollInterval: taskParams.pollInterval ?? this.pollIntervalMs,
      createdAt: now,
      lastUpdatedAt: now,
    };
    if (sessionId !== undefined) {
      record.sessionId = sessionId;
    }
    this.tasks.set(taskId, record);
    if (typeof ttl === 'number' && ttl > 0) {
      const timer = setTimeout(() => this.drop(taskId), ttl);
      timer.unref?.();
      this.timers.set(taskId, timer);
    }
    return this.view(record);
  }

  /**
   * Returns the task for a session.
   * @param {string} taskId - Task id.
   * @param {string} [sessionId] - Caller session for isolation.
   * @returns {Promise<MCPTask | null>} The task, or null when absent/foreign.
   */
  async getTask(taskId: string, sessionId?: string): Promise<MCPTask | null> {
    const record = this.lookup(taskId, sessionId);
    return record ? this.view(record) : null;
  }

  /**
   * Stores the terminal result of a task and marks it terminal.
   * @param {string} taskId - Task id.
   * @param {'completed' | 'failed'} status - Terminal status.
   * @param {Result} result - The final tool result.
   * @param {string} [sessionId] - Caller session.
   * @returns {Promise<void>} Resolves once stored.
   */
  async storeTaskResult(taskId: string, status: 'completed' | 'failed', result: Result, sessionId?: string): Promise<void> {
    const record = this.lookup(taskId, sessionId);
    if (!record) throw new Error(`Task not found: ${taskId}`);
    record.status = status;
    record.result = result;
    record.lastUpdatedAt = new Date().toISOString();
  }

  /**
   * Returns the terminal result stored for a task.
   * @param {string} taskId - Task id.
   * @param {string} [sessionId] - Caller session.
   * @returns {Promise<Result>} The MCP tool result.
   */
  async getTaskResult(taskId: string, sessionId?: string): Promise<Result> {
    const record = this.lookup(taskId, sessionId);
    if (!record) throw new Error(`Task not found: ${taskId}`);
    return record.result ?? emptyResult();
  }

  /**
   * Updates a task's status and optional diagnostic message.
   * @param {string} taskId - Task id.
   * @param {MCPTaskStatus} status - New status.
   * @param {string} [statusMessage] - Optional diagnostic.
   * @param {string} [sessionId] - Caller session.
   * @returns {Promise<void>} Resolves once updated.
   */
  async updateTaskStatus(taskId: string, status: MCPTaskStatus, statusMessage?: string, sessionId?: string): Promise<void> {
    const record = this.lookup(taskId, sessionId);
    if (!record) throw new Error(`Task not found: ${taskId}`);
    record.status = status;
    if (statusMessage !== undefined) record.statusMessage = statusMessage;
    record.lastUpdatedAt = new Date().toISOString();
  }

  /**
   * Lists tasks visible to a session, oldest first.
   * @param {string} [cursor] - Pagination cursor (task index as string).
   * @param {string} [sessionId] - Caller session for isolation.
   * @returns {Promise<{ tasks: MCPTask[]; nextCursor?: string }>} Page of tasks.
   */
  async listTasks(cursor?: string, sessionId?: string): Promise<{ tasks: MCPTask[]; nextCursor?: string }> {
    const visible = [...this.tasks.values()].filter((record) => this.visible(record, sessionId));
    const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const page = visible.slice(start, start + 100);
    const nextStart = start + page.length;
    const result: { tasks: MCPTask[]; nextCursor?: string } = { tasks: page.map((record) => this.view(record)) };
    if (nextStart < visible.length) result.nextCursor = String(nextStart);
    return result;
  }

  /** Cancels all cleanup timers and drops every task. */
  cleanup(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.tasks.clear();
  }

  /** Finds a record if it belongs to the session (or the caller is unrestricted). */
  private lookup(taskId: string, sessionId?: string): TaskRecord | undefined {
    const record = this.tasks.get(taskId);
    if (!record) return undefined;
    return this.visible(record, sessionId) ? record : undefined;
  }

  /** A record is visible unless it belongs to a different session. */
  private visible(record: TaskRecord, sessionId?: string): boolean {
    if (sessionId === undefined) return true;
    return record.sessionId === undefined || record.sessionId === sessionId;
  }

  /** Builds the serializable task view. */
  private view(record: TaskRecord): MCPTask {
    const task: MCPTask = {
      taskId: record.taskId,
      status: record.status,
      ttl: record.ttl,
      createdAt: record.createdAt,
      lastUpdatedAt: record.lastUpdatedAt,
    };
    if (record.pollInterval !== undefined) task.pollInterval = record.pollInterval;
    if (record.statusMessage !== undefined) task.statusMessage = record.statusMessage;
    return task;
  }

  /** Removes a task and its cleanup timer. */
  private drop(taskId: string): void {
    this.tasks.delete(taskId);
    const timer = this.timers.get(taskId);
    if (timer) clearTimeout(timer);
    this.timers.delete(taskId);
  }
}
