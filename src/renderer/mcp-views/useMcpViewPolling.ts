/**
 * @fileoverview Polling helper for the MCP App views.
 *
 * The queue, job, batch and convert views keep themselves current by calling
 * their tool on an interval. The hand-written views polled from inside the
 * bridge; the React views poll through the host so the same code works for an
 * external host and for the in-app transcript.
 *
 * Polling stops on the first failure (the host is gone or the tool is
 * refusing), matching the behaviour of the previous bridge. A dropped poll
 * stays silent: the view must not end up in a permanent error state because
 * one background request timed out.
 */

import { useEffect, useRef } from 'react';
import { useMcpView } from './McpViewProvider';
import type { McpViewPollingOptions } from './types';

export type { McpViewPollingOptions };

/**
 * Polls a tool and pushes every successful result into the view state.
 *
 * The ticks are scheduled one after the other (a timeout is armed only once
 * the previous call settled), so a slow tool cannot pile up overlapping
 * requests, and the first tick runs immediately instead of leaving the view
 * empty for a whole interval.
 * @param {McpViewPollingOptions} options - Polling options.
 * @returns {void}
 */
export function useMcpViewPolling({ tool, args, intervalMs = 2500, enabled = true }: McpViewPollingOptions): void {
  const { callTool } = useMcpView();
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (!tool || !enabled) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      if (stopped) return;
      timer = setTimeout(() => {
        void tick();
      }, intervalMs);
    };

    const tick = async (): Promise<void> => {
      if (stopped) return;
      // A hidden window has nothing to show, so polling it is pure waste.
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      try {
        await callTool(tool, argsRef.current, { silent: true });
      } catch {
        // The host is gone or the tool is refusing: stop polling instead of
        // hammering a server that will not answer.
        stopped = true;
        return;
      }
      schedule();
    };

    // The first tick waits for the interval: a view is normally seeded with
    // the payload the host delivered, and a poll that answers before the view
    // has settled would replace it.
    schedule();

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [tool, intervalMs, enabled, callTool]);
}
