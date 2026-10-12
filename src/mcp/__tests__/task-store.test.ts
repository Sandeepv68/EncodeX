/**
 * @fileoverview Tests for the MCP Tasks extension store ({@link MCPTaskStore}).
 *
 * The store is a thin in-memory receipt layer over the queue job ids, so these
 * tests drive its full lifecycle: create -> get -> terminal result -> get result,
 * status updates, session isolation, pagination, TTL timers and cleanup.
 */

import { describe, it, expect } from 'vitest';
import { MCPTaskStore, DEFAULT_TASK_TTL_MS, DEFAULT_TASK_POLL_MS } from '../jobs/task-store';
import type { Result } from '@modelcontextprotocol/sdk/types.js';

/** A minimal tool result used as the stored task payload. */
function toolResult(): Result {
  return { content: [{ type: 'text', text: 'converted' }], isError: false };
}

describe('MCPTaskStore', () => {
  it('creates a working task with defaults and reads it back', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never);
    expect(task.status).toBe('working');
    expect(task.ttl).toBe(DEFAULT_TASK_TTL_MS);
    expect(task.pollInterval).toBe(DEFAULT_TASK_POLL_MS);
    expect(task.createdAt).toBe(task.lastUpdatedAt);

    const found = await store.getTask(task.taskId);
    expect(found?.taskId).toBe(task.taskId);
  });

  it('honors client ttl/pollInterval requests and stores an optional sessionId', async () => {
    const store = new MCPTaskStore({ ttlMs: 60_000, pollIntervalMs: 500 });
    const task = await store.createTask({ ttl: 1234, pollInterval: 300 }, 'req-1', {} as never, 'session-a');
    expect(task.ttl).toBe(1234);
    expect(task.pollInterval).toBe(300);
    expect(await store.getTask(task.taskId, 'session-a')).toMatchObject({ status: 'working' });
  });

  it('does not schedule a cleanup timer for a non-positive ttl', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({ ttl: 0 }, 'req-1', {} as never);
    expect(await store.getTask(task.taskId)).toMatchObject({ ttl: 0 });
  });

  it('stores a terminal result and returns it via getTaskResult', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never);
    await store.storeTaskResult(task.taskId, 'completed', toolResult());
    const result = await store.getTaskResult(task.taskId);
    expect(result).toEqual(toolResult());
  });

  it('returns the empty result when a task completed without a payload', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never);
    const result = await store.getTaskResult(task.taskId);
    expect((result as { content: unknown[] }).content).toEqual([{ type: 'text', text: 'Task has no result.' }]);
    expect((result as { isError: boolean }).isError).toBe(true);
  });

  it('updates status and an optional statusMessage', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never);
    await store.updateTaskStatus(task.taskId, 'input_required', 'transcoding');
    const updated = await store.getTask(task.taskId);
    expect(updated?.status).toBe('input_required');
    expect(updated?.statusMessage).toBe('transcoding');
  });

  it('isolates tasks by session', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never, 'alice');
    // A caller without a session is unrestricted and sees the task.
    expect(await store.getTask(task.taskId)).not.toBeNull();
    expect(await store.getTask(task.taskId, 'bob')).toBeNull();
    expect(await store.getTask(task.taskId, 'alice')).not.toBeNull();
    await expect(store.storeTaskResult(task.taskId, 'completed', toolResult(), 'bob')).rejects.toThrow(/Task not found/);
    await expect(store.getTaskResult(task.taskId, 'bob')).rejects.toThrow(/Task not found/);
    await expect(store.updateTaskStatus(task.taskId, 'failed', undefined, 'bob')).rejects.toThrow(/Task not found/);
  });

  it('treats a shared (session-less) task as visible to any session', async () => {
    const store = new MCPTaskStore();
    const task = await store.createTask({}, 'req-1', {} as never);
    expect(await store.getTask(task.taskId, 'carol')).not.toBeNull();
  });

  it('lists tasks oldest first and paginates with a cursor', async () => {
    const store = new MCPTaskStore();
    const first = await store.createTask({}, 'req-0', {} as never);
    const second = await store.createTask({}, 'req-1', {} as never);
    const small = await store.listTasks(undefined);
    expect(small.tasks.map((task) => task.taskId)).toEqual([first.taskId, second.taskId]);
    expect(small.nextCursor).toBeUndefined();

    const ids = [first.taskId, second.taskId];
    for (let index = 0; index < 100; index += 1) {
      const task = await store.createTask({}, `req-${index + 2}`, {} as never);
      ids.push(task.taskId);
    }
    const pageOne = await store.listTasks(undefined);
    expect(pageOne.tasks.map((task) => task.taskId)).toEqual(ids.slice(0, 100));
    expect(pageOne.nextCursor).toBe('100');

    const pageTwo = await store.listTasks(pageOne.nextCursor);
    expect(pageTwo.tasks.map((task) => task.taskId)).toEqual(ids.slice(100));
    expect(pageTwo.nextCursor).toBeUndefined();
  });

  it('only lists tasks that belong to the requesting session', async () => {
    const store = new MCPTaskStore();
    await store.createTask({}, 'req-1', {} as never, 'alice');
    await store.createTask({}, 'req-2', {} as never);
    expect((await store.listTasks(undefined, 'alice')).tasks).toHaveLength(2);
    expect((await store.listTasks(undefined, 'bob')).tasks).toHaveLength(1);
  });

  it('drops a task when its ttl timer fires', async () => {
    const store = new MCPTaskStore({ ttlMs: 5 });
    const task = await store.createTask({}, 'req-1', {} as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await store.getTask(task.taskId)).toBeNull();
  });

  it('cleanup clears every timer and task', async () => {
    const store = new MCPTaskStore();
    await store.createTask({}, 'req-1', {} as never);
    await store.createTask({}, 'req-2', {} as never);
    store.cleanup();
    expect((await store.listTasks()).tasks).toHaveLength(0);
  });

  it('throws when updating or reading a task that does not exist', async () => {
    const store = new MCPTaskStore();
    await expect(store.storeTaskResult('missing', 'completed', toolResult())).rejects.toThrow(/Task not found: missing/);
    await expect(store.getTaskResult('missing')).rejects.toThrow(/Task not found: missing/);
    await expect(store.updateTaskStatus('missing', 'failed')).rejects.toThrow(/Task not found: missing/);
  });
});
