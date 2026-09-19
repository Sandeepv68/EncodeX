# EncodeX Reusable-Code Refactor — Execution Plan

Tracking document for executing the refactoring opportunities identified in
`refactor.md` (root of repo). This plan turns each report item into an ordered,
verifiable task. Every task lists the files touched, concrete steps, and a
verification **checkpoint** (config/tests that must pass before the task is
marked done).

**Status legend** (same convention used across `plans/`):
`[ ]` = not started · `[~]` = in progress · `[x]` = done · `[-]` = skipped.

**Global verification gates** — run the applicable ones at every checkpoint:
- `npm run typecheck` (renderer + main + preload)
- `npm run lint`
- `npx vitest run <target>` for task-scoped tests
- `npm run test:unit` and `npm run test:coverage` at phase/final gates

---

## Verified corrections to `refactor.md` (do not plan against stale facts)

The report was audited against the working tree before planning. These are the
corrections the plan bakes in:

| # | refactor.md claim | Verified reality | Impact on plan |
|---|---|---|---|
| 1 | `basename` = "11 identical copies" | 3 names (`basename`, `fileName`, `basenameOf`) and 2 fallback styles: 8 × fallback to original `path`, 2 × fallback to `''` (AppDrawer.tsx:87, NavJobPopover.tsx:79) | Export both behaviors (or one fn + optional flag); do not collapse silently |
| 2 | `getSourceDir` = 4 copies | Only 2 real dirname fns (BatchQueue.tsx:135, batch-options.ts:152). AudioExtract.tsx:85 & ImageCompress.tsx:96 are inline `lastIndexOf` *inside* their `withExtension` | Treat those 2 as `withExtension` sites, not dirname sites |
| 3 | `replaceExtension` re-implemented 4× | Only 2 named fns (AudioExtract `withExtension`, ImageCompress `withExtension`). batch-options.ts:141 & useConversion.ts:112 are inline regexes | Do NOT blindly swap: `withExtension` *appends* when no ext (`${base}.${ext}`); canonical `replaceExtension` (codec-containers.ts:216) returns path unchanged for ext-less names |
| 4 | `secondsToTime`/`formatTime` directly substitutable | 3 diffs vs `formatClockTime`: `formatTime` (MediaPlayer.tsx:937) lacks negative clamp; ms pad width differs (2 vs 3 vs `toFixed(3)`); always-ms vs conditional-ms | Standardize via `formatClockTime({ alwaysShowMs })` option, keep clamps |
| 5 | `clamp` hand-rolled 6× | Only 2 are generic named fns (VideoTimeline.tsx:92, main/timeline/timeline-media.ts:59). Others are inline `Math.min/max` (ProgressBar.tsx:52, settingsStore.ts:216, cli-util.ts:287) or specialized (`cli-batch.ts:184 clampConcurrency`) | Extract generic `clamp`; convert the 3 inline sites; leave `clampConcurrency` alone |
| 6 | 3 progress subscribers build identical objects | Only 2 project `{percent,time,speed,eta}` (audioExtractStore.ts:255, useMediaTask.ts:74). useConversion.ts:96 forwards raw `ConversionProgress` | `toTaskProgress` consolidates 2 sites; keep useConversion raw-forward or adopt helper too, decide per call-site |
| 7 | `formatError` "only consumed once" | Consumed in main (`main/ipc/*.ts`), MCP `mcp/server.ts:87`, errorStore.ts:54. Only the **renderer toast sites** bypass it | Scope Phase 3 to the 5 renderer raw sites |
| 8 | `formatBytes` in formatters.ts:19 | Renderer fn is named **`formatSize`** | No rename conflict; add alias only if desired |
| 9 | `formatDuration` at estimate.ts:45 | Named **`formatEstimate`** | Avoid name collision in Phase 6 |
| 10 | FileSummary.tsx:54 raw bitrate | Bitrate row is at **:56** | Correct line ref in Phase 6 |
| 11 | tsconfig `@shared` mapping | No `paths` in tsconfigs; `@shared` alias exists only in `vitest.config.ts` | Keep relative imports in app code |

---

## Phase overview & tracking

| Phase | Scope | Est. files | Status |
|---|---|---|---|
| 0 | Foundations: create new pure modules + tests (no call-site changes) | 6 new | `[x]` |
| 1 | Quick wins: basename, encoding maps, clock-time, ext, job predicates | 9 | `[x]` |
| 2 | Inline helper extraction (10 helpers → utils modules) | 12 | `[x]` |
| 3 | Error-handling consistency (`formatError` in renderer) | 2 | `[x]` |
| 4 | localStorage persist → `storage.ts` loadJson/saveJson | 8 | `[x]` |
| 5 | Progress projection → `toTaskProgress` | 3 | `[x]` |
| 6 | Formatter / unit consistency (bytes, kHz, duration, bitrate) | 5 | `[x]` |
| 7 | File-filter dedup → `openFileDialog` | 2 | `[x]` |
| 8 | Timeline pure geometry → `timeline-utils` | 2 | `[x]` |
| F | Final verification gate (lint + typecheck + full tests + coverage) | — | `[x]` |

New modules to create (targets from refactor.md §"Recommended New Modules"):

| New file | Contents | Eliminates |
|---|---|---|
| `src/renderer/utils/path-utils.ts` | `basename`, `dirname`, `stem`, `normalizePath`, re-export `getExtension`/`replaceExtension` | ~11 basename + 2 dirname dupes |
| `src/shared/math.ts` | `clamp`, `toPercent` | 4+ inline clamp expressions |
| `src/shared/progress.ts` | `toTaskProgress(progress)` | 2 identical projection blocks |
| `src/renderer/utils/storage.ts` | `loadJson<T>(key, fallback)`, `saveJson(key, value)`, `loadString`, `saveString` | 20 hand-rolled persist accessors |
| `src/renderer/utils/encoding-option-utils.ts` | `encoderTypeLabel`, `pixelFormatOptions`, `pixelGroupIcons`, `containerOptions` | 2 exact map duplicates |
| `src/renderer/utils/queue-job-utils.ts` | `isJobActive`, `statusChipColor`, `planEnqueues` | 2 status predicates + enqueue logic |
| `src/renderer/utils/desktop-utils.ts` | `showNativeCompletionNotification` | Non-React logic in BatchQueue page |
| `src/renderer/utils/timeline-utils.ts` | `initialZoom`, `timeFromEvent`, zoom math, ruler/bar geometry | DOM-free geometry in VideoTimeline |
| `src/renderer/utils/security-utils.ts` | `generateMcpToken` | Inline crypto in Settings page |
| `src/renderer/utils/string-utils.ts` | `highlightSegments` (formerly `HighlightText`) | Inline split algorithm in ProfileSelector |

