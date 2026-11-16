/**
 * @fileoverview React provider that gives a view its data and its tool calls.
 *
 * The provider owns the "latest payload" state. The host pushes payloads in
 * (a `ui/notifications/tool-result` notification, or the result of a polling
 * call); the view reads the current payload and calls tools through the same
 * provider. That keeps every view a pure function of the payload, which is
 * what makes the same component renderable by an external host and by the
 * in-app transcript.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { structuredPayload, type McpViewProviderProps, type McpViewState, type McpViewToolResult } from './host';
import type { McpViewCallOptions } from './types';

const McpViewContext = createContext<McpViewState | null>(null);

/**
 * Provides the view state to a view tree.
 * @param {McpViewProviderProps} props - Component props.
 * @returns {JSX.Element} The provider.
 */
export function McpViewProvider({ host, initialData, children }: McpViewProviderProps) {
  const [data, setData] = useState<unknown>(initialData);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  // The last payload that was written, serialized. A poll that returns the
  // same thing must not invalidate the context: every write creates a new
  // context value and re-renders the whole view.
  const payloadKeyRef = useRef<string | undefined>(undefined);

  /**
   * Writes a payload, skipping the write when the payload is unchanged.
   * @param {unknown} payload - The payload to publish.
   * @returns {void}
   */
  const publish = useCallback((payload: unknown): void => {
    // An empty payload carries no information; publishing it would wipe the
    // view (a poll that answers with an empty result would blank the card).
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0) return;
    let key: string;
    try {
      key = JSON.stringify(payload) ?? 'undefined';
    } catch {
      // A payload that cannot be serialized is always published: the equality
      // check cannot tell two of them apart.
      key = `unserializable:${payloadKeyRef.current ?? ''}`;
    }
    if (key === payloadKeyRef.current) return;
    payloadKeyRef.current = key;
    setData(payload);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = host.subscribe((result: McpViewToolResult) => {
      const payload = structuredPayload(result);
      if (payload !== undefined && mountedRef.current) publish(payload);
    });
    return unsubscribe;
  }, [host, publish]);

  const callTool = useCallback(
    async (name: string, args?: Record<string, unknown>, options?: McpViewCallOptions): Promise<McpViewToolResult> => {
      // A silent call is a background poll: it must not flip the view into a
      // busy state and a dropped poll must not leave a permanent error behind.
      const silent = options?.silent === true;
      if (!silent) {
        setBusy(true);
        setError(undefined);
      }
      try {
        const result = await host.callTool(name, args);
        const payload = structuredPayload(result);
        if (payload !== undefined && mountedRef.current) publish(payload);
        if (!silent && result.isError && mountedRef.current) {
          setError(result.content?.map((block) => block.text ?? '').join('') || 'error');
        }
        return result;
      } catch (err) {
        if (!silent && mountedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        }
        throw err;
      } finally {
        if (!silent && mountedRef.current) setBusy(false);
      }
    },
    [host, publish],
  );

  const value = useMemo<McpViewState>(() => ({ data, error, busy, callTool, setData, host }), [data, error, busy, callTool, host]);

  return <McpViewContext.Provider value={value}>{children}</McpViewContext.Provider>;
}

/**
 * Reads the view state.
 * @returns {McpViewState} The view state.
 * @throws {Error} When used outside an {@link McpViewProvider}.
 */
export function useMcpView(): McpViewState {
  const state = useContext(McpViewContext);
  if (!state) {
    throw new Error('useMcpView must be used inside an McpViewProvider');
  }
  return state;
}

/**
 * Reads the current payload as a typed record.
 * @template T - The payload shape.
 * @returns {T | undefined} The payload, or undefined when nothing arrived yet.
 */
export function useMcpViewData<T>(): T | undefined {
  const { data } = useMcpView();
  if (!data || typeof data !== 'object') return undefined;
  return data as T;
}
