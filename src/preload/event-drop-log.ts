/**
 * Rate limiting for malformed-event drops.
 *
 * Every payload-bearing `on*` handler drops anything that does not match its declared shape and
 * reports it through {@link logDroppedPayload}. Logging each drop individually is an amplification
 * bug: the drops are driven by *untrusted* traffic, so a main process pushing 15 channels at 100 Hz
 * produces 1500 log lines a second. That floods the in-memory log store, saturates the `/logs`
 * route's own renderer, and turns a rejected-payload defence into a denial-of-service vector aimed at
 * the logger. It was not theoretical - the Tier B `big-blob` sweep on `/logs` measured an 8 s renderer
 * round-trip against 570-1700 ms on every other route, with main answering in 16 ms.
 *
 * So the first few drops on each channel are reported individually, which keeps the log useful while
 * diagnosing a real bug, and everything after that is counted and summarised on a fixed interval. The
 * count is reported, never silently discarded: "1500 malformed payloads were dropped" is the signal an
 * operator needs, and it costs one line instead of 1500.
 */

/** Drops reported individually per channel before that channel is folded into the summary. */
const DETAILED_DROPS_PER_CHANNEL = 3;

/** Minimum gap between summary lines, in milliseconds. */
const SUMMARY_INTERVAL_MS = 5_000;

/**
 * Drops folded into the summary before one is emitted, regardless of elapsed time.
 *
 * A time bound alone is not enough. Drops are pushed by `webContents.send`, which does not yield to
 * the event loop, so a flood can deliver thousands of them inside a single millisecond - and a
 * flood that then stops would produce no summary at all until some unrelated later drop happened to
 * arrive after the interval. Bounding by count as well guarantees the count is reported while
 * keeping the summary to roughly 2% of the drop volume.
 */
const SUMMARY_EVERY_N_DROPS = 50;

interface DropWindow {
  /** Start of the current reporting window. */
  startedAt: number;
  /** Individually reported drops, keyed by channel. */
  detailedByChannel: Map<string, number>;
  /** Drops seen in this window, including those reported individually. */
  total: number;
  /** Distinct channels seen in this window. */
  channels: Set<string>;
  /** When a summary was last emitted, so the interval is honoured across window boundaries. */
  lastSummaryAt: number;
  /** Drops folded into the summary since the last one, i.e. not reported individually. */
  folded: number;
}

/**
 * @param {number} startedAt - Window start in milliseconds.
 * @returns {DropWindow} Fresh state.
 */
function newWindow(startedAt: number): DropWindow {
  return { startedAt, detailedByChannel: new Map(), total: 0, channels: new Set(), lastSummaryAt: startedAt, folded: 0 };
}

let current = newWindow(0);

/**
 * Resets the throttle state.
 *
 * Exported for tests only. Without it, every test that asserts on drop logging inherits the previous
 * test's window and silently stops reporting - the same class of green-but-wrong failure this module
 * exists to prevent.
 *
 * @returns {void}
 */
export function resetDropLogThrottle(): void {
  current = newWindow(0);
}

/**
 * Records one malformed payload and reports it, subject to rate limiting.
 *
 * @param {object} deps - Arguments; `log` is the logger whose `warn` method is called.
 * @param {{ warn: (constant: string, ...args: unknown[]) => void }} deps.log - Logger instance.
 * @param {string} deps.constant - Log constant for an individually reported drop.
 * @param {string} deps.summaryConstant - Log constant for the throttled summary line.
 * @param {string} deps.channel - Channel the payload arrived on.
 * @param {string} deps.observed - `typeof` the rejected payload, for diagnosis.
 * @param {number} [deps.now] - Current time in milliseconds; defaults to `Date.now()`.
 * @returns {void}
 */
export function logDroppedPayload({
  log,
  constant,
  summaryConstant,
  channel,
  observed,
  now = Date.now(),
}: {
  // The logger is passed whole and `warn` is called as a method, never detached. `Logger.warn` reads
  // instance state, so handing this function a bare `log.warn` reference throws `Cannot read
  // properties of undefined (reading 'context')` - on the first dropped payload, in production.
  log: { warn: (constant: string, ...args: unknown[]) => void };
  constant: string;
  summaryConstant: string;
  channel: string;
  observed: string;
  now?: number;
}): void {
  // A window that has aged out is summarised before it is replaced, so a burst that stops cleanly
  // still leaves behind the count it produced rather than losing the tail to a rollover.
  if (now - current.startedAt >= SUMMARY_INTERVAL_MS) {
    const closed = current;
    current = newWindow(now);
    if (closed.total > 0) log.warn(summaryConstant, closed.total, closed.channels.size);
  }

  current.total += 1;
  current.channels.add(channel);

  const detailed = current.detailedByChannel.get(channel) ?? 0;
  if (detailed < DETAILED_DROPS_PER_CHANNEL) {
    current.detailedByChannel.set(channel, detailed + 1);
    log.warn(constant, channel, observed);
    return;
  }

  current.folded += 1;

  if (now - current.lastSummaryAt >= SUMMARY_INTERVAL_MS || current.folded >= SUMMARY_EVERY_N_DROPS) {
    current.lastSummaryAt = now;
    current.folded = 0;
    log.warn(summaryConstant, current.total, current.channels.size);
  }
}
