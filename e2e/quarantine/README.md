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

## Entry schema

Every entry is validated by `test:flake-detect`; a violation fails the build.

| Field       | Required | Notes                                                                                        |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| `spec`      | yes      | Repo-relative spec path, or an exact `file::test name`. Matched exactly, never by substring. |
| `issue`     | yes      | Tracking issue. Must be non-empty.                                                           |
| `addedOn`   | yes      | `YYYY-MM-DD`. Required — an undated entry never lapses, which is a permanent pass.           |
| `expiresOn` | no       | `YYYY-MM-DD`, must be after `addedOn`. Defaults to `addedOn` + 21 days.                      |

A date that does not parse (a typo such as `2026-13-45`) is treated as
**invalid, not as absent**: the entry is reported and is not allowed to exempt
anything. `Date.parse` returns `NaN` for such input rather than throwing, and
every comparison against `NaN` is `false` — which would otherwise turn the typo
into an entry that never expires.

```json
[
  {
    "spec": "e2e/specs/example.spec.ts::flaky test name",
    "issue": "#123",
    "addedOn": "2026-09-20"
  }
]
```