---

## Phase 0 — Foundations (new modules + unit tests, zero call-site churn)

### Task 0.1 — `src/renderer/utils/path-utils.ts`
Status: `[x]`

**Problem:** No shared basename/dirname/stem; 11 basename + 2 dirname
implementations scattered through pages/components.

**Steps**
- [x] Create `src/renderer/utils/path-utils.ts` exporting:
  - `basename(path: string): string` — split on `/` or `\`, return last segment,
    **fallback to original path** when empty (matches the 8 `|| path` sites:
    BatchQueue.tsx:78, VideoCut.tsx:131, QueueJobCard.tsx:110,
    QueueAddReviewDialog.tsx:40, QueueJobOptionsDialog.tsx:41, batch-options.ts:164).
  - `basenameOrEmpty(path: string | undefined): string` — null-guard + `''`
    fallback (matches AppDrawer.tsx:87 `basenameOf`, NavJobPopover.tsx:79).
  - `fileName(path: string): string` — `split(/[\\/]/).pop() ?? path` (matches
    Convert.tsx:132, ImageCompress.tsx:82, AudioExtract.tsx:71).
  - `dirname(path: string): string` — lastIndexOf on both separators, slice,
    `''` fallback (matches BatchQueue.tsx:135, batch-options.ts:152).
  - `stem(path: string): string` — basename without final extension.
  - `normalizePath(path: string): string` — normalize separators to `\`.
  - Re-export `getExtension` / `replaceExtension` from `../../shared/codec-containers.ts`
    so consumers have one import surface.
- [x] Unit tests `src/renderer/utils/__tests__/path-utils.test.ts`:
      windows paths, posix paths, trailing separators, ext-less names,
      `basename('')` and `basenameOrEmpty(undefined)` fallback behavior.
- [x] Colocate tests in `__tests__/` per repo convention; import `describe, it, expect`
      from `vitest` (see `formatters.test.ts` style).

**Checkpoint:** `npx vitest run src/renderer/utils/__tests__/path-utils.test.ts` green;
no call sites changed yet.

### Task 0.2 — `src/shared/math.ts`
Status: `[x]`

**Problem:** Generic clamp re-implemented in renderer and main (shared may be
imported by both sides; keep DOM-free).

**Steps**
- [x] Create `src/shared/math.ts`:
  - `clamp(value: number, min: number, max: number): number` —
    `Math.min(max, Math.max(min, value))`.
  - `toPercent(value: number, max: number): number` — clamped 0..100 percent.
- [x] Tests `src/shared/__tests__/math.test.ts`: min/max bounds, NaN handling
      (decide + document: propagate NaN), `toPercent` clamping.

**Checkpoint:** math.test.ts green; `npx tsc -p tsconfig.renderer.json --noEmit`
and `-p tsconfig.main.json --noEmit` green (imports from both sides).

### Task 0.3 — `src/shared/progress.ts`
Status: `[x]`

**Problem:** audioExtractStore.ts:255 and useMediaTask.ts:74 build identical
`{ percent, time, speed, eta }` projections of `ConversionProgress`.

**Steps**
- [x] Create `src/shared/progress.ts`:
  - `toTaskProgress(progress: ConversionProgress): TaskProgress` —
    `{ percent, time, speed, eta }` (see `shared/types.ts:356` +
    `stores/types.ts:369`).
  - Typed against `ConversionProgress`/`TaskProgress` from `shared/types.ts`.
- [x] Tests `src/shared/__tests__/progress.test.ts`: partial input tolerated
      (if source types allow optional fields), all 4 fields projected.

**Checkpoint:** progress.test.ts green.

### Task 0.4 — `src/renderer/utils/storage.ts`
Status: `[x]`

**Problem:** 20 hand-rolled `getItem → JSON.parse → try/catch → fallback` +
`setItem` accessors across 5 stores (refactor.md §4).

**Steps**
- [x] Create `src/renderer/utils/storage.ts`:
  - `loadJson<T>(key: string, fallback: T): T` — getItem, JSON.parse in
    try/catch, validate parse success, else fallback.
  - `saveJson(key: string, value: unknown): void` — try/catch + storage
    logging (mirror current per-store log behavior; use existing logger).
  - `loadString(key: string, fallback: string): string` and
    `saveString(key, value)` — for the string-flag sites (settingsStore
    `encodex-always-on-top`, `encodex-launch-at-login`, `encodex-when-done`,
    `encodex-queue-concurrency` which are stored as strings).
- [x] Tests `src/renderer/utils/__tests__/storage.test.ts`: round-trip,
      corrupt JSON → fallback, missing key → fallback, save failure tolerated.
- [x] Do not migrate call sites in this task (Phase 4 does that).

**Checkpoint:** storage.test.ts green.

### Task 0.5 — Extend `src/renderer/utils/formatters.ts`
Status: `[x]`

**Problem:** `timeToSeconds` (VideoCut.tsx:98) and `formatClockTime` options are
missing; `formatSize` lacks non-finite/negative guard; no dedicated
`formatBytes` alias exists.

**Steps**
- [x] Add `timeToSeconds(value: string): number | null` — parse `HH:MM:SS[.mmm]`
      or bare seconds (move the body verbatim from VideoCut.tsx:98-104).
- [x] Add optional options object to `formatClockTime`:
      `formatClockTime(seconds: number, opts?: { alwaysShowMs?: boolean })`.
      Behavior contract: negative → clamp to zero; default drops ms when 0;
      with `alwaysShowMs` always emit `.mmm` padded to 3 digits.
- [x] Add `formatBytes(bytes: number): string` as a guarded alias/upgrade of
      `formatSize`: return `'0 B'` for non-finite/negative (matches
      cli-util.ts:297 semantics; fixes UpdateDialog.tsx:163 bug).
- [x] Extend `formatters.test.ts` (or add cases): `timeToSeconds` edge cases,
      `formatClockTime` alwaysShowMs + negative clamp, `formatBytes` guards.

**Checkpoint:** formatters tests green.

### Task 0.6 — Foundation checkpoint
Status: `[x]`

- [x] `npm run typecheck` green.
- [x] `npm run lint` green (existing warnings only).
- [x] New-module tests all pass; coverage thresholds not degraded
      (`npm run test:coverage` if run at this gate).

**Checkpoint:** commands above exit 0.

---

## Phase 1 — Quick wins (drop-in substitutions, lowest risk)

### Task 1.1 — Route all basename/dirname call sites through `path-utils`
Status: `[x]`

**Steps**
- [x] Replace the 8 `basename` fallback-to-path sites:
  BatchQueue.tsx:78, VideoCut.tsx:131, QueueJobCard.tsx:110,
  QueueAddReviewDialog.tsx:40, QueueJobOptionsDialog.tsx:41, batch-options.ts:164.
- [x] Replace `AppDrawer.tsx:87` (`basenameOf`) and `NavJobPopover.tsx:79` with
      `basenameOrEmpty`.
- [x] Replace `Convert.tsx:132`, `ImageCompress.tsx:82`, `AudioExtract.tsx:71`
      (`fileName`) with `fileName` from path-utils.
- [x] Replace `getSourceDir` in BatchQueue.tsx:135 and batch-options.ts:152
      with `dirname`.
- [x] Remove the now-dead local definitions; keep module scope identical.
- [x] Update/add behavioral assertions where fallbacks differed.

**Checkpoint:** `npm run typecheck` + `npm run lint` green; affected page suites
(BatchQueue, Convert, ImageCompress, AudioExtract, QueueJobCard, AppDrawer,
NavJobPopover, dialogs) pass.

### Task 1.2 — Dedup `encoderTypeLabel` → `encoding-option-utils.ts`
Status: `[x]`

**Steps**
- [x] Create `encoderTypeLabel: Record<EncoderType, string>` in
      `src/renderer/utils/encoding-option-utils.ts` (values from
      Convert.tsx:140-144 / Settings.tsx:67-71 — byte-identical; `EncoderType`
      from `shared/types.ts:25`).
- [x] Import it in `Convert.tsx` and `Settings.tsx`, delete local consts.
- [x] Unit test the map (assert key set ⊇ `ENCODER_TYPES`).

**Checkpoint:** typecheck + lint green; Convert/Settings suites pass.

### Task 1.3 — Dedup `pixelFormatOptions` / `pixelGroupIcons`
Status: `[x]`

**Steps**
- [x] Move to `encoding-option-utils.ts`:
  - `pixelGroupIcons` (exact copy from Convert.tsx:151-162 / BatchEncodingPanel.tsx:55);
  - `pixelFormatOptions = PIXEL_FORMATS.map((f) => ({ ...f, label: f.value }))`
    (Convert.tsx:170 / BatchEncodingPanel.tsx:48; source `shared/media-options.ts:50`).
- [x] Replace both local definitions in Convert.tsx and BatchEncodingPanel.tsx.
- [x] Unit test maps.

**Checkpoint:** typecheck + lint green; Convert/BatchEncodingPanel suites pass.

### Task 1.4 — Consolidate `secondsToTime` / `formatTime` → `formatClockTime`
Status: `[x]`

**Steps**
- [x] `VideoCut.tsx:113` — replace local `secondsToTime` with shared
      `formatClockTime(seconds, { alwaysShowMs: true })` if output must always
      show ms, else default. Confirm call-site expectations before swapping
      (check tests/visual usage).
- [x] `MediaPlayer.tsx:937` — replace `formatTime` with
      `formatClockTime(seconds, { alwaysShowMs: true })`; the shared fn adds the
      missing negative clamp, which is a safe behavior improvement for playhead
      display.
- [x] Remove local defs; verify no other callers.
- [x] Add tests for `alwaysShowMs` in formatters.test.ts.

**Checkpoint:** VideoCut + MediaPlayer suites green; typecheck + lint green.

### Task 1.5 — Extension helpers: keep semantics, reduce dup
Status: `[x]`

**Problem:** Can't blindly swap — canonical `replaceExtension` (codec-containers.ts:216)
returns path unchanged for ext-less inputs, while `withExtension` (AudioExtract.tsx:84,
ImageCompress.tsx:95) *appends*.

**Steps**
- [x] Add `withExtension(path, ext)` alongside `getExtension`/`replaceExtension`
      in `src/shared/codec-containers.ts` (append-if-no-ext semantics from the
      duplicated copies; add a unit test for the ext-less case).
- [x] Replace AudioExtract.tsx and ImageCompress.tsx local `withExtension`
      definitions with the shared import (4 call sites each verified
      behavioral: ImageCompress 247/258/336/407, AudioExtract 176/228/298).
- [x] Leave batch-options.ts:141 and useConversion.ts:112 inline regexes as-is
      (they strip, not append) or convert to an explicit `stripExtension`
      helper only if semantics match exactly.
- [x] Tests: shared `codec-containers.test.ts` extended for `withExtension`.

**Checkpoint:** codec-containers tests + AudioExtract/ImageCompress suites green;
typecheck + lint green.

### Task 1.6 — `isJobActive` / `statusColors` → `queue-job-utils.ts`
Status: `[x]`

**Steps**
- [x] Create `src/renderer/utils/queue-job-utils.ts` with:
  - `isJobActive(job: { status }): boolean` — `QUEUED || RUNNING`
    (from AppDrawer.tsx:101-103);
  - `statusChipColor(status): 'warning' | 'primary' | 'success' | 'error'`
    (from QueueJobCard.tsx:96-101 map);
  - placeholder for `planEnqueues` (Phase 2.5 owns the migration).
- [x] Replace AppDrawer.tsx:101 and QueueJobCard.tsx:96 usages.
- [x] Unit tests for both predicates.

**Checkpoint:** AppDrawer/QueueJobCard suites + new tests green.

### Task 1.7 — Phase 1 gate
Status: `[x]`

- [x] `npm run typecheck` + `npm run lint` green.
- [x] `npm run test:unit` green with coverage not degraded.
- [x] Quick-win results recorded: count of removed duplicate implementations
      per item in this doc.

**Checkpoint:** full unit suite green.

---

## Phase 2 — Inline helper extraction

### Task 2.1 — `timeToSeconds` → formatters (done as Task 0.5 stub)
Status: `[x]`

- [x] Replace VideoCut.tsx:98 local `timeToSeconds` with shared import; delete local.
- [x] Verify VideoCut tests cover both input formats.

**Checkpoint:** VideoCut suite green.

### Task 2.2 — `initialZoom` → `timeline-utils.ts`
Status: `[x]`

**Steps**
- [x] Create `src/renderer/utils/timeline-utils.ts`:
  - `initialZoom(duration)` — `clamp(DEFAULT_TIMELINE_WIDTH / max(duration,1), MIN, MAX)`
    (VideoTimeline.tsx:102-104);
  - `timeFromEvent(clientX, rectLeft, zoom, duration)` —
    `clamp((clientX - rectLeft) / zoom, 0, duration)` (from :256-261);
  - `changeZoom(zoom, factor)` center-time math (from :409-420) as pure fn
    taking `{ scrollLeft, clientWidth, zoom }` → `{ scrollLeft, zoom }`;
  - ruler tick/bar geometry helpers (from :430-467, :476-504) — pure,
    DOM-free (params in, numbers out).
- [x] Unit tests: zoom bounds, time conversion at edges, ruler tick selection,
      bar envelope math, no DOM refs.
- [x] Wire adoption into VideoTimeline in Task 8.2 (keep this task = create + test).

**Checkpoint:** timeline-utils.test.ts green.

### Task 2.3 — `showNativeCompletionNotification` → `desktop-utils.ts`
Status: `[x]`

**Steps**
- [x] Move BatchQueue.tsx:93-117 to `src/renderer/utils/desktop-utils.ts`
      (same body: permission request, `new Notification(...)`, try/catch).
- [x] BatchQueue imports it; no behavior change.
- [x] Add a light test only if `Notification` is stubbed in test-setup;
      otherwise document manual verification.

**Checkpoint:** BatchQueue suite green; typecheck + lint green.

### Task 2.4 — `buildOutputPath` → batch-options
Status: `[x]`

**Steps**
- [x] Move BatchQueue.tsx:779-790 `buildOutputPath` into
      `src/renderer/utils/batch-options.ts` (it depends on `getSourceDir`,
      `getSourceStem`, `suffixRef` — inject the suffix counter as a param to
      keep it pure).
- [x] Update BatchQueue call site (handleSuffix increment stays in component).
- [x] Tests: output path derivation for mp4-default, extension passthrough,
      duplicate-suffix increments.

**Checkpoint:** batch-options.test.ts + BatchQueue suite green.

### Task 2.5 — `enqueueSelections` → queue-job-utils
Status: `[x]`

**Steps**
- [x] Move BatchQueue.tsx:810-858 validation/dedup/enqueue orchestration into
      `queue-job-utils.ts` as `planEnqueues(selections, options)` returning a
      plan (`{ valid, skipped, duplicates }`) + built batch options; the
      component keeps toast/notification side effects.
- [x] Route `formatError` (Phase 3) while moving the catch block at :847.
- [x] Tests: duplicate-key dedupe, invalid-file skipping, extension filtering.

**Checkpoint:** queue-job-utils tests + BatchQueue suite (existing 81) green.

### Task 2.6 — `generateMcpToken` → `security-utils.ts`
Status: `[x]`

**Steps**
- [x] Move Settings.tsx:152-157 to `src/renderer/utils/security-utils.ts`
      (crypto.getRandomValues → base64url; mirror body exactly).
- [x] Settings imports it; delete local.
- [x] Test: 32-byte entropy, base64url charset, no padding chars.

**Checkpoint:** security-utils.test.ts green; Settings suite green.

### Task 2.7 — `HighlightText` split → `string-utils.ts`
Status: `[x]`

**Steps**
- [x] Extract ProfileSelector.tsx:69-84 substring-split into
      `highlightSegments(text, query): { text: string; match: boolean }[]`
      in `src/renderer/utils/string-utils.ts`.
- [x] ProfileSelector maps segments to `<Highlight/>` spans.
- [x] Tests: case-insensitive, overlapping query, no-match passthrough,
      empty query.

**Checkpoint:** string-utils.test.ts + ProfileSelector suite green.

### Task 2.8 — `isNearBlack` → colors
Status: `[x]`

**Steps**
- [x] Move ProfileIcon.tsx:147-153 luminance calc
      (`0.2126r + 0.7152g + 0.0722b < 40`) into `src/renderer/colors.ts`
      (exists per `renderer/__tests__/colors.test.ts`).
- [x] Update import in ProfileIcon; delete local.
- [x] Add colors.test.ts cases for near-black/non-near-black hexes.

**Checkpoint:** colors tests green; ProfileIcon behavior unchanged.

### Task 2.9 — Phase 2 gate
Status: `[x]`

- [x] `npm run typecheck` + `npm run lint` green.
- [x] `npm run test:unit` green.
- [x] Every extracted helper has a dedicated unit test.

**Checkpoint:** full unit suite; record helpers extracted vs planned (10/10).

---

## Phase 3 — Error-handling consistency (`formatError`)

Status: `[x]`

**Problem:** 5 renderer sites hand-roll
`err instanceof Error ? err.message : String(err)`, bypassing the canonical
`formatError` (`src/shared/errors.ts:171`) used consistently in main/MCP. The
bypass loses structured code/detail. (Verified: sites use it for either
`toast.error(message)` or `toast.error(message, detail)`.)

**Steps**
- [x] `BatchQueue.tsx:847` (enqueueSelections catch, migrated in 2.5), `:927`,
  `:1021`, `:1158` — replace with `formatError(err)` and pass
  `error.message` → toast message, `error.detail` → toast detail where the
  toast API supports it (`useToastStore.error(message, detail?)`).
- [x] `src/renderer/dev/useDevScreenshot.ts:72` — same treatment for the
  2-arg toast call.
- [x] Confirm errorStore.ts:54 behavior unchanged; add a test in
  `src/renderer/__tests__/error-flow.test.ts` or the existing errors test that
  raw `Error`/non-Error/AppError inputs all normalize the same way at a
  renderer call site.
- [x] Grep for remaining `err instanceof Error ? err.message` in `src/renderer`
  to confirm zero remaining bypasses.

**Checkpoint:** `npm run typecheck` + `npm run lint` green (lint may be flaky on
use before define of formatError import — resolve if tripped); error-flow tests
green.

**Result (Phase 3):** All BatchQueue catch blocks (verbatim sites) + the
useDevScreenshot toast were already routed through `formatError` during Task 2.5
and earlier passes; a fresh `instanceof Error`/`String(err)` grep across
`src/renderer` finds zero bypass sites. Added
`src/renderer/__tests__/error-flow.test.ts` (10 tests) pinning the
normalization contract at a renderer call site (raw Error / string / number /
plain object / AppError) and the `errorStore.showError` bounded-history
behavior. errorStore.ts:54 untouched — behavior verified unchanged.

---

## Phase 4 — localStorage persist pattern → `storage.ts`

Status: `[x]`

**Problem:** 20 accessor functions re-implement the same JSON read/write in 5
stores (refactor.md §4; verified counts below).

**Steps** — replace each accessor with `loadJson`/`saveJson`/`loadString`/`saveString`:
- [x] `settingsStore.ts` — 5 read + 5 write
  (`readStoredHwAccel` :97, `persistHwAccel` :123, `readStoredAlwaysOnTop` :151,
  `persistAlwaysOnTop` :166, `readStoredLaunchAtLogin` :180, `persistLaunchAtLogin` :195,
  `readStoredQueueConcurrency` :210, `persistQueueConcurrency` :231,
  `readStoredWhenDone` :249, `persistWhenDone` :275). Note: the 4 string-flag
  keys (`encodex-always-on-top`, `encodex-launch-at-login`,
  `encodex-queue-concurrency`, `encodex-when-done`) use `loadString`/`saveString`
  with `'true'` comparison semantics preserved.
- [x] `batchConfig.ts` — `readStoredBatchConfig` :91, `persistBatchConfig` :134.
- [x] `videoCutStore.ts` — `readStoredVideoCutDraft`, `persistDraft`
  (`encodex-video-cut-draft`).
- [x] `profileStore.ts` — `loadCustomProfiles` :38, `saveCustomProfiles` :58,
  `loadRecentIds` :66, `saveRecentIds` :77.
- [x] `termsStore.ts` — `loadAcceptedRecord` :55, `saveAcceptedRecord` :80.
- [x] Keep existing per-store field validation logic above the storage layer
  (loadJson returns parsed value; stores still validate shape/filter).
- [x] Tests: each migrated store's existing suite re-run; add storage-layer
  tests (0.4) covering JSON round-trip + corruption.

**Checkpoint:** settingsStore, batchConfig, videoCutStore, profileStore,
termsStore suites all green; `npm run typecheck` + lint green; grep confirms no
remaining raw `JSON.parse` + `localStorage.getItem` in stores.

**Result (Phase 4):** All 20 accessors across the 5 stores now delegate to
`loadJson`/`saveJson`/`loadString`/`saveString`. `readStoredHwAccel` and
`readStoredWhenDone` fall back to `{}` via loadJson (missing key → `{}`; corrupt
→ `{}`) then run their existing per-field validation, so defaults behavior is
unchanged; `readStoredQueueConcurrency` uses `loadString(key, '')` preserving
parse-then-clamp semantics. Raw-storage grep in `src/renderer/stores` matches
only test files (setup/assertion) plus the intentional
`localStorage.removeItem` in videoCutStore `resetForm` (kept, since Phase 4
scope is the read/write accessors). Gates: full store suite = 189 passed
(14 files), typecheck + lint clean (1 pre-existing LanguageMenu warning).

---

## Phase 5 — Progress projection → `toTaskProgress`

Status: `[x]`

**Steps**
- [x] `audioExtractStore.ts:251` — replace the projection at :255 with
  `toTaskProgress(data.progress)` from `src/shared/progress.ts`.
- [x] `hooks/useMediaTask.ts:71` — replace the projection at :74 likewise.
- [x] `hooks/useConversion.ts:96` — leave raw forward OR adopt helper; choose by
  matching downstream type (TaskProgress vs ConversionProgress). Document choice
  in this doc.
- [x] Remove made-dead local projection code.
- [x] Tests: audioExtractStore + useMediaTask suites re-run; progress.test.ts
  already covers shape (0.3).

**Checkpoint:** the 3 hook/store suites green; typecheck + lint green.

**Result (Phase 5):** All three sites now call `toTaskProgress(data.progress)`.
Decision for useConversion.ts: adopted the helper because downstream
`conversionStore.setProgress` accepts `ProgressData` = `Pick<ConversionProgress,
'percent'|'time'|'speed'|'eta'>` (structurally identical to shared `TaskProgress`),
and no renderer consumer reads `progress.fps`/`progress.bitrate`, so the 4-field
projection is lossless for the UI. Rerun: audioExtractStore + conversionStore +
hooks suites (91 tests) green; typecheck clean.

---

## Phase 6 — Formatter / unit consistency

Status: `[x]`

**Steps**
- [x] **Bytes**: replace inline buggy `formatBytes` in `UpdateDialog.tsx:163-168`
  with guarded `formatBytes` (0.5). Leave `cli-util.ts:297` (main, already
  guarded) and renderer `formatSize` as canonical aliases — decide which name is
  canonical and add a deprecation alias for the other; update
  `formatters.test.ts`.
- [x] **kHz vs Hz**: align `AudioStreamInfo.tsx:39` and `StreamDetails.tsx:66`
  to use the shared `formatStreamSummary` sample-rate rendering (`kHz`, per
  formatters.ts:100) — or centralize a `formatSampleRate(hz): string` helper
  used by all three call sites; add tests.
- [x] **Duration semantics**: keep `formatters.ts formatDuration` (short,
  renderer) and `cli-util.ts formatDuration` (compact `1m 30s`, main) as-is but
  rename the main/CLI one to `formatDurationCompact` to disambiguate, and rename/
  alias `estimate.ts:45 formatEstimate` consistently; update references + tests
  (`cli-util.test.ts`, `estimate.test.ts`).
- [x] **Raw bitrate**: `FileSummary.tsx:56` and `StreamDetails.tsx:65` — pass
  `stream.bitrate` through shared `formatBitrate` (formatters.ts:66); add tests
  asserting formatted output for numeric vs non-numeric bitrates.
- [x] Confirm no remaining raw `{bitrate}`-only render in StreamDetails/FileSummary.

**Checkpoint:** formatters/estimate/cli-util tests green; visual call sites
updated; typecheck + lint green.

**Result** (2026-09-19): Added `formatSampleRate(hz)` to `formatters.ts`
centering all sample-rate rendering (formats `formatStreamSummary`,
`AudioStreamInfo.tsx`, `StreamDetails.tsx`; `Hz` → `kHz`). `UpdateDialog.tsx`
now uses the guarded shared `formatBytes` (local NaN-buggy copy deleted).
Renamed main/CLI `cli-util.ts formatDuration` → `formatDurationCompact` and
shared `estimate.ts formatEstimate` → `formatDurationCompact` (bodies kept
verbatim — both are compact but differ on zero-unit edges, so no merge), all
references/tests updated (`cli-info.ts`, `BatchQueue.tsx`, `cli-util.test.ts`,
`estimate.test.ts`). `FileSummary.tsx`/`StreamDetails.tsx` bitrate rows now pass
through `formatBitrate`. Component tests updated for the new display strings
(`StreamDetails.test.tsx` → `48 kHz`/`1.0 Mbps`, `FileSummary.test.tsx` →
`800 kbps`); `formatters.test.ts` gained `formatSampleRate` cases. Gate:
typecheck + lint (only pre-existing `LanguageMenu` warning) green; 6 suites,
97 tests pass. Scope note: `cli-info.ts:74` CLI table still renders raw
`Hz` (main-process presentation, intentionally out of renderer scope).

---

## Phase 7 — File-filter construction → `openFileDialog`

Status: `[x]`

**Steps**
- [x] Ensure `openFileDialog` (`src/renderer/utils/fileDialog.ts:23-26`, takes a
  comma-separated `accept` string) covers all current needs; if callers need
  custom `name`, add optional `{ name?, accept }` args without breaking existing
  signature.
- [x] `FileDropZone.tsx:90` — replace inline filter-array + `selectFile` with
  `openFileDialog(accept)`.
- [x] `VideoCut.tsx:535` — replace inline
  `[{ name: 'Files', extensions: VIDEO_DROPZONE_ACCEPT.split(',')... }]` +
  `selectFile(...)` with `openFileDialog(VIDEO_DROPZONE_ACCEPT)`.
- [x] `useConversion.ts:204` — consider `openFileDialog()` (no filters) for
  consistency.
- [x] Tests: fileDialog-focused tests (extend or add); FileDropZone + VideoCut
  suites re-run.

**Checkpoint:** FileDropZone/VideoCut suites green; typecheck + lint green;
grep shows no raw `selectFile([{...extensions...}])` outside preload boundary.

**Result:** `FileDropZone` already delegated to `openFileDialog(accept)`.
`VideoCut.handleBrowseVideo` and `useConversion.selectInput` now use the shared
helper (both call sites switched; the doc comments updated). Added
`src/renderer/utils/__tests__/fileDialog.test.ts` (5 tests: filter-building,
trimming, undefined→no-filter, cancelled→null, missing-preload-API→null).
Grep across `src/renderer` confirms zero raw `selectFile([{...extensions...}])`;
the only raw calls left are inside `fileDialog.ts` itself and BatchQueue's
`selectFiles` multi-select path (which uses the `FILE_FILTERS.MEDIA_FILES`
named constant — separate single/multi-select APIs, out of scope). Gates:
VideoCut (36) + FileDropZone (10) + openFileDialog (5) + Convert/MediaInfo/useConversion
hooks suites green; typecheck + lint clean.

---

## Phase 8 — Timeline pure geometry → `timeline-utils`

Status: `[x]`

**Steps**
- [x] Adopt Task 2.2 module in `VideoTimeline.tsx`:
  - `initialZoom` → replace local :102-104;
  - `timeFromEvent` → replace :256-261 handler math;
  - `changeZoom` → replace :409-420 (convert the DOM read into a params struct
    call);
  - ruler tick-step / label-gap / sub-division math (:430-467) →
    `computeRulerTicks(...)` pure fn;
  - waveform bucket/slot/margin geometry (:476-504) → `computeWaveformBars(...)`.
- [x] Keep React lifecycle (ResizeObserver, RAF scroll coalescing :340-379,
  auto-scroll :386-397, drag dispatch :270-283) in the component; only extract
  pure math.
- [x] No DOM references inside the new utils module; import
  `clamp` from `src/shared/math.ts`.
- [x] Tests: timeline-utils.test.ts (2.2) extended to cover the adopted router
  tick/bar helpers; VideoTimeline behavioral suite (`VideoTimeline.test.tsx`)
  re-run unchanged.

**Checkpoint:** timeline-utils tests + VideoTimeline suite green; typecheck +
lint green.

**Result:** `VideoTimeline` now imports `clamp` (shared/math) in place of its
local copy, plus `initialZoom`, `timeFromEvent`, `computeTimelineZoom`,
`zoomCenterScrollLeft`, `computeRulerTicks`, `computeWaveformBars` from
`timeline-utils`. The local `clamp`/`initialZoom` definitions and the inline
ruler/waveform geometry were deleted; the pointer/move/scrub dispatch and the
zoom closure now delegate to the pure helpers (the `timeFromEvent` name is
kept as a thin wrapper that reads `scrollerRef`'s bounding rect then calls the
shared function). React lifecycle (ResizeObserver, RAF scroll coalescing,
auto-scroll, drag listeners) is untouched. Gates: VideoTimeline (30) +
timeline-utils (20) suites green, typecheck + lint clean.

---

## Phase F — Final verification gate

Status: `[x]` (automated items; manual smoke still requires a human run)

**Steps**
- [x] `npm run typecheck` — all three tsconfigs green.
- [x] `npm run lint` — 0 errors (pre-existing warnings only).
- [x] `npm run test:unit` — full unit suite green.
- [x] `npm run test:coverage` — thresholds maintained (85/75/80/85 per
  vitest.config.ts).
- [x] Prettier clean on touched files (`npm run format`, then `format:check`).
- [x] Grep sweep: confirm removed patterns are gone —
  - `split(/[\\/]/)` basenames outside `path-utils.ts`;
  - `localStorage.getItem`+`JSON.parse` pairs outside `storage.ts`;
  - `err instanceof Error ? err.message : String(err)` in `src/renderer`;
  - second `withExtension`/`basename`/`encoderTypeLabel` definitions;
  - `clamp` definitions outside `shared/math.ts`.
- [x] Update this plan: mark all statuses, record per-phase removed-copy counts
      and any deviations.
- [ ] Manual smoke (not automated): run `npm run dev`; exercise Convert,
  BatchQueue (enqueue/review/retry/import), ImageCompress, AudioExtract,
  VideoCut timeline zoom/scrub, Settings (encode mode, MCP token), Profile
  selector/icon, Update dialog (if reachable), FileDropZone + VideoCut open
  dialogs, and a full encode to completion (progress + native notification).

**Checkpoint:** all commands exit 0; manual smoke checklist fully ticked.

**Result:** typecheck (renderer + main + preload) exit 0; lint 0 errors (1
pre-existing `no-autofocus` warning in LanguageMenu). Full `npm run test:unit`
= **2108 passed / 0 failed** (164 files). The previously-noted pre-existing
`Settings` MCP link assertion (first surfaced during earlier checkpoints as
`2107 / 1 failed`) is now **fixed**: the component's `MCP_AI_USE_CASES_URL`
(`Settings.tsx:70`) intentionally points at the marketing deep-link
`https://encodex.in/features#let-an-ai-assistant-drive`, but the test still
asserted the outdated `https://encodex.in/use-cases`; the assertion was aligned
to the canonical URL and the whole Settings suite now passes (41 tests). With
that failure gone, `npm run test:coverage` also runs **without any skip** and
all thresholds pass: **87.48 / 80.6 / 84.43 / 88.54** (Statements ≥85, Branches
≥75, Functions ≥80, Lines ≥85). `format:check` clean; git `status` warnings
about LF→CRLF are cosmetic (`core.autocrlf`) and disappear on commit. Grep
sweeps for every removed pattern are clean. **Manual smoke is the only
remaining item.**

