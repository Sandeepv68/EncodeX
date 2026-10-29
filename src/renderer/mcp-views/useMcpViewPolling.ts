/**
 * @fileoverview Polling helper for the MCP App views.
 *
 * The queue, job, batch and convert views keep themselves current by calling
 * their tool on an interval. The hand-written views polled from inside the
 * bridge; the React views poll through the host so the same code works for an
 * external host and for the in-app transcript.
 *
 * Polling stops on the first failure (the host is gone or the tool is
 * refusing), matching the behaviour of the previous bridge.
 */

import { useEffect, useRef } from 'react';
import { structuredPayload } from './host';
import { useMcpView } from './McpViewProvider';
import type { McpViewPollingOptions } from './types';

export type { McpViewPollingOptions };

/**
 * Polls a tool and pushes every successful result into the view state.
 * @param {McpViewPollingOptions} options - Polling options.
 * @returns {void}
 */
export function useMcpViewPolling({ tool, args, intervalMs = 2500, enabled = true }: McpViewPollingOptions): void {
  const { callTool, setData } = useMcpView();
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (!tool || !enabled) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try {
        const result = await callTool(tool, argsRef.current);
        const payload = structuredPayload(result);
        if (!stopped && payload !== undefined) setData(payload);
      } catch {
        // The host is gone or the tool is refusing: stop polling instead of
        // hammering a server that will not answer.
        stopped = true;
        if (timer !== undefined) clearInterval(timer);
      }
    };
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
    return () => {
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [tool, intervalMs, enabled, callTool, setData]);
}
