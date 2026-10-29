/**
 * @fileoverview Type definitions for the preload bridge.
 * Describes the shapes used by the preload process: the rolling window that
 * rate-limits malformed-event drop reporting, and the payload handed to the
 * drop logger.
 */

/**
 * The rolling window the drop logger rate-limits against.
 * @interface DropWindow
 * @property {number} startedAt - Start of the current reporting window.
 * @property {Map<string, number>} detailedByChannel - Individually reported drops, keyed by channel.
 * @property {number} total - Drops seen in this window, including those reported individually.
 * @property {Set<string>} channels - Distinct channels seen in this window.
 * @property {number} lastSummaryAt - When a summary was last emitted, so the interval is honoured across window boundaries.
 * @property {number} folded - Drops folded into the summary since the last one, i.e. not reported individually.
 */
export interface DropWindow {
  startedAt: number;
  detailedByChannel: Map<string, number>;
  total: number;
  channels: Set<string>;
  lastSummaryAt: number;
  folded: number;
}

/**
 * The arguments accepted by the drop logger.
 * @interface DropLogPayload
 * @property {{ warn: (constant: string, ...args: unknown[]) => void }} log - Logger instance.
 * @property {string} constant - Log constant for an individually reported drop.
 * @property {string} summaryConstant - Log constant for the throttled summary line.
 * @property {string} channel - Channel the payload arrived on.
 * @property {string} observed - `typeof` the rejected payload, for diagnosis.
 * @property {number} [now] - Current time in milliseconds; defaults to `Date.now()`.
 */
export interface DropLogPayload {
  log: { warn: (constant: string, ...args: unknown[]) => void };
  constant: string;
  summaryConstant: string;
  channel: string;
  observed: string;
  now?: number;
}