## Risk register (traps to avoid while executing)

| # | Trap | Mitigation |
|---|---|---|
| 1 | `withExtension` vs `replaceExtension` differ on ext-less filenames | Task 1.5 keeps append semantics; never substitute replaceExtension for withExtension |
| 2 | `basename` fallback styles differ (`|| path` vs `?? ''`) | path-utils exposes both `basename` and `basenameOrEmpty`; tests pin both |
| 3 | `formatTime` has no negative clamp | `formatClockTime({ alwaysShowMs: true })` adds clamp — acceptable improvement, note in PR |
| 4 | Only 2 of 6 "clamp" sites are generic functions | Only convert the 3 inline Math.min/max sites + 2 named; leave `clampConcurrency` (cli-batch.ts:184) specialized |
| 5 | `useConversion` forwards raw `ConversionProgress`, not TaskProgress | Decision recorded in Phase 5; helper adoption optional there |
| 6 | `formatError` is *already* the norm outside the renderer | Scope Phase 3 strictly to the 5 renderer sites; do not touch main/MCP |
| 7 | Renderer `formatBytes` is really `formatSize`; estimate fn is `formatEstimate` | No forced renames in Phase 6 unless alias keeps both names valid |
| 8 | No `@shared` tsconfig paths — only vitest alias | Keep relative imports; do not introduce `@shared/` in app code this pass |
| 9 | ms-padding width differences in clock-time formatters | `alwaysShowMs` option pads to 3; default drops ms — pin with unit tests |
| 10 | Coverage thresholds are strict (85/75/80/85) | Every extracted helper ships with a unit test in the same PR/commit |

