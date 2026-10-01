# Quarantined e2e specs

Specs parked here are excluded from the default e2e run by
`e2e/vitest.e2e.config.ts` and are registered in `../quarantine.json`.

Two rules make this a quarantine rather than a graveyard:

- Every parked spec needs an entry in `quarantine.json` with a tracking issue and
  a date. `test:flake-detect` fails the build on a missing, stale, or lapsed
  entry, so a spec cannot be quietly parked forever.
- An entry lapses 21 days after `addedOn` unless `expiresOn` says otherwise, and a
  lapsed entry fails CI. Parking a spec buys time to fix it, not a permanent pass.

Do not use `test.skip` inside a spec for this purpose. A skip inside a file still
runs the file's other tests, so it hides the failure without recording it.
