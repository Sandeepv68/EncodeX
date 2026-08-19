# EncodeX — CI Pipeline Improvement Plan

**Author:** CI audit (Aug 2026) · **Status:** Implemented — pending first GitHub Actions run · **Tracking doc:** this file
**Scope:** `.github/workflows/ci.yml`, `package.json`, `vitest.config.ts`, `tsconfig*.json`, formatting config, new `codeql.yml` + `release.yml`.

---

## 1. Background / current state

The pipeline is linear and staged, with several correctness and cost problems found during the audit:

| # | Finding | Impact |
|---|---------|--------|
| 1 | `needs` graph serializes jobs that are independent (unit/integration wait on `build`) | Slow CI |
| 2 | E2E jobs run `npm run build` internally → the `dist` artifact is built 3× per run | Wasteful CI minutes |
| 3 | ESLint config exists but is never run in CI | No lint gate |
| 4 | No standalone type-check; renderer never type-checked (Vite strips types) | Type bugs ship |
| 5 | Coverage collected but no thresholds and never uploaded anywhere | Coverage can silently regress |
| 6 | `format:check` targets `src/**/*.{ts,tsx,json}` but `.prettierignore` ignores all `*.json` (dead glob); `e2e/`, `scripts/`, root configs unchecked | Inconsistent formatting gate |
| 7 | No security scanning (`npm audit`, CodeQL) | Vulnerabilities unnoticed |
| 8 | All jobs on `ubuntu-latest` only (Electron/FFmpeg is cross-platform) | OS-specific breaks uncaught |
| 9 | No `permissions` block, no job timeouts | Supply-chain + runaway-cost risk |
| 10 | No path filtering → full pipeline runs for docs-only changes | Wasteful CI |
| 11 | No release/packaging workflow despite `electron-builder` config | Can't ship installers |

## 2. Target pipeline shape

```
push/PR (main|master), paths-ignore, permissions: read, timeout: 60m, concurrency cancel
│
├─ Quick checks (PARALLEL, ubuntu)
│   ├─ format-check   ├─ lint   ├─ typecheck   ├─ validate-locales   ├─ audit (non-blocking)
│
├─ build (needs all quick checks) — matrix [ubuntu, windows, macos] → uploads dist-<os>
├─ test-unit (parallel w/ build)   → coverage + thresholds + upload
├─ test-integration (parallel w/ build)
│
└─ test-e2e / test-e2e-real (need build + unit + integration)
    → download dist-ubuntu (no rebuild) → xvfb → vitest
```

## 3. Checkpoint tracker

| CP | Checkpoint | Status | Verified by |
|----|-----------|--------|-------------|
| 1 | Write this plan document | done | file exists |
| 2 | Restructure `ci.yml`: permissions/timeouts/paths-ignore, parallel quick checks, build matrix, artifact reuse, audit job | done | YAML parses; structure reviewed |
| 3 | `package.json`: typecheck scripts, format scope fix, CI e2e scripts (no rebuild) | done | `npm run` smoke |
| 4 | Formatting: expand `format`/`format:check` scope, run `prettier --write` on newly included files | done | `npm run format:check` green (exit 0) |
| 5 | Type-check gate: `tsconfig.renderer.json`, fix pre-existing renderer type errors | done | `npm run typecheck` green (exit 0) |
| 6 | Coverage: add thresholds to `vitest.config.ts`, add Codecov upload step | done | `npm run test:coverage` green, thresholds enforced |
| 7 | Add `.github/workflows/codeql.yml` | done | YAML parses |
| 8 | Add `.github/workflows/release.yml` (tag-triggered multi-platform packaging) | done | YAML parses |
| 9 | Full local verification suite (format, lint, typecheck, validate-locales, build, unit w/ coverage, audit) | done | see §5 below |

Legend: `done` / `in-progress` / `pending` / `blocked` / `cancelled`

## 4. Detailed changes

### CP2 — `ci.yml` restructure
- **Top level:** add `permissions: contents: read`; `timeout-minutes: 60`; keep `concurrency`; add `paths-ignore` for `docs/**`, `assets/**`, `*.md`, `README.md`.
- **Quick checks (parallel, `needs: []`):** `format-check`, `lint`, `typecheck`, `validate-locales`, `audit`.
  - `audit`: `npm audit --audit-level=high`; **non-blocking** (`continue-on-error: true`) because current deps have known `high` advisories in `electron-builder` toolchain (see Open Items O1). No `npm ci` needed (uses lockfile only).
- **`build`:** `needs: [format-check, lint, typecheck, validate-locales]`, matrix `[ubuntu, windows, macos]`, runs `npm run build`, uploads artifact `dist-<os>` (`path: dist`, no trailing slash so folder is preserved).
- **`test-unit`:** `needs: [format-check, lint, typecheck, validate-locales]` (runs in parallel with `build`). Runs `npm run test:coverage`; uploads `coverage/` (`if: always()`); Codecov upload step gated on `env.CODECOV_TOKEN`.
- **`test-integration`:** same deps as `test-unit`.
- **`test-e2e` / `test-e2e-real`:** `needs: [build, test-unit, test-integration]`; `download-artifact` `dist-ubuntu` → `path: .`; install `xvfb`; run `npm run test:e2e:ci` / `npm run test:e2e:real:ci` (no rebuild).

