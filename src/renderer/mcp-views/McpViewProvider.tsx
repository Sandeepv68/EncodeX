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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = host.subscribe((result: McpViewToolResult) => {
      const payload = structuredPayload(result);
      if (payload !== undefined && mountedRef.current) setData(payload);
    });
    return unsubscribe;
  }, [host]);

  const callTool = useCallback(
    async (name: string, args?: Record<string, unknown>): Promise<McpViewToolResult> => {
      setBusy(true);
      setError(undefined);
      try {
        const result = await host.callTool(name, args);
        const payload = structuredPayload(result);
        if (payload !== undefined && mountedRef.current) setData(payload);
        if (result.isError && mountedRef.current) {
          setError(result.content?.map((block) => block.text ?? '').join('') || 'error');
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (mountedRef.current) setError(message);
        throw err;
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [host],
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
