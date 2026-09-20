# EncodeX — CI/CD Pipeline Expansion Plan

**Author:** CI/CD audit (Sep 2026) · **Status:** implemented — pending first GitHub Actions run · **Tracking doc:** this file
**Scope:** `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/release.yml`, new `.github/workflows/scorecard.yml` + `.github/workflows/nightly.yml`, `scripts/perf-compare.mjs`, `perf/baseline.json`.
**Supersedes:** extends `plans/CI_IMPROVEMENTS.md` (prior plan, status: implemented/pending first Actions run). This plan adds *post-launch hardening* stages only; it does not re-do prior checkpoints.

---

## 1. Background / current state

The baseline pipeline is already staged (format/lint/typecheck/validate-locales → build matrix → unit/integration/perf → e2e) plus `codeql.yml`, `release.yml`, `site.yml`, `wiki-sync.yml`. The audit found the following **remaining gaps**:

| # | Finding | Impact |
|---|---------|--------|
| 1 | `release.yml` builds whatever `package.json` says but never verifies the tag `v*` matches the packaged version | Shipping a mislabeled `beta.4` (we just cut one) or a drifted tag |
| 2 | `release.yml` releases are published immediately (`draft: false`, auto-generate notes) | No human gate before a release becomes public |
| 3 | No checksums (`SHA256SUMS.txt`) published with installers | Users can't verify artifact integrity |
| 4 | `test-perf` records results + uploads artifacts but never *gates* on regression | Perf can silently regress between releases |
| 5 | Workflow YAMLs are never linted (`actionlint` absent) | Broken YAML surfaces only at runtime / wasted Actions runs |
| 6 | CodeQL: `javascript-typescript` + `security-extended` only | No `actions` language analysis, no `security-and-quality` suite |
| 7 | No OSSF Scorecards / supply-chain health check | Repo security posture unmeasured, no badge |
| 8 | Releases ship without an SBOM or SLSA provenance | Supply-chain consumers can't audit / verify artifacts |
| 9 | `test-e2e` matrix is ubuntu-only (as are all test jobs) | Windows/macOS e2e breaks uncaught despite NSIS being primary target |
| 10 | No nightly scheduled run of the heavy suite (`test-e2e-real`, perf) | Regression signal is invisible if PR runs get skipped/throttled |
| 11 | Codecov upload exists but no PR coverage-change comment configured | Coverage *change* signal not surfaced in PRs |
| 12 | `audit` job still `continue-on-error: true` (O1 note references electron-builder upgrade, which has landed) | Gate not blocking on known-vulnerable deps |

## 2. Target pipeline shape

```
push/PR (main|master)
│
├─ Quick checks (PARALLEL, ubuntu)           ← + actionlint (CP4)
│   ├─ format-check ├─ lint ├─ lint-* ├─ typecheck ├─ validate-locales ├─ audit (non-blocking, O1-tracked)
│
├─ build (matrix ubuntu|windows|macos) → uploads dist-<os> for ALL os   (CP8)
├─ test-unit   (coverage + threshold + Codecov PR comment)               (CP10)
├─ test-integration
├─ test-perf   (benchmarks, artifact upload, regression GATE vs baseline) (CP3)
│
└─ test-e2e (matrix ubuntu|windows)  ── test-e2e-real (ubuntu)
        └─ nightly (scheduled) repeats heavy e2e-real + perf             (CP9)

CodeQL  : + actions language, security-and-quality                       (CP5)
Scorecard: weekly supply-chain health, SARIF → security tab              (CP6)
Release (tag v*):
    validate-version (tag == package.json)  →  package matrix  →  publish DRAFT
    → SHA256SUMS.txt (CP2) + CycloneDX SBOM (CP7) + SLSA provenance (CP7)
```

## 3. Legend (status markers)

- Class `` `done` `` — verified complete (evidence in §6)
- Class `` `in-progress` `` — actively being worked
- Class `` `pending` `` — not started
- Class `` `blocked` `` — blocked on external input (list blocker in Checkpoints)
- Class `` `cancelled` `` — explicitly dropped (reason in §8)

## 4. Checkpoint tracker

| CP | Checkpoint | Status | Verified by |
|----|-----------|--------|-------------|
| 0 | Write this plan document (markers, checkpoints, tracker) | `` `done` `` | file exists |
| 1 | `release.yml`: validate tag `v*` == `package.json` version before packaging | `` `done` `` | actionlint clean; logic reviewed |
| 2 | `release.yml`: publish `draft: true` + generate `SHA256SUMS.txt` for installers | `` `done` `` | actionlint clean |
| 3 | Perf regression gate: `scripts/perf-compare.mjs` + per-OS `perf/baseline.json` + CI gate step + `perf:compare`/`perf:baseline` scripts | `` `done` `` | `perf:baseline` + `perf:compare` green; fail-mode exit 1 verified |
| 4 | `ci.yml`: `actionlint` job (reviewdog) + wire into `needs` | `` `done` `` | actionlint CLI lints all workflows clean |
| 5 | `codeql.yml`: add `actions` language + `security-and-quality` queries | `` `done` `` | actionlint clean (queries as comma-separated scalar, see §5 note) |
| 6 | New `.github/workflows/scorecard.yml` (OSSF, weekly + on push) | `` `done` `` | actionlint clean |
| 7 | `release.yml`: CycloneDX SBOM + SLSA provenance on publish | `` `done` `` | actionlint clean |
| 8 | `ci.yml`: `dist-<os>` upload for all build matrix OS; e2e matrix `[ubuntu, windows]` | `` `done` `` | actionlint clean; e2e helpers are cross-platform |
| 9 | New `.github/workflows/nightly.yml`: scheduled heavy e2e-real + perf + mcp-smoke | `` `done` `` | actionlint clean |
| 10 | Coverage PR comment: `codecov.yml` PR-comment config (+ v5 upload kept) | `` `done` `` | actionlint clean; §5 note on v5 input |
| 11 | Full local verification + seed `perf/baseline.json` (win32-x64) | `` `done` `` | §6 table all green |