### CP3 — `package.json` scripts
- Add `typecheck`, `typecheck:renderer`, `typecheck:main`, `typecheck:preload`.
- Change `format`/`format:check` globs to the aligned scope (see CP4).
- Add `test:e2e:ci` and `test:e2e:real:ci` (run vitest only, skip `npm run build`). Keep `test:e2e` / `test:e2e:real` for local use (they still build).

### CP4 — Formatting alignment
- `format:check`: `src/**/*.{ts,tsx}` + `e2e/**/*.{ts,tsx}` + `scripts/**/*.{ts,tsx,mjs,js}` + root `*.{ts,mjs,js}` + `bin/**/*.js`.
- `.prettierignore` already ignores `*.json`/`*.yml`/`*.yaml`/`*.lock` — these are intentionally out of scope (avoids churn). Drop the dead `json` glob from the script.
- Run `prettier --write` on the 23 newly included files.

### CP5 — Type-check gate
- New `tsconfig.renderer.json`: extends root, `noEmit`, `include: ["src/renderer/**/*", "src/shared/**/*"]`, `exclude` test files (tests are executed by vitest; typing of tests tracked as O2).
- `typecheck` = renderer + main + preload (`--noEmit`).
- Fix pre-existing renderer errors (~16):
  - `styled(Typography)` loses the overridable `component` prop in MUI v9 → add `component?: React.ElementType` to the `PageTitle` styled wrappers (known MUI issue #29875/#44192).
  - `EllipsisTooltip` `cloneElement(..., { ref, tabIndex })` → cast the injected props to `Partial<React.HTMLAttributes<HTMLElement>>`.

### CP6 — Coverage
- `vitest.config.ts` coverage thresholds (current measured: lines 94.35%, branches 83.12%):
  - statements 85, branches 75, functions 80, lines 85 (headroom below today's numbers).
- CI: add `codecov/codecov-action@v5` with `token: ${{ secrets.CODECOV_TOKEN }}`, `files: coverage/lcov.info`, `fail_ci_if_error: false`, gated on `env.CODECOV_TOKEN != ''`.

### CP7 — CodeQL
- New `.github/workflows/codeql.yml`: `security-extended` queries, `javascript-typescript` language, triggers on push/PR to main|master + weekly schedule, permissions read.

### CP8 — Release
- New `.github/workflows/release.yml`: trigger on tags `v*`; matrix `[ubuntu, windows, macos]`; `npm ci`, `npm run dist` (electron-builder); upload installer artifacts; create draft GitHub Release (no signing yet — see O3).

## 5. Verification

| Command | Expected | Actual |
|---------|----------|--------|
| `npm run format:check` | exit 0 | ✅ exit 0 |
| `npm run lint` | exit 0 (1 existing warning, non-blocking) | ✅ exit 0 (1 a11y warning) |
| `npm run typecheck` | exit 0 | ✅ exit 0 (renderer + main + preload) |
| `npm run validate:locales` | exit 0 | ✅ exit 0 (55 locales) |
| `npm run build` | exit 0 | ✅ exit 0 (pre-existing chunk-size warning, non-blocking) |
| `npm run test:coverage` | exit 0 + thresholds enforced | ✅ 1372/1372 pass; Stmts 93.25, Branch 83.21, Funcs 92.49, Lines 94.33 (all ≥ floors) |
| `npm audit --audit-level=high` | exit 1 (known, non-blocking in CI) | ✅ exit 1 (16 high + 1 critical, tracked in O1) |
| E2E | exercised on GitHub (needs xvfb/Electron); local smoke = `ensureBuildExists` | ⏳ pending first GitHub run |

**Local-run caveat:** on this dev machine the full unit suite can hit vitest worker-spawn timeouts
("Failed to start forks worker" / 5s test timeouts) under heavy load; the same tests pass reliably in
isolation and with `--maxWorkers=3`. Not a code defect — see O7.

## 6. Open items / follow-ups (NOT part of this plan)

| ID | Item | Owner |
|----|------|-------|
| O1 | Upgrade `electron-builder` to fixed major (`26.x`) to clear `npm audit` high/critical advisories, then flip `audit` job to blocking (`continue-on-error: false`) | future PR |
| O2 | Add test-file type-checking to the gate (currently excluded; 3 known errors in `*.test.tsx`) | future PR |
| O3 | Configure code signing (Windows cert + Apple notarization) and validate per-OS icon formats (`.icns`/`.ico`) for the release workflow | future PR |
| O4 | Move `test-e2e-real` (heavy real FFmpeg conversions) to scheduled/nightly if PR latency becomes an issue | decision |
| O5 | Promote key `jsx-a11y` ESLint rules from `warn` to `error` once renderer a11y debt is paid down | future PR |
| O6 | `cli-integration.integration.test.ts` expects pure JSON from real FFmpeg but a progress ticker leaks onto stdout → potential flake. Note: default vitest include (`src/**/*.{test,spec}.{ts,tsx}`) also matches `*.integration.test.ts`, so integration tests currently run in BOTH `test-unit` and `test-integration` jobs | future PR |
| O7 | Watch for vitest worker-spawn flakiness in the `test-unit` job (resource starvation on constrained runners); add `--maxWorkers` / `retry` if it shows up in CI | monitor |
