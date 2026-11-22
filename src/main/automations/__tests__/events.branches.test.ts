import { describe, expect, it, vi } from 'vitest';
import { AutomationEventBus } from '../events';

describe('automation event bus', () => {
  it('emits kind-specific and generic events for all payload types', () => {
    const bus = new AutomationEventBus();
    const generic = vi.fn();
    const status = vi.fn();
    const progress = vi.fn();
    const event = vi.fn();
    bus.on('event', generic);
    bus.on('status', status);
    bus.on('progress', progress);
    bus.on('event', event);
    const payload = { runId: 'run-1', automationId: 'auto-1', nodeId: 'n1', status: 'running' as const };

    bus.emitStatus(payload);
    bus.emitProgress(payload);
    bus.emitEvent(payload);

    expect(status).toHaveBeenCalledWith(payload);
    expect(progress).toHaveBeenCalledWith(payload);
    expect(event).toHaveBeenCalledWith(payload);
    expect(generic).toHaveBeenCalledTimes(4);
    expect(generic).toHaveBeenNthCalledWith(1, { kind: 'status', payload });
    expect(generic).toHaveBeenNthCalledWith(2, { kind: 'progress', payload });
    expect(generic).toHaveBeenNthCalledWith(4, { kind: 'event', payload });
  });
});