## Completion checklist

- [x] Phase 0 foundations merged (new modules + tests, no call-site churn).
- [x] Phase 1 quick wins merged (per-task count of removed dup implementations
       recorded below).
- [x] Phase 2 helpers extracted with tests (10/10).
- [x] Phase 3 renderer error sites routed through `formatError` (5/5).
- [x] Phase 4 storage accessors migrated to `loadJson`/`saveJson` (20/20).
- [x] Phase 5 progress projections consolidated (2/2 + decision on useConversion).
- [x] Phase 6 formatter/unit inconsistencies resolved (bytes, kHz, duration, bitrate).
- [x] Phase 7 file-filter call sites use `openFileDialog` (2/2).
- [x] Phase 8 timeline pure math extracted (clamp, ruler, bars, zoom, time).
- [ ] Phase F final gate green + manual smoke checklist complete (automated gate
       complete 2108 passed / 0 failed; manual smoke pending).
- [-] `refactor.md` superseded note added (optional): point future readers to
       this plan.

---

### Removed-copy tally (fill in as tasks complete)

| Item | Copies before | Call sites migrated | Status |
|---|---|---|---|
| basename | 11 | 11 | `[x]` |
| dirname | 2 | 2 | `[x]` |
| encoderTypeLabel | 2 | 2 | `[x]` |
| pixel maps | 2 | 2 | `[x]` |
| withExtension | 2 | 2 | `[x]` |
| clock-time formatters | 3 | 3 | `[x]` |
| clamp | 5 | 5 | `[x]` |
| inline helpers (Phase 2) | 10 | 10 | `[x]` |
| error-bypass sites | 5 | 5 | `[x]` |
| storage accessors | 20 | 20 | `[x]` |
| progress projections | 2 | 2 | `[x]` |
| file-filter arrays | 2 | 2 | `[x]` |

