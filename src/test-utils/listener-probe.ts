/**
 * @fileoverview Shared window/document listener-count probe for leak suites.
 *
 * Counts live `window` and `document` event listeners by identity, so a
 * listener that is re-registered on every mount/unmount (or route change, or
 * hotkey re-bind) and never released shows up as a growing count. Used by the
 * Phase 4.5 mount/unmount leak suite and the Phase 8 rapid route-change suite.
 *
 * jsdom installs `addEventListener` as an **own property of the window
 * object**, so patching `EventTarget.prototype` alone silently misses every
 * `window.addEventListener(...)` call - which is where the components under
 * test register. Both the prototype and the own window properties are patched.
 */

/**
 * Widened signature for jsdom's own `window.addEventListener`/`removeEventListener`.
 * The `Window` interface types them as an overload list with no `| null`
 * parameter, so the originals are captured through this type and cast back on
 * restore.
 */
type WindowListenerFn = (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) => void;

/** Live `window`/`document` listeners, keyed `${target}:${type}`. */
export interface ListenerProbe {
  counts(): Record<string, number>;
  restore(): void;
}

/**
 * Installs the listener-counting probe over `EventTarget.prototype` and the
 * own `window` `add/removeEventListener` properties.
 * @returns {ListenerProbe} The probe and its `restore`.
 */
export function installListenerProbe(): ListenerProbe {
  const live = new Map<string, Set<number>>();
  const ids = new WeakMap<object, number>();
  let nextId = 0;
  const idOf = (listener: object): number => {
    let id = ids.get(listener);
    if (id === undefined) {
      nextId += 1;
      id = nextId;
      ids.set(listener, id);
    }
    return id;
  };
  const labelOf = (target: unknown): string | null => {
    if (target === window) return 'window';
    if (target === document) return 'document';
    return null;
  };
  const record = (targetLabel: string, type: string, listener: object): void => {
    const key = `${targetLabel}:${type}`;
    let set = live.get(key);
    if (set === undefined) {
      set = new Set();
      live.set(key, set);
    }
    set.add(idOf(listener));
  };
  const forget = (targetLabel: string, type: string, listener: object): void => {
    const key = `${targetLabel}:${type}`;
    const set = live.get(key);
    if (set !== undefined) {
      set.delete(idOf(listener));
      if (set.size === 0) live.delete(key);
    }
  };

  const protoAdd = EventTarget.prototype.addEventListener;
  const protoRemove = EventTarget.prototype.removeEventListener;
  const windowAdd = window.addEventListener as unknown as WindowListenerFn;
  const windowRemove = window.removeEventListener as unknown as WindowListenerFn;

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const label = labelOf(this);
    if (label !== null && listener !== null) record(label, type, listener);
    protoAdd.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    const label = labelOf(this);
    if (label !== null && listener !== null) forget(label, type, listener);
    protoRemove.call(this, type, listener, options);
  };

  window.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener !== null) record('window', type, listener);
    windowAdd.call(window, type, listener, options);
  } as typeof window.addEventListener;

  window.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener !== null) forget('window', type, listener);
    windowRemove.call(window, type, listener, options);
  } as typeof window.removeEventListener;

  return {
    counts() {
      return Object.fromEntries([...live].map(([key, set]) => [key, set.size]));
    },
    restore() {
      EventTarget.prototype.addEventListener = protoAdd;
      EventTarget.prototype.removeEventListener = protoRemove;
      window.addEventListener = windowAdd as unknown as typeof window.addEventListener;
      window.removeEventListener = windowRemove as unknown as typeof window.removeEventListener;
    },
  };
}
