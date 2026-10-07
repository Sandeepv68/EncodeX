import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coalescingSubscription } from '../coalesce';

describe('coalescingSubscription', () => {
  const INTERVAL = 50;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Wires a fake push channel with a captured `emit`, so the tests drive events exactly the way the
   * preload's `ipcRenderer.on` handler does and can assert on the consumer callback and the
   * unsubscribe path together.
   */
  function openChannel<T>() {
    let emit: ((data: T) => void) | undefined;
    const unsubscribe = coalescingSubscription((fn) => {
      emit = fn;
      return () => {
        emit = undefined;
      };
    }, INTERVAL);
    const cb = vi.fn();
    const close = unsubscribe(cb);
    return {
      emit: (data: T) => {
        expect(emit, 'channel must be subscribed before emitting').toBeDefined();
        emit!(data);
      },
      cb,
      close,
    };
  }

  it('applies the first event in a window immediately', () => {
    const { emit, cb } = openChannel<number>();
    emit(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('collapses a burst into the latest event and delivers it when the window closes', () => {
    const { emit, cb, close } = openChannel<number>();
    emit(1);
    emit(2);
    emit(3);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(1);

    vi.advanceTimersByTime(INTERVAL);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(3);

    close();
  });

  it('never delivers the intermediate values of a collapsed burst', () => {
    const { emit, cb, close } = openChannel<number>();
    emit(1);
    emit(2);
    emit(3);
    emit(4);
    vi.advanceTimersByTime(INTERVAL);
    expect(cb.mock.calls.map(([v]) => v)).toEqual([1, 4]);
    close();
  });

  it('passes a quiet channel through immediately with no coalescing', () => {
    const { emit, cb, close } = openChannel<number>();
    emit(1);
    vi.advanceTimersByTime(INTERVAL + 1);
    emit(2);
    vi.advanceTimersByTime(INTERVAL + 1);
    emit(3);

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(([v]) => v)).toEqual([1, 2, 3]);

    close();
  });

  it('unsubscribe cancels a pending delivery so a torn-down consumer is not woken', () => {
    const { emit, cb, close } = openChannel<number>();
    emit(1);
    emit(2);
    close();

    vi.advanceTimersByTime(INTERVAL * 2);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(1);
  });

  it('a new window opens after a flush, so a later event is delivered immediately', () => {
    const { emit, cb, close } = openChannel<number>();
    emit(1);
    emit(2);
    vi.advanceTimersByTime(INTERVAL);
    expect(cb).toHaveBeenLastCalledWith(2);

    emit(3);
    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb).toHaveBeenLastCalledWith(3);

    close();
  });
});