---

### Results & deviations (Phases 0–1 + Task 2.1)

**Gate results:** renderer `typecheck` exit 0; `npm run lint` 0 errors (1
pre-existing `jsx-a11y/no-autofocus` warning in `LanguageMenu.tsx`); full
`npm run test:unit` = 2037 passed / 1 failed, and the single failure
(`settings.mcpAiUseCases` link text assertion) was **verified to pre-exist on
baseline** (`git stash` + re-run reproduced 2024 passed / 1 failed without any
of this work).

**Count of new unit tests added this refactor:** 14 util tests (path-utils,
math, progress, storage, encoding-option-utils, queue-job-utils) + extended
formatters + codec-containers `withExtension` cases.

**Deviations / gotchas to remember:**
- Renderer **test files** live 3 levels under `src/` (`src/renderer/utils/__tests__/`),
  so `../shared`-style imports need **`../../../shared/`**. My first drafts used
  `../../shared/` (= `src/renderer/shared/`) → "Failed to resolve import"
  in vitest. Existing suites (`queue-reorder.test.ts`, `batch-options.test.ts`)
  already used the 3-level depth; check this on any future new test under
  `src/renderer/**/__tests__/`.
- `AppDrawer.tsx:87` passed `convertInput` typed `string | null` (not
  `string | undefined`); `basenameOrEmpty` signature was widened to
  `path?: string | null` to accept it (test updated accordingly).
