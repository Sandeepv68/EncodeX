# Wiki & Docs Sync Plan

> Goal: bring `wiki/` (and the duplicated doc trees) in line with the actual application state, then add tooling so the numbers cannot silently drift again.
>
> Status: **COMPLETE** (all phases done, verified)
> Created: 2026-10-27
> Scope: `wiki/`, `docs/`, `site/docs/`, `site/locales/*/docs/`, `scripts/`, `.github/workflows/`, `package.json`

---

## Decision log

| # | Decision | Rationale |
| - | -------- | --------- |
| D1 | **Hand-edit all four doc trees** (option C) - no generator/sync script between `wiki/`, `docs/`, `site/docs/`, `site/locales/*/docs/` | Keeps each tree independently editable; no new build coupling. Cost is that fixes must be applied 4x, mitigated by the drift checker (D2). |
| D2 | **Drift checker** (`scripts/check-doc-drift.mjs`) as the single regression guard | Numbers rotted silently in 3 trees; a CI job that recomputes them from source prevents recurrence. |
| D3 | **Markers are language-agnostic**: `<!-- drift:key=value -->` | Localized docs translate prose; a marker keeps the checker working in de/es/fr/hi/pt/zh without per-language regexes. A comment may carry several pairs: `<!-- drift: key=value key=value -->`. |
| D4 | Marker-only verification (files without markers are reported, not failed) | Allows incremental adoption; a `--strict` flag makes missing markers fatal once adoption completes. |
| D5 | Order of work: drift checker -> P0 (factual errors) -> P1 (tree gaps) -> P2 (missing features) -> P3 (propagation/CI) | Checker first so each subsequent edit is verified immediately. |
| D6 | Facts are extracted with the **TypeScript compiler API** (a direct devDependency) | No build step, no new dependency, no fragile regex counting. |

---

## Progress legend

- `[ ]` pending
- `[~]` in progress
- `[x]` done
- `[!]` blocked / no change needed (reason given)

---

## Phase 0 - Drift checker (foundation)