Legend statuses are updated in §7 **Progress log** as implementation proceeds.

## 5. Detailed changes

### CP1 — Release version gate
- Add `validate-version` job (runs on `ubuntu-latest`, `timeout-minutes: 5`).
- Steps: `actions/checkout@v4` → assert `v` + `require('./package.json').version` equals `github.ref_name`; fail loudly otherwise.
- `package` job gains `needs: [validate-version]` so a drift never reaches packaging.

### CP2 — Draft-only release + checksums
- In `publish`: set `draft: true` (human promotion), keep `generate_release_notes: true`.
- Add step before publish: `cd release-artifacts && sha256sum * > SHA256SUMS.txt` (publish runs on ubuntu → `sha256sum` available).
- `SHA256SUMS.txt` is inside `release-artifacts/**`, so it rides along with existing `files:` glob; add explicit `files: release-artifacts/**` entry for the checksum file to be safe.

### CP3 — Perf regression gate
- New `scripts/perf-compare.mjs` (ESM, like other scripts):
  - **Mode `--generate`** (`npm run perf:baseline`): aggregate all `perf/results/*.json`, median `durationMs` per `(phase, test)` for the current platform+arch key (`${process.platform}-${process.arch}`), write `perf/baseline.json` (merged across platforms so one file holds all OS baselines).
  - **Mode `compare`** (`npm run perf:compare`): median current results vs committed baseline for the running platform; fail if `current > baseline * (1 + PERF_TOLERANCE)` (default 0.35 = 35% headroom, env-overridable); if no baseline exists for the platform → warn + exit 0 (gate is "record-only" until a baseline is seeded for that OS).
- Per-OS baseline is required because runner CP/time variance makes cross-OS thresholds meaningless.
- `package.json`: add `perf:baseline`, `perf:compare`.
- CI `test-perf` job: after `npm run perf`, add step `Run perf compare` → `npm run perf:compare` (fails job on regression).
- Seed baseline now from local results (`win32-x64`) via `npm run perf:baseline`. (linux-x64 baseline must be seeded from a GitHub Actions run — see §7 note.)

### CP4 — actionlint
- Add `actionlint` quick-check job (`reviewdog/action-actionlint@v1`, `timeout-minutes: 10`, no node needed).
- Wire into `needs` of `build`, `test-unit`, `test-integration`, `test-perf` (same list as the other quick checks).
- Run actionlint CLI locally during verification to catch any pre-existing workflow issues that would fail the new gate.

### CP5 — CodeQL expansion
- `languages`: `['javascript-typescript', 'actions']`.
- `queries`: `security-extended` → `security-extended,security-and-quality`. **Note:** actionlint rejects a YAML flow-sequence value for this input, so it is expressed as the comma-separated scalar form the action also accepts.
- Keep schedule, concurrency, minimal permissions.

### CP6 — Scorecards
- New `.github/workflows/scorecard.yml` (OSSF `scorecard-action@v2.4.0` + SARIF upload to security tab via `codeql-action/upload-sarif@v3`).
- Triggers: `push` to `main|master`, weekly schedule, `workflow_dispatch`.
- Permissions: `read-all` job default; per-job `security-events: write`, `id-token: write`.

### CP7 — SBOM + SLSA
- `publish` job: `actions/checkout@v4` (needed for source SBOM), then `anchore/sbom-action@v0` (`path: .`, `format: cyclonedx-json`) → `sbom.cdx.json`, add to `files:` list.
- New `provenance` job (after `publish`): SLSA generator reusable workflow `slsa-framework/slsa-github-actions/.github/workflows/generator_generic_slsa3.yml@v2.1.0`, `permissions: id-token: write, contents: read, actions: read`, `upload-assets: true`, `upload-tag-name: ${{ github.ref_name }}`. Subject digest computed in `publish` via a bash step over `sha256sum` and passed as `base64-subject` output.

