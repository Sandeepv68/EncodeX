import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logDroppedPayload, resetDropLogThrottle } from '../event-drop-log';
import { LOG_EVENT_PAYLOAD_INVALID, LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED } from '../../shared/log-constants';

/**
 * Records what the throttle would have logged.
 *
 * `log` is a stub object whose `warn` is called as a method, matching how the preload passes it. The
 * behaviour under test *is* how much gets logged, so a real logger would only obscure the
 * measurement.
 *
 * @returns {{ warn: ReturnType<typeof vi.fn>; drop: (channel: string, observed?: string, now?: number) => void }} Helper.
 */
function harness(): { warn: ReturnType<typeof vi.fn>; drop: (channel: string, observed?: string, now?: number) => void } {
  const warn = vi.fn();
  const log = { warn };
  const drop = (channel: string, observed = 'object', now?: number): void => {
    logDroppedPayload({
      log,
      constant: LOG_EVENT_PAYLOAD_INVALID,
      summaryConstant: LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED,
      channel,
      observed,
      now,
    });
  };
  return { warn, drop };
}

describe('logDroppedPayload', () => {
  beforeEach(() => {
    resetDropLogThrottle();
  });

  it('reports the first drops on a channel individually', () => {
    const { warn, drop } = harness();
    drop('queue-added', 'object', 1_000);

    expect(warn).toHaveBeenCalledExactlyOnceWith(LOG_EVENT_PAYLOAD_INVALID, 'queue-added', 'object');
  });

  it('reports the observed type so the offending payload can be identified', () => {
    const { warn, drop } = harness();
    drop('conversion-progress', 'null', 1_000);

    expect(warn).toHaveBeenCalledWith(LOG_EVENT_PAYLOAD_INVALID, 'conversion-progress', 'null');
  });

  it('stops reporting individually once the per-channel detail allowance is spent', () => {
    const { warn, drop } = harness();
    for (let i = 0; i < 25; i += 1) drop('queue-added', 'object', 1_000);

    // The point of the whole module: the drop count is controlled by the sender, so an unbounded run of
    // individual warnings would let hostile traffic dictate the log volume.
    const detailed = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID);
    expect(detailed).toHaveLength(3);
  });

  it('summarises with a running total and the distinct channel count', () => {
    const { warn, drop } = harness();
    for (let i = 0; i < 120; i += 1) drop('queue-added', 'object', 1_000);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    expect(summaries).not.toHaveLength(0);
    // Totals climb monotonically, and each one is the real drop count so far - not the number of
    // drops that happened to be reported in detail.
    const totals = summaries.map((call) => call[1] as number);
    expect(totals.every((total, i) => i === 0 || total >= totals[i - 1])).toBe(true);
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(100);
    expect(summaries.every((call) => call[2] === 1)).toBe(true);
  });

  it('bounds the log volume of a flood to a small fraction of the drops', () => {
    const { warn, drop } = harness();
    for (let i = 0; i < 1_000; i += 1) drop('queue-added', 'object', 1_000);

    // 1000 hostile payloads in one millisecond. This is the amplification the throttle exists to
    // stop, so the bound is the assertion: a handful of lines, not one per drop.
    expect(warn.mock.calls.length).toBeLessThanOrEqual(25);
  });

  it('summarises a flood delivered inside a single millisecond', () => {
    const { warn, drop } = harness();
    // `webContents.send` does not yield to the event loop, so a real flood can land entirely within
    // one millisecond. A time-bounded throttle alone would report nothing here and the operator would
    // never learn the drops happened.
    for (let i = 0; i < 120; i += 1) drop('queue-added', 'object', 1_000);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    expect(summaries).not.toHaveLength(0);
  });

  it('counts distinct channels in the summary', () => {
    const { warn, drop } = harness();
    for (let i = 0; i < 60; i += 1) drop('queue-added', 'object', 1_000);
    for (let i = 0; i < 60; i += 1) drop('player-frame', 'object', 1_000);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    // Two channels are in play, so the summary must say 2 - an operator needs to know whether one
    // misbehaving channel or the whole bridge is on fire.
    expect(summaries.at(-1)?.[2]).toBe(2);
  });

  it('emits at most one summary per interval while drops keep arriving', () => {
    const { warn, drop } = harness();
    // A sustained flood: 200 drops spread across 20 seconds.
    for (let i = 0; i < 200; i += 1) drop('queue-added', 'object', 1_000 + i * 100);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    // 20s / 5s = 4 windows, so at most a handful of summary lines for 200 drops - not 200.
    expect(summaries.length).toBeLessThanOrEqual(5);
    expect(summaries.length).toBeGreaterThan(0);
  });

  it('never drops the count when the flood stops between windows', () => {
    const { warn, drop } = harness();
    for (let i = 0; i < 60; i += 1) drop('queue-added', 'object', 1_000);
    // No further drops. The next drop opens a new window and must flush the closed one first, or the
    // tail of the burst disappears and the log understates what happened.
    drop('queue-added', 'object', 20_000);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    expect(summaries.some((call) => call[1] === 60 && call[2] === 1)).toBe(true);
  });

  it('does not report a summary for an empty window', () => {
    const { warn, drop } = harness();
    // Two windows pass with no drops at all between them.
    drop('queue-added', 'object', 1_000);
    drop('queue-added', 'object', 30_000);

    const summaries = warn.mock.calls.filter((call) => call[0] === LOG_EVENT_PAYLOAD_INVALID_SUPPRESSED);
    // Only the window that actually saw drops may be summarised.
    expect(summaries.every((call) => call[1] > 0)).toBe(true);
  });

  it('keeps the detail allowance per channel rather than global', () => {
    const { warn, drop } = harness();
    // Exhausting one channel must not silence a different channel: a burst of player frames would
    // otherwise hide a genuine queue-progress bug reported moments later.
    for (let i = 0; i < 25; i += 1) drop('player-frame', 'object', 1_000);
    warn.mockClear();
    drop('queue-moved', 'object', 1_000);

    expect(warn).toHaveBeenCalledExactlyOnceWith(LOG_EVENT_PAYLOAD_INVALID, 'queue-moved', 'object');
  });
});
