/**
 * @fileoverview Typed event bus for automation run status and progress.
 */

import { EventEmitter } from 'events';
import type { AutomationProgressEvent } from '../../shared/automations/types';
import type { AutomationBusEvent, AutomationEventKind } from './types';

/**
 * Emits automation events on kind-specific channels and on a generic `event`
 * channel so IPC forwarding can subscribe once.
 */
export class AutomationEventBus extends EventEmitter {
  emitStatus(payload: AutomationProgressEvent): void {
    this.emitKind('status', payload);
  }

  emitProgress(payload: AutomationProgressEvent): void {
    this.emitKind('progress', payload);
  }

  emitEvent(payload: AutomationProgressEvent): void {
    this.emitKind('event', payload);
  }

  private emitKind(kind: AutomationEventKind, payload: AutomationProgressEvent): void {
    this.emit(kind, payload);
    this.emit('event', { kind, payload } satisfies AutomationBusEvent);
  }
}
