# Local GitHub Actions via `act` — Stage-Selectable Local CI

**Status:** Plan (not implemented yet) |
**Tool:** nektos/act 0.2.89 (installed) + Docker Desktop 4.94 (running)
**Scope:** `.github/workflows/ci.yml` only — no new workflow files; `ci.yml` stays the single source of truth.

---

## 1. Goal

Run GitHub Actions locally with **stage-level selection**: pick exactly the
stage(s) you want (`format`, `lint`, `typecheck`, `unit`, `build`, `e2e`, …)
and only those jobs run — no full-CI runs unless you explicitly ask for one.

```
npm run ci:local                 # print available stages
npm run ci:local -- format       # ONLY the prettier check
npm run ci:local -- lint lint-px # two checks, back to back
npm run ci:local -- checks       # all 14 stage-0 checks
npm run ci:local -- unit         # stage-0 + unit tests (act runs `needs`)
npm run ci:local -- e2e          # stage-0 + build + unit + integration + e2e (ubuntu)
npm run ci:local -- all          # entire ci.yml (ubuntu-only) — hours
npm run ci:local -- unit -v      # extra flags after stages are forwarded to act
```

---

## 2. Verified environment (read-only research)

| Check | Result |
|---|---|
| `act --version` | 0.2.89 |
| Docker daemon | Docker Desktop 4.94; act connects via `npipe:////./pipe/docker_engine` ✓ |
| Dry-run `act -n -W .github/workflows/ci.yml -j format-check` | passes; image `catthehacker/ubuntu:act-latest` |
| Line endings | `.gitattributes` forces `* text=auto eol=lf` → no CRLF problems in Linux containers despite `core.autocrlf=true` |
| `.env` | gitignored; act auto-loads it via `--env-file` (default `.env`) |
| Codecov step | self-skips without `CODECOV_TOKEN` (`if: env.CODECOV_TOKEN != ''`) ✓ |

### 2.1 Hard constraints (empirically confirmed)

1. **`-j` is single-valued.** `-j a -j b` → last flag wins; `-j a,b` → error
   *"Could not find any stages to run"*. Multiple unrelated jobs in one act
   process is impossible → **selection = one `act -j <job>` invocation per
   job**, chained by a dispatcher script.
