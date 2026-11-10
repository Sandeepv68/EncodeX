/**
 * @fileoverview Maps a Copilot plan's remux/demux actions onto mux queue jobs.
 *
 * The Copilot plans one action per output file: a remux is a single action, and
 * a demux is one action per extracted stream. The mux queue models the same
 * work as one job per source file, with one target per output - so a demux plan
 * becomes one job with N targets rather than N jobs.
 *
 * Routing these operations here is what keeps the batch queue free of them.
 * The batch queue's per-job options dialog can only express the batch
 * operations, so a remux job left there was silently re-classified as a
 * transcode and, on save, had its stream-copy options replaced with codec
 * options - turning a lossless remux into a re-encode.
 */

import type { CopilotAction } from '../../shared/copilot';
import type { MuxQueueAddPayload } from '../../shared/types';
import { dirname } from '../utils/path-utils';

/**
 * True when an operation belongs to the mux queue rather than the batch queue.
 * @param {string} operation - The Copilot operation.
 * @returns {boolean} True for remux and demux.
 */
export function isMuxQueueOperation(operation: string): boolean {
  return operation === 'remux' || operation === 'demux';
}

/**
 * Builds the mux queue payloads for a Copilot plan's remux/demux actions.
 *
 * Demux actions that share a source file are folded into one job with one
 * target per extracted stream, matching how the mux queue runs a demux
 * (sequentially, over one source file).
 * @param {CopilotAction[]} actions - The plan's actions.
 * @returns {MuxQueueAddPayload[]} One payload per mux queue job.
 */
export function buildMuxQueuePayloads(actions: CopilotAction[]): MuxQueueAddPayload[] {
  const payloads: MuxQueueAddPayload[] = [];

  for (const action of actions) {
    if (!isMuxQueueOperation(action.operation)) continue;
    if (!action.input || !action.output) continue;

    if (action.operation === 'remux') {
      payloads.push({
        kind: 'remux',
        input: action.input,
        output: action.output,
        targets: [{ output: action.output, options: action.options, label: action.id }],
      });
      continue;
    }

    // Demux: one target per extracted stream, all from the same source file.
    const existing = payloads.find((payload) => payload.kind === 'demux' && payload.input === action.input);
    if (existing) {
      existing.targets.push({ output: action.output, options: action.options, label: action.id });
      continue;
    }
    payloads.push({
      kind: 'demux',
      input: action.input,
      output: dirname(action.output),
      targets: [{ output: action.output, options: action.options, label: action.id }],
    });
  }

  return payloads;
}