- [x] **P0-1** Design fact set (what gets recomputed from source) - see [Fact set](#fact-set)
- [x] **P0-2** Implement `scripts/check-doc-drift.mjs`
  - [x] Compute facts from source via the TypeScript compiler API (`scripts/lib/doc-drift.mjs`)
  - [x] Scan doc trees (`wiki/`, `docs/`, `site/docs/`, `site/locales/*/docs/`) for `<!-- drift:key=value -->` markers
  - [x] Compare marker value vs computed value -> exit 1 on mismatch
  - [x] `--report-missing` mode listing unmarked doc files
  - [x] `--strict` mode making missing markers fatal
  - [x] `--facts` mode printing the computed fact set
- [x] **P0-3** Add npm scripts `doc:drift`, `doc:drift:strict`, `doc:drift:test`
- [x] **P0-4** Add checker self-test `scripts/check-doc-drift.test.mjs` (node:test, 8 tests passing)
- [x] **P0-5** Wire into `.github/workflows/ci.yml` (job `doc-drift`)

## Phase 1 - P0: factual errors in `wiki/`

- [!] **P1-1** `wiki/Architecture.md` error-code count -> **no change needed**. The wiki said 28 and 28 is correct (`ErrorCode` has 28 members). The earlier "56" figure came from counting `ERROR_MESSAGES` as well. The drift checker proved this; only a marker was added.
- [x] **P1-2** `wiki/Project-Structure.md` - "components/ 49 modules" -> **60 modules** (48 top-level `.tsx` + `copilot/` 8 + `settings/` 4; the earlier "104" counted 44 `__tests__` files)
- [x] **P1-3** `wiki/Project-Structure.md` - "styles/ 48 modules" -> **57** `.ts`
- [x] **P1-4** `wiki/Features.md` - `FFMPEG_FLAGS` row: `-copyts` **does** exist in the code; only `-vn` was missing -> added
- [x] **P1-5** `wiki/Contributing.md` - `npm audit` is a **blocking** CI gate (`npm run audit:gate`); added `lint:unused`, `lint:aptabase`, `lint:regex`; typecheck now documented as **6** tsconfigs; added the doc-drift commands and a Documentation convention bullet
- [x] **P1-6** `wiki/Installation.md` - refreshed the build-script table (`mcp:http`, `mcp:full-test`, `icons:generate`, `fetch:binaries`, `audit:gate`, `doc:drift`, `docs:dev`, `docs:build`)
- [x] **P1-7** `package.json` - added `engines.node: ">=22"` to back the "Node.js 22+" prerequisite
- [x] **P1-8** `wiki/Testing.md` - refreshed lint/validation section and added a "Specialized Test Suites" table (locale matrix, a11y matrix, media fuzz, big lists, route changes, mutation, coverage floors/diff, flake detect)

### New findings from the checker (fixed)

- [x] `shortcuts` is **71**, not 82 (the wiki had counted the 11 section entries as shortcuts) - fixed in `wiki/Features.md`, `wiki/Project-Structure.md` and every doc copy
- [x] MCP Apps views are **11**, not 12 - corrected in `wiki/Features.md`, `wiki/MCP.md`, `wiki/Project-Structure.md`
- [x] `ipc-channels` total is **85** - added to `wiki/IPC-Channels.md`

## Phase 2 - P1: project tree gaps (`wiki/Project-Structure.md`)

- [x] **P2-1** main process: `cli/cli-remux.ts`, `cli/cli-demux.ts`, `queue/persistence.ts`, `queue/queue-transfer.ts`, `spawn-timeout.ts`, `transcoders/bmf-availability.ts`, `generated/*`
- [x] **P2-2** `src/mcp/`: `http.ts`, `http-server.ts`, `safety.ts`, `local-model-client.ts`, `stt-engine.ts`, `translate-engine.ts`, `frame-sampler.ts`, `jobs/task-store.ts`, `ui/{bridge,registry,resources,approval}.ts`, `ui/views/*` (11 views)
- [x] **P2-3** shared: `analytics/*` (5), `ai/*` (34), `ipc-guards.ts`, `csp.ts`; renderer: `analytics/`, `dev/`; `src/test-utils/` (7 helpers)
- [x] **P2-4** `e2e/mcp/`, `e2e/quarantine/`, `e2e/hostile-preload.d.ts`, `e2e/quarantine.json`, `perf/baseline.json`; top-level `scripts/`, `eslint-rules/`, `bin/`, `assets/`

## Phase 3 - P2: undocumented features

- [x] **P3-1** `wiki/Features.md` - new "MCP Apps (Interactive Views)" section (11 views + approval bridge) and the same in `wiki/MCP.md`
- [x] **P3-2** `wiki/Features.md` + `wiki/MCP.md` - new "Local Model Runtime" section (local provider, whisper STT, translation) with the `ENCODEX_*` env vars and the typed unavailable errors
- [x] **P3-3** `wiki/Features.md` - new "Audit Trail" section (`src/shared/audit.ts`, `audit-entry`, `auditStore`)
- [x] **P3-4** `wiki/Features.md` - new "Output Size Estimation" section (experimental, `src/shared/estimate.ts`)
- [x] **P3-5** `wiki/Home.md` + `wiki/Features.md` - version/status note (1.0.0-beta.5, 1.0 production-readiness phase)

## Phase 4 - P3: propagation to duplicate doc trees

- [x] **P4-1** `docs/` - 6 EN files + 6 locales x 6 files fixed (numbers, markers, canonical tree, new feature sections)
- [x] **P4-2** `site/docs/` - 6 files fixed
- [x] **P4-3** `site/locales/{de,es,fr,hi,pt,zh}/docs/` - 36 files fixed
- [x] **P4-4** drift markers inserted into every doc file that states a drift-tracked number (642 markers across 164 doc files; 39 files remain unmarked because they state no drift-tracked fact, e.g. `update-manager.md` and `architecture-transcoders.md`)
- [x] **P4-5** the canonical project-structure tree (from `wiki/`) was copied into all 13 other project-structure documents, so all trees describe the same layout
- [x] **P4-6** new subsystem sections (MCP Apps views, local model runtime, output-size estimation, audit trail) added to the English feature references and translated into de/es/fr/pt/zh (the `hi` tree is English-only in this repo, so it received the English text)

## Phase 5 - P3: CI + verification

- [x] **P5-1** drift checker wired into `.github/workflows/ci.yml` (`doc-drift` job: `npm run doc:drift` + `npm run doc:drift:test`)
- [x] **P5-2** `wiki-sync.yml` gained a `verify` job (drift check) that gates the `sync` job, plus an `env.NODE_VERSION: 22` block
- [x] **P5-3** Final verification run

### Verification results (2026-10-27)

| Command                            | Result                                     |
| ---------------------------------- | ------------------------------------------ |
| `npm run doc:drift`                | PASS - 26 facts, 164 doc files, 642 markers, 0 failures |
| `npm run doc:drift:test`           | PASS - 8/8 tests                           |
| `npm run typecheck`                | PASS - 6 tsconfigs                         |
| `npm run format:check`             | PASS                                       |
| `npm run lint`                     | PASS                                       |

`npm run doc:drift:strict` additionally fails on the 39 doc files that carry no drift-tracked fact (e.g. `update-manager.md`); CI runs the non-strict variant so those files stay unmarked until they gain a claim.

---

## Fact set

Recomputed from source by `scripts/check-doc-drift.mjs` (values as of 2026-10-27):

| Key | Source of truth | Value |
| --- | --------------- | ----- |
| `video-codecs` | `src/shared/media-options.ts` -> `VIDEO_CODECS` | 51 |
| `audio-codecs` | `src/shared/media-options.ts` -> `AUDIO_CODECS` | 27 |
| `pixel-formats` | `src/shared/media-options.ts` -> `PIXEL_FORMATS` | 56 |
| `builtin-profiles` | `src/shared/profiles/builtin.ts` -> `BUILTIN_PROFILES` | 115 |
| `profile-categories` | `src/shared/profiles/categories.ts` -> `PROFILE_CATEGORIES` | 8 |
| `shortcuts` | `src/renderer/constants/shortcuts.ts` -> `SHORTCUTS` | 71 |
| `shortcut-sections` | `src/renderer/constants/shortcuts.ts` -> `SHORTCUT_SECTIONS` | 11 |
| `locales` | `src/renderer/i18n/locales/*.json` | 56 |
| `locale-subtags` | distinct base subtags of locale filenames | 36 |
| `error-codes` | `src/shared/errors.ts` -> `ErrorCode` | 28 |
| `ipc-channels` | `src/shared/ipc-channels.ts` -> `IPC` | 85 |
| `renderer-pages` | `src/renderer/pages/*.tsx` | 13 |
| `renderer-stores` | `src/renderer/stores/*.ts` (excl. `types.ts`) | 20 |
| `renderer-components` | `src/renderer/components/**/*.tsx` (excl. tests) | 60 |
| `renderer-components-top` | `src/renderer/components/*.tsx` | 48 |
| `renderer-component-tests` | `src/renderer/components/**/*.test.tsx` | 44 |
| `renderer-styles` | `src/renderer/styles/**/*.ts` | 57 |
| `test-files` | `src/**/*.{test,spec}.{ts,tsx}` | 314 |
| `log-constants` | `src/shared/log-constants.ts` -> exported consts | 527 |
| `mcp-tools` | `src/mcp/server.ts` -> registered tool names | 36 |
| `mcp-registrations` | tools + app-only `commit_operation` | 37 |
| `mcp-gui-tools` | `src/main/mcp/gui-tools.ts` | 6 |
| `cli-subcommands` | `src/shared/constants.ts` -> `CLI_SUBCOMMANDS` | 8 |
| `e2e-specs` | `e2e/specs/*.spec.ts` | 31 |
| `video-filter-presets` | `src/shared/video-filters.ts` -> `FILTER_PRESETS` | 8 |
| `copilot-operations` | `src/shared/copilot.ts` -> `CopilotOperation` | 13 |

---

## Marker convention

Inline (preferred, used in `wiki/`):

```md
Some prose stating 51 video codecs. <!-- drift:video-codecs=51 -->
```

File-level block (used in the translated trees, where prose is translated):

```md
<!-- drift: video-codecs=51 audio-codecs=27 pixel-formats=56 -->
```

Rules:

- One or more `key=value` pairs per comment, space separated.
- Value must equal the computed fact exactly.
- Keys not in the fact set are ignored (forward-compatible).
- Files with no markers are reported by `--report-missing`; `--strict` fails on them.
- A malformed comment is ignored entirely rather than partially applied.

---

## Change log

| Date | Change |
| ---- | ------ |
| 2026-10-27 | Plan created; audit of `wiki/` vs code completed. |
| 2026-10-27 | Drift checker implemented (TS compiler API), self-tested, wired into CI and wiki-sync. |
| 2026-10-27 | `wiki/` corrected (shortcuts 82->71, components 49->60, styles 48->57, `-vn` flag, lint/audit/typecheck guidance, script table, `engines`, new feature sections, version status). |
| 2026-10-27 | Project-structure tree completed in `wiki/` and copied into all 13 sibling project-structure documents. |
| 2026-10-27 | Numbers, markers and new sections propagated to `docs/`, `site/docs/` and `site/locales/*/docs/` (118 files touched, 642 markers). |
| 2026-10-27 | Verification passed: doc:drift, doc:drift:test, typecheck, format:check, lint. |