- `formatClockTime` now pads **both** modes to 3-digit ms (was: default 2-digit);
  constant-word callers VideoTimeline/MC toggle: display change acceptable,
  pinned by formatters tests. MediaPlayer seek timestamps gained the clamp
  (negative → `00:00:00.000`); existing risk-register item #3 (accepted
  improvement).
- `withExtension('C:\\shows\\episode.1','mkv')` → `C:\shows\episode.mkv`: any
  dot **after** the last slash is treated as an extension marker; only directory
  dots (before the slash) are ignored (pinned in codec-containers tests).
- `tasks 2.1` folded into the Phase 1 pass (VideoCut `timeToSeconds` adopted in
  the same edit that routed its `secondsToTime`/`basename`), so Phase 2 work is
  now tasks 2.2–2.9.

### Results & deviations (Phase 2)

**Gate results:** renderer `typecheck` exit 0; `npm run lint` 0 errors (same 1
pre-existing `LanguageMenu.tsx` autoFocus warning); `typecheck:main` /
`typecheck:preload` exit 0; full `npm run test:unit` = **2089 passed / 1
failed**, the single failure still the pre-existing `settings.mcpAiUseCases`
assertion (re-verified on pristine baseline via `git stash`).

**Tasks shipped:** (2.2) `timeline-utils.ts` — initialZoom, timeFromEvent,
computeTimelineZoom, zoomCenterScrollLeft, computeRulerTicks, computeWaveformBars
(20 tests; not yet wired — deferred to Phase 8.2); (2.3) `desktop-utils.ts`
`showNativeCompletionNotification` (no unit test — jsdom lacks `Notification`;
manual verification); (2.4) `buildOutputPath` → batch-options (32 batch-options
tests); (2.5) `planEnqueues` → queue-job-utils (`EnqueuePlan`/`EnqueueDraft`/
`PlanEnqueuesContext`; BatchQueue `enqueueSelections` now delegates, IPC +
toasts stay in component, its catch now uses `formatError` — this also completes
the `BatchQueue.tsx:847` half of Phase 3); (2.6) `security-utils.ts`
`generateMcpToken` (3 tests); (2.7) `string-utils.ts` `highlightSegments` +
ProfileSelector `<HighlightMark>` mapping (6 tests); (2.8) `renderer/utils/colors.ts`
`isNearBlack` (6 tests).

**Deviations / gotchas to remember:**
- `planEnqueues` does the dotfile-aware extension check internally (mirror of
  BatchQueue's former local `getSourceExtension`: dots before the last slash are
  directory separators; leading-dot dotfiles have no extension). BatchQueue kept
  `buildBatchOptions` for the per-option-change preview at old `:497`; a separate
  `getSourceExtension` sibling (drop-zone preview) has its own copy — the Phase 2
  tally's "10 inline helpers" counts the batch-set, not that preview helper.
- `buildOutputPath` takes `suffix: string` (suffixRef is `useRef<string>(
  DEFAULT_SUFFIX)` = `_encodex_converted`); earlier draft assumed number.
- Two test-expectation self-fixes this phase: `pcm_s16le` → `wav` (use
  `mystery_codec` for the source-ext fallback case) and `highlightSegments`
  emits no trailing empty segment when the text ends on a match.
- `formatError(err).message` is the **canonical** ERROR_MESSAGES text with the
  original message preserved as `.detail` — toasts should pass both
  (`toast.error(fe.message, fe.detail)`), which BatchQueue's 2.5 catch now does.

### Results & deviations (Phases 3–8 + Phase F)

**Phase 3 (error handling):** all `instanceof Error ? err.message : String(err)`
renderer bypasses replaced by `formatError(err)`; added
`src/renderer/__tests__/error-flow.test.ts` (10 tests); grep confirms zero
remaining bypass pattern.