2. **`-j X` always runs X's full `needs` graph.** `-j test-unit` runs the 13
   upstream stage-0 checks first (faithful to GitHub's DAG). No `--skip-needs`
   flag exists in act 0.2.89. Consequence: selecting a *stage-0* job runs
   **only that job** (stage-0 jobs have no deps); selecting a *stage-1/2* job
   re-runs its upstream checks.
3. **`audit` has no dependents.** It only runs in a bare full run or
   `act -j audit`.
4. **Windows/macOS matrix legs cannot run under act.** Filter with
   `--matrix os:ubuntu` — affects `build`, `test-e2e`, `test-ipc-abuse`.
5. **Artifact server is opt-in.** Without `--artifact-server-path`,
   `actions/upload-artifact@v4` / `download-artifact@v4` (build → e2e / flake /
   mcp / coverage jobs) fail. `@v4` is compatible with act 0.2.89; newer
   `@v6/@v7` are **not** (act issues #6021/#6022) — do not bump these actions
   while using act.
6. **`actionlint` gates everything.** The job runs
   `reviewdog/action-actionlint@v1` (needs a GitHub token) and sits in
   `needs` of every stage-1/2 job → if it fails locally, everything downstream
   is skipped. Must be solved (§3.4).
7. **Bare `act` fires every push-triggered workflow** (`release.yml`,
   `site.yml`, `wiki-sync.yml`) → always scope with `-W .github/workflows/ci.yml`.
8. **act injects `ACT=true`** into job env → usable as a local-only guard in
   workflow YAML (GitHub never sets it).

---

## 3. Design

### 3.1 How stage selection works

A small Node dispatcher (`scripts/act-local.mjs`, matching the repo's existing
`scripts/*.mjs` convention) maps stage aliases → act job IDs and spawns one
`act -j <job-id>` call per job, sequentially, fail-fast:

```
npm run ci:local -- <stage> [stage...] [act-flags...]
        │
        └─► scripts/act-local.mjs
              ├─ no args / --help     → print stage table, exit 0
              ├─ unknown stage        → error + valid list, exit 1
              ├─ dedupe stages, split flags (tokens starting with '-')
              ├─ for each stage, for each job id:
              │     spawnSync('act', ['-j', id, ...flags],
              │                { stdio: 'inherit', cwd: repoRoot })
              │     → nonzero exit = stop immediately (fail fast)
              └─ propagate act's exit code
```

Shared configuration lives in **`.actrc`** (read automatically from the repo
root), so every invocation — manual or via dispatcher — gets the same
workflow scope, matrix filter, artifact server, and default event.

### 3.2 Stage reference (alias → act job id)

Aliases default to exact job IDs; `act --list` job IDs always work. Friendly
extras are marked ★.

**Stage 0 — standalone (no `needs`; runs alone):**

| Alias / Job ID | CI name | Notes |
|---|---|---|
| `format` ★ (= `format-check`) | Check - Code formatting | |
| `lint` | Check - ESLint (a11y) | |
| `lint-px` | Check - No hardcoded px | |
| `lint-colors` | Check - No hardcoded colors | |
| `lint-rem` | Check - No hardcoded rem | |
| `lint-styles` ★ (= `lint-inline-styles`) | Check - No inline styles | |
| `lint-strings` | Check - No hardcoded UI strings | |
| `lint-unused` | Check - No unused declarations | |
| `lint-aptabase` | Check - No direct @aptabase imports | |
| `lint-regex` | Check - No super-linear backtracking regexes | |
| `typecheck` | Check - TypeScript typecheck | |
| `locales` ★ (= `validate-locales`) | Check - Validate locales | |
| `audit` | Check - Dependency audit | only runs standalone or in `all` |
| `actionlint` | Check - GitHub Actions workflow lint | token issue → §3.4 |
| `checks` ★ | all 14 above | dispatcher chains 14 invocations |

**Stage 1 — pulls stage-0 first (13 jobs; `audit` excluded):**

| Alias / Job ID | CI name | Notes |
|---|---|---|
| `build` | Build - matrix | ubuntu leg only (`.actrc` matrix filter); uploads `dist` artifact |
| `unit` | Test - Unit Tests (coverage) | uploads coverage artifact; codecov skipped w/o secret |
| `integration` | Test - Integration Tests | builds main process itself |
| `fuzz` | Test - Media Fuzz | real ffmpeg/ffprobe via npm deps |
| `locale-matrix` | Test - i18n matrix | slow-ish |
| `a11y` | Test - axe matrix | |
| `big-lists` | Test - big-list render budgets | |
| `route-changes` | Test - 1,000 rapid route-change harness | |
| `perf` | Test - Performance Benchmarks | |
| `mutation` | Gate - Mutation score delta | ⚠ advisory; now a `mutation-scope` → `test-mutation-delta` (matrix) → `mutation-gate` pipeline — the matrix/gate stages cannot run under act (see §5); local mutation = `npm run test:mutate` directly |
| `coverage-per-file` | Report - Per-file coverage floors | informational (`continue-on-error`) |
| `coverage-diff` | Gate - Diff coverage | needs only format+lint+typecheck; base-sha caveat §5 |

**Stage 2 — pulls stage-0 + `build` + `unit` + `integration` first:**

| Alias / Job ID | CI name | Notes |
|---|---|---|
| `e2e` | Test - E2E Automation | ubuntu leg; downloads `dist-ubuntu` artifact → needs artifact server |
| `e2e-real` | Test - E2E Production Scenario | Electron-in-Docker caveat §5 |
| `ipc-abuse` | Test - IPC abuse | ubuntu leg |
| `flake` | Test - Flake detection | ⚠ ~90m (3 e2e passes) |
| `mcp` | Test - MCP server smoke | includes Electron `--mcp` smoke under xvfb |

**Special:**

| Alias | Behavior |
|---|---|
| `all` | bare `act` (no `-j`) → entire `ci.yml`, ubuntu-only via `.actrc`. Includes mutation + flake → expect hours. |

### 3.3 Files to create / change

#### 1. `.actrc` (new, committed)

```
-W .github/workflows/ci.yml
--matrix os:ubuntu
--artifact-server-path .act-artifacts
--input reviewdog_flags=-reporter=local
pull_request
```

- `-W ci.yml` — never fire release/site/wiki-sync workflows accidentally.
- `--matrix os:ubuntu` — drop windows/macos legs act cannot run.
- `--artifact-server-path` — enables the `upload/download-artifact@v4`
  round-trips (server is NOT started by default). Output dir `.act-artifacts/`
  is gitignored.
- `--input reviewdog_flags=-reporter=local` — token-free reviewdog reporter
  (§3.4a). Harmless if a step doesn't declare that input.
- `pull_request` — default event (pre-merge context; best for
  `coverage-diff`'s base-sha resolution). Positional arg in `.actrc` must be
  validated with a dry-run (§4.1).

#### 2. `.gitignore` (add 2 lines)

```
.act-artifacts/
.secrets
```

#### 3. `scripts/act-local.mjs` (new) — the dispatcher

Skeleton:

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STAGE0 = [
  'format-check', 'lint', 'lint-px', 'lint-colors', 'lint-rem',
  'lint-inline-styles', 'lint-strings', 'lint-unused', 'lint-aptabase',
  'lint-regex', 'typecheck', 'validate-locales', 'audit', 'actionlint',
];

// alias → array of job IDs (one act invocation per ID; `-j` is single-valued).
// Aliases default to the exact job ID, so every ID below also resolves.
const STAGES = {
  format: ['format-check'],
  'lint-styles': ['lint-inline-styles'],
  locales: ['validate-locales'],
  checks: STAGE0,

  build: ['build'],
  unit: ['test-unit'],
  integration: ['test-integration'],
  fuzz: ['test-fuzz'],
  'locale-matrix': ['test-locale-matrix'],
  a11y: ['test-a11y'],
  'big-lists': ['test-big-lists'],
  'route-changes': ['test-route-changes'],
  perf: ['test-perf'],
  mutation: ['mutation-scope'], // plan-only: the matrix shards + gate can't run under act (see §5)
  'coverage-per-file': ['coverage-per-file'],
  'coverage-diff': ['coverage-diff'],

  e2e: ['test-e2e'],
  'e2e-real': ['test-e2e-real'],
  'ipc-abuse': ['test-ipc-abuse'],
  flake: ['test-flake'],
  mcp: ['test-mcp-smoke'],

  all: ['*bare-act'], // sentinel: run `act` with no -j
};

// 1. parse argv → stages[] + actFlags[] (tokens starting with '-')
// 2. unknown stage → print table + exit 1
// 3. resolve job IDs (exact ID, then alias), dedupe preserving order
// 4. warn if `checks` is combined with a stage-1/2 stage (upstream would run twice)
// 5. per job: spawnSync('act', ['-j', id, ...actFlags], { cwd: ROOT, stdio: 'inherit' })
//    sentinel: spawnSync('act', actFlags, …)
// 6. fail fast; propagate exit code
```

Behavior details:
- Windows-safe spawn (`act.exe` resolves from PATH without a shell; add a
  `shell: true` fallback note if ENOENT).
- `--help`/no args prints the §3.2 tables (stage → what runs → warnings).

#### 4. `package.json` — one script entry

```json
"ci:local": "node scripts/act-local.mjs"
```

(Fixed presets are replaced by stage selection; `-- all` covers full runs.)

#### 5. actionlint gate (§3.4)

**a. Try first — no file changes.** `.actrc` line
`--input reviewdog_flags=-reporter=local` routes reviewdog output to stdout
(no token). Validate with `npm run ci:local -- actionlint`.

**b. Fallback — 1-line guard in `.github/workflows/ci.yml`:**

```yaml
      - uses: reviewdog/action-actionlint@v1
        if: ${{ env.ACT != 'true' }}
        with:
          actionlint_flags: -color
```

GitHub behavior is unchanged (`ACT` is never set there). Locally the job
passes without reviewdog; workflow linting stays available via
`act --validate -W .github/workflows/ci.yml`. (Optional later: an
`env.ACT == 'true'` fallback step that downloads the actionlint binary —
keep out of scope for now.)

#### 6. Docs

- `wiki/Local-CI.md` (auto-published by `wiki-sync.yml`): prerequisites,
  usage, full stage table, limitations, troubleshooting.
- One pointer paragraph in `CONTRIBUTING.md`.

---

## 4. Validation plan (ordered)

1. **`.actrc` sanity:** `act -n` → parses rc (positional event, matrix filter,
   artifact path); dry-run lists ubuntu jobs only, no windows/macos legs.
2. **Single-stage smoke:** `npm run ci:local -- format` → real container run
   (first run pulls `catthehacker/ubuntu:act-latest`, ~1–2 GB).
3. **Actionlint gate:** `npm run ci:local -- actionlint` → apply §3.4a; if
   reviewdog still fails, apply §3.4b guard and re-run until green.
4. **Stage-0 chain:** `npm run ci:local -- checks` → 14 sequential
   invocations, all green.
5. **Downstream + artifact upload:** `npm run ci:local -- build` → npm ci in
   container, build, `upload-artifact@v4` against the local artifact server.
6. **Coverage path:** `npm run ci:local -- unit` → coverage generated,
   coverage artifact uploaded, codecov step skipped.
7. **Negative path:** `npm run ci:local -- nope` → friendly error listing
   stages, exit 1.
8. **Flag forwarding:** `npm run ci:local -- format -n` → dry-run honored.
9. **Optional e2e smoke:** `npm run ci:local -- e2e` → validates artifact
   download (build → e2e) and xvfb/Electron-in-Docker; if Electron's sandbox
   fails, document the workaround (§5) and leave e2e to GitHub.
10. **Full-graph selection check (cheap):** `npm run ci:local -- all -n`.

---

## 5. Known limitations & troubleshooting (→ wiki)

- **Windows/macOS matrix legs never run locally** (act limitation). GitHub
  still covers them; `.actrc` filters them out so local runs never fail on
  them.
- **Selecting a stage-1/2 job re-runs its upstream checks** — GitHub DAG
  semantics; act has no skip-needs flag. For a *single* stage-0 check, select
  that check directly (it runs alone).
- **`checks` chain is sequential** across the 14 jobs (GitHub parallelizes
  them). Speed tips: shared action cache `~/.cache/act`, setup-node npm cache
  via act's cache server, and `-r/--reuse` for tight iteration loops (state
  drift risk — don't use before a real push).
- **`all` runs mutation (~6h, advisory) + flake (~90m)** — expected slow;
  prefer targeted stages.
- **`mutation` stage is matrix-driven now (2026-10-09).** The gate is
  `mutation-scope` → `test-mutation-delta` (matrix expanded from
  `fromJSON(needs.mutation-scope.outputs.matrix)`, `if:
  needs.mutation-scope.outputs.has_mutants`) → `mutation-gate`. act 0.2.89
  cannot expand a matrix from a job output, so the shards/gate can't run
  under act; the `mutation` stage maps to the plan-only `mutation-scope`
  job. For real local mutation runs skip act entirely: `npm run test:mutate`
  (full scope) or a scoped scratch via `npx stryker run --mutate "<files>"`.
- **`coverage-diff` base-sha:** pins base via
  `github.event.pull_request.base.sha` — branch should be synced with
  `origin/main`, otherwise the gate sees an empty diff (see comment in
  `ci.yml`).
- **Artifact server reachability:** binds auto-detected host IP
  (`192.168.x.x:34567`). If upload/download steps fail from inside the
  container, adjust `--artifact-server-addr` (e.g. host IP / reachable addr).
- **Don't upgrade `upload-artifact`/`download-artifact` past `@v4`** without
  checking act compatibility (act's artifact server rejects `@v6/@v7`
  payloads).
- **Docker Desktop must be running** before any act command, otherwise act
  fails with a docker connection error.
- **First run** downloads the runner image + actions; later runs hit the
  cache.
- **`.env` is injected as env vars** into every job (act's default
  `--env-file`). Real secrets (if ever needed) go in gitignored `.secrets`.

## 6. Non-goals

- No new workflow files; no duplicated job definitions.
- No windows/macos emulation locally.
- `release.yml`, `nightly.yml`, `site.yml`, `scorecard.yml`, `codeql.yml`
  are out of scope (reachable later via manual `-W` overrides).

## 7. Deliverables checklist

- [ ] `.actrc`
- [ ] `.gitignore` (+`.act-artifacts/`, `+.secrets`)
- [ ] `scripts/act-local.mjs`
- [ ] `package.json` → `"ci:local"` script
- [ ] actionlint fix: `.actrc` flag first, `ci.yml` ACT-guard fallback
- [ ] `wiki/Local-CI.md` + `CONTRIBUTING.md` pointer
- [ ] Validation steps §4 executed and recorded here
