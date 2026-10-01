/**
 * @fileoverview Global setup for the e2e suites: wires the crash tripwire's
 * assertion side.
 *
 * Registered through `setupFiles` in `e2e/vitest.e2e.config.ts` and
 * `e2e/vitest.e2e.real.config.ts`, so every spec in both tiers is covered
 * without a single line of spec code opting in. That is deliberate: an e2e
 * fault that only fails the specs which remembered to ask for the check is a
 * fault that will ship.
 *
 * The listener side is attached in `launchApp`
 * (`e2e/fixtures/app.ts` -> `attachTripwire`), not here, because the app is
 * launched from a spec's `beforeAll` and may be relaunched mid-file; the hooks
 * on the other hand have to be registered during collection.
 *
 * @see e2e/fixtures/tripwire.ts
 */

import { afterEach, beforeEach } from 'vitest';
import {
  formatTripwireFailure,
  getTripwireStrictness,
  isFatalTripwireKind,
  resetTripwire,
  takeTripwireEntries,
  toleratedBy,
  type TripwireEntry,
  type TripwireSuppression,
} from './tripwire';

beforeEach(() => {
  resetTripwire();
});

afterEach(async () => {
  const recorded = await takeTripwireEntries();
  if (recorded.length === 0) return;

  const strictness = getTripwireStrictness();
  const fatal: TripwireEntry[] = [];
  const suppressed: TripwireSuppression[] = [];
  const informational: TripwireEntry[] = [];

  for (const entry of recorded) {
    const reason = toleratedBy(entry);
    if (reason !== null) {
      suppressed.push({ entry, reason });
    } else if (isFatalTripwireKind(entry.kind, strictness)) {
      fatal.push(entry);
    } else {
      informational.push(entry);
    }
  }

  if (fatal.length === 0) {
    // Non-fatal noise still gets said out loud, so a run that quietly collects
    // hundreds of failed requests cannot be mistaken for a clean run.
    if (informational.length > 0) {
      process.emitWarning(
        `e2e-tripwire: ${informational.length} non-fatal fault(s) recorded.\n${informational
          .slice(0, 5)
          .map((entry) => `  [${entry.kind}] ${entry.text.slice(0, 300)}`)
          .join('\n')}`,
        'EncodeXE2ETripwire',
      );
    }
    return;
  }

  throw new Error(formatTripwireFailure(fatal, suppressed, informational.length, strictness));
});