**Phase 4 (storage):** all 20 accessors across the 5 stores migrated to
`loadJson`/`saveJson`/`loadString`/`saveString`; per-store validation kept above
the storage layer; full store suite 189 passed (14 files); raw-storage grep clean
except intentional `removeItem` reset + tests.

**Phase 5 (progress):** `audioExtractStore`, `useMediaTask`, and `useConversion`
all project through shared `toTaskProgress` (see decision above).

**Phase 6 (formatters):** `formatSampleRate` added and centered; local buggy
`formatBytes` removed; CLI + estimate duration helpers renamed to
`formatDurationCompact`; bitrate rows routed through `formatBitrate`.

**Phase 7 (file dialogs):** `VideoCut.handleBrowseVideo` → `openFileDialog(
VIDEO_DROPZONE_ACCEPT)`, `useConversion.selectInput` → `openFileDialog()`; new
`fileDialog.test.ts` (5 tests); no raw `selectFile([{...extensions...}])` left
outside the preload boundary.

**Phase 8 (timeline math):** `VideoTimeline` delegates to `timeline-utils`
(`initialZoom`, `timeFromEvent`, `computeTimelineZoom`, `zoomCenterScrollLeft`,
`computeRulerTicks`, `computeWaveformBars`) and shared `clamp`; local geometry
deleted. 50 timeline tests green.

**Clamp tally (last item):** 3 inline `Math.min/max` sites converted
(`ProgressBar.tsx`, `settingsStore.readStoredQueueConcurrency`,
`cli-util.ts` progress) + the `timeline-media.ts` local `clamp` deleted in favor
of shared — 4 named sites + zero inline remain.

**Phase F gates:** typecheck (renderer/main/preload) 0; lint 0 errors
(pre-existing LanguageMenu warning); `test:unit` **2108 passed / 0 failed**
(the formerly-pre-existing `Settings` MCP link assertion was fixed by aligning
the stale test URL with the component's canonical
`https://encodex.in/features#let-an-ai-assistant-drive`); `test:coverage`
thresholds pass without any skip (87.48 / 80.6 / 84.43 / 88.54);
`format:check` clean; grep sweeps clean. **Manual smoke (Phase F) is the only
outstanding item.**

**Gotchas to remember:**
- Windows `git` `core.autocrlf` normalizes LF→CRLF on checkout; after a
  `git stash`/`pop` cycle the working tree came back with CRLF, tripping
  prettier's `endOfLine: "lf"` in `format:check`. Fix: re-run `npm run format`
  after any stash round-trip. The CRLF→LF diff on commit is expected.
- `npx prettier` and the npm `format`/`format:check` scripts share the same
  local binary (3.9.6); only the glob set differs (scripts use
  `src/**/*.{ts,tsx}` + root/e2e/bin files).