### CP8 — Windows e2e leg
- `build` job: change upload condition `if: matrix.os == 'ubuntu'` → always (name `dist-${{ matrix.os }}`), so all three OS dists are cached.
- `test-e2e`: convert to matrix `include: [{os: ubuntu, runner: ubuntu-latest}, {os: windows, runner: windows-latest}]`; name = `Test - E2E Automation (${{ matrix.os }})`; download `dist-${{ matrix.os }}`; `xvfb` install + `xvfb-run` step gated `if: matrix.os == 'ubuntu'`; on windows run `npm run test:e2e:ci` directly.
- Keep `test-e2e-real` ubuntu-only for now (referenced by nightly, CP9).

### CP9 — Nightly heavy suite
- New `.github/workflows/nightly.yml`: `schedule: cron 0 6 * * *` (UTC) + `workflow_dispatch`.
- Runs: `test-e2e-real` equivalent (build → download dist-ubuntu → xvfb → `npm run test:e2e:real:ci`), plus `perf` with `perf:compare`, plus `mcp:smoke:electron`. Uploads artifacts (`perf-results`, e2e reports if any) for subsequent analysis.
- Aligns with prior Open Item O4 (move heavy e2e off PR path).

### CP10 — Codecov PR comment
- Added `codecov.yml` at repo root enabling the PR coverage-change comment (`coverage.status.project` auto target + 1% threshold, `patch` 80% floor, `comment` layout). **Note:** v5 of `codecov/codecov-action` removed the v4-only `reportonly_coverage_changes` input, so comment behavior is driven by the repo config instead.
- `test-unit` upload already gated on `CODECOV_TOKEN` (see N2); `use_oidc`/token upload is unchanged.
- Also corrected the stale comment on the `audit` job (electron-builder 26.x has landed; 1 high advisory remains — see N4).

### CP11 — Verification (see §6)

## 6. Verification

| Command / Check | Expected | Actual |
|-----------------|----------|--------|
| `npm run perf:baseline` | merges/writes `perf/baseline.json`, seeds `win32-x64` (43 tests) | ✅ exit 0 |
| `npm run perf:compare` | exit 0 vs seeded baseline | ✅ exit 0 |
| `perf:compare` fail-mode (baseline deliberately halved) | exit 1 | ✅ exit 1 ("1 performance regression") |
| baseline restored after fail-mode test | re-merge via `perf:baseline` | ✅ exit 0 |
| `actionlint` on all workflows (`ci.yml`, `codeql.yml`, `release.yml`, `scorecard.yml`, `nightly.yml`) | exit 0 | ✅ exit 0 |
| `npm run format:check` | exit 0 | ✅ exit 0 (after `prettier --write scripts/perf-compare.mjs`) |
| Final `actionlint` re-run post `ci.yml` comment edit | exit 0 | ✅ exit 0 |

E2E/scorecard/SLSA exercise only on GitHub (first Actions run pending; authoritative).

## 7. Progress log

| Date | Action | State |
|------|--------|-------|
| 2026-09-20 | Plan written; baseline research complete (perf result schema, workflow files) | `` `done` `` |
| 2026-09-20 | CP1 (version gate) + CP2 (draft + SHA256SUMS) in `release.yml` | `` `done` `` |
| 2026-09-20 | CP3: `scripts/perf-compare.mjs`, `perf:baseline`/`perf:compare`, CI gate step, seeded `perf/baseline.json` (win32-x64, 43 tests) | `` `done` `` |
| 2026-09-20 | CP4: `actionlint` job wired into all dependent `needs`; local actionlint run (all workflows clean) | `` `done` `` |
| 2026-09-20 | CP5: CodeQL + `actions` language, `security-and-quality` (comma-scalar form) | `` `done` `` |
| 2026-09-20 | CP6: `scorecard.yml` (OSSF + SARIF → security tab) | `` `done` `` |
| 2026-09-20 | CP7: SBOM (anchore) + SLSA provenance (generic generator, base64-subject digests) | `` `done` `` |
| 2026-09-20 | CP8: `dist-<os>` uploaded for all OS; e2e matrix ubuntu+windows | `` `done` `` |
| 2026-09-20 | CP9: `nightly.yml` (scheduled heavy suite) | `` `done` `` |
| 2026-09-20 | CP10: `codecov.yml` PR-comment config; corrected stale `audit` comment | `` `done` `` |
| 2026-09-20 | CP11: verification (see §6) — all green | `` `done` `` |

## 8. Open items / follow-ups (NOT part of this plan)

| ID | Item | Owner |
|----|------|-------|
| N1 | Seed a `linux-x64` perf baseline from an Actions runner (`workflow_dispatch` + `npm run perf:baseline`, commit result) so the CP3 gate is armed on CI | after first green run |
| N2 | Wire `CODECOV_TOKEN` repo secret (currently absent → Codecov steps are no-ops despite CP10 config) | maintainer |
| N3 | Code signing (Windows cert + macOS notarization) remains O3 from prior plan — release stays `draft` until signing lands | future PR |
| N4 | Re-check `npm audit --audit-level=high`: electron-builder `26.x` (O1) has landed but exit is still 1; when it exits 0, flip `audit` job to blocking (CP in prior plan O1) | future PR |
| N5 | Consider GitHub Actions merge queue on `main` once `main` branch-protection rules are enforced | future PR |
| N6 | Consider posting Scorecards badge in README once the SARIF upload surfaces | future PR |

---
*End of plan.*