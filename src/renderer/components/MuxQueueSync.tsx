/**
 * @fileoverview Global sync component for the dedicated remux/demux mux queue.
 *
 * Mounted once in the app shell (not inside a route page) so the mux queue
 * state is correct on every screen: the Remux and Demux pages show a live
 * queue status, and the Mux Queue tab renders the current jobs without having
 * to re-fetch on every navigation.
 *
 * The component owns no state of its own - it mirrors the main process's mux
 * queue into {@link useMuxQueueStore}:
 *  - on mount it reads the job list and the queue state,
 *  - it subscribes to the mux queue push channels and mirrors each event,
 *  - it returns every unsubscribe function on unmount.
 */

import { useEffect } from 'react';
import { Logger } from '../../shared/logger';
import { bridgePromise } from '../utils/bridge-call';
import { useMuxQueueStore } from '../stores/muxQueueStore';
import { reorderJob } from '../utils/queue-reorder';
import type { ConversionProgress, MuxQueueJob } from '../../shared/types';

const log = new Logger('renderer/MuxQueueSync');

/**
 * Subscribes to a mux queue event, tolerating a bridge that does not have the
 * method yet (an older preload) or that throws when it is called.
 *
 * A missing method is not a bug the mux queue can fix, and a bridge that
 * throws must not take the whole renderer down with it: the queue simply stays
 * unsynchronized.
 * @param {string} name - The bridge method name.
 * @param {(payload: never) => void} handler - The event handler.
 * @returns {(() => void) | undefined} The unsubscribe function, when there is one.
 */
function subscribe(name: string, handler: (payload: never) => void): (() => void) | undefined {
  const api = window.electronAPI as unknown as Record<string, ((cb: unknown) => (() => void) | undefined) | undefined>;
  const method = api?.[name];
  if (typeof method !== 'function') return undefined;
  try {
    return method.call(api, handler);
  } catch (err) {
    log.warn('Mux queue subscription failed:', name, err);
    return undefined;
  }
}

/**
 * Mirrors the main process's mux queue into the renderer store.
 * @returns {JSX.Element} Nothing is rendered.
 */
export default function MuxQueueSync() {
  useEffect(() => {
    const store = useMuxQueueStore.getState();

    bridgePromise(() => window.electronAPI?.muxQueueList() ?? Promise.resolve<MuxQueueJob[]>([]))
      .then((jobs: MuxQueueJob[]) => useMuxQueueStore.getState().setJobs(jobs))
      .catch((err: unknown) => log.warn('Failed to refresh mux queue jobs:', err));

    bridgePromise(() => window.electronAPI?.muxQueueGetState() ?? Promise.resolve({ paused: false, concurrency: 1 }))
      .then((state: { paused: boolean; concurrency: number }) => {
        const current = useMuxQueueStore.getState();
        current.setPaused(state.paused === true);
        if (Number.isFinite(state.concurrency)) current.setConcurrency(state.concurrency);
      })
      .catch((err: unknown) => log.warn('Failed to read mux queue state:', err));

    const unsubscribers = [
      subscribe('onMuxQueueAdded', (job: MuxQueueJob) => useMuxQueueStore.getState().addJob(job)),
      subscribe('onMuxQueueRemoved', (id: string) => useMuxQueueStore.getState().removeJob(id)),
      subscribe('onMuxQueueStatusChange', (job: MuxQueueJob) => useMuxQueueStore.getState().updateJob(job)),
      subscribe('onMuxQueueProgress', ({ job, progress }: { job: MuxQueueJob; progress: ConversionProgress }) => {
        const current = useMuxQueueStore.getState();
        current.updateJob(job);
        current.updateProgress(job.id, progress);
      }),
      subscribe('onMuxQueueCancelled', () => {
        const current = useMuxQueueStore.getState();
        current.clearJobs();
        current.setPaused(false);
      }),
      subscribe('onMuxQueueMoved', ({ id, toPosition }: { id: string; toPosition: number }) => {
        useMuxQueueStore.setState((state) => {
          const jobs = reorderJob(state.jobs, id, toPosition);
          return jobs === state.jobs ? {} : { jobs };
        });
      }),
    ].filter((unsubscribe): unsubscribe is () => void => typeof unsubscribe === 'function');

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      store.clearJobs();
    };
  }, []);

  return null;
}
