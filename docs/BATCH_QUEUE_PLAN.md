# Batch Queue Enhancement Plan

**Status:** Approved (A–E, concurrency default 1, full queue restore, per-file review dialog included)
**Scope:** All capabilities and UX gaps identified on the `/batch` BatchQueue page

## Current State

**Toolbar (`BatchControls.tsx`):** operation select (Transcode / Extract Audio / Compress Image), transcoder backend (FFMPEG / FFTOOL / BMF), output suffix field, Add Files, Cancel All.
**Job list (`QueueJobCard.tsx`):** filename, status chip (queued/running/done/error), output path, progress bar while running, error text, per-job Remove.
**Engine (`src/main/queue/job-queue.ts`):** sequential FIFO — exactly one job at a time, in-memory only (lost on restart), fixed codec set (`libx264`/`aac`), uses global hwaccel settings.

### Key gaps found

1. Live progress is **not wired**: main emits `QUEUE_PROGRESS` and preload exposes `onQueueProgress`, but the page never subscribes — bars stay at 0% until done; fps/speed/ETA/bitrate are collected but never shown.
2. No retry, no reorder, no pause/resume, no concurrency control, no persistence.
3. No reveal-in-folder/copy-path, no batch-completion feedback, no filters/sort/search/stats.
4. No drag & drop; all jobs share one config; output is always `source<suffix>.ext` next to source; no duplicate detection.

---

## Cross-cutting Conventions

Applied to every phase:

- **IPC channels:** add to `src/shared/ipc-channels.ts`; register handlers in a domain module under `src/main/ipc/`.
- **Preload:** mirror every new method in `src/preload/index.ts` **and** `src/renderer/electron-api.d.ts`.
- **Test stub:** add one line per new API to `src/test-setup.ts`.
- **Logging:** one template constant per new IPC in `src/shared/log-constants.ts` (project convention).
- **i18n:** add every new key to `en-US.json`, then mirror to the other 19 locale files (mechanical; test setup falls back to the key).
- **Docs:** update `ARCHITECTURE.md` page/IPC tables after each phase. **Note: `docs/ARCHITECTURE.md` does not exist** — only `docs/BATCH_QUEUE_PLAN.md`; keep IPC surface docs in this file's "New IPC Surface" table instead.
- **Verification:** `npm test` + `npm run build` after each phase. **`npm run format:check` is NOT a gate** — it is red repo-wide at HEAD (138 files, pre-existing); prettier is not enforced on this codebase. Only keep new edits in the existing style of the file.

---

## Phase A — Renderer Quick Wins

### A1. Fix live per-job progress

Plumbing already exists; only the page subscription is missing.

- `stores/types.ts` + `queueStore.ts`: add `progress: Record<string, ConversionProgress>` + `updateProgress(id, data)` (the `{ job, progress }` payload: call `updateJob(job)` for the percent, stash the snapshot for captions).
- `BatchQueue.tsx`: subscribe `onQueueProgress`.
- `QueueJobCard.tsx`: accept a `progress` prop; pass `time/speed/eta` into the existing `ProgressBar` (`ProgressBar.tsx:49` already renders them).
- Tests: `queueStore.test.ts`, `QueueJobCard.test.tsx`, `BatchQueue.test.tsx`.

### A2. Retry failed jobs

- `QueueJobCard.tsx`: **Retry** button when `status === ERROR` → `onRetry(job)`.
- `BatchQueue.tsx`: re-enqueue via `queueAdd(job.input, job.output, job.options, job.transcoder)`, remove the errored entry, success toast. i18n `batchQueue.retry`.

### A3. Reveal output / copy path

- New IPC `IPC.REVEAL_FILE` (`queue-reveal`) in new `src/main/ipc/system.ts` using `shell.showItemInFolder(path)`. Preload `revealFile(path)`.
- `QueueJobCard.tsx`: folder-open icon button (enabled when output exists); optional copy-path via `navigator.clipboard`.
- Tests: `main/ipc/system` handler, preload index, `QueueJobCard.test.tsx`.

### A4. Summary stats + batch-finished toast

- `BatchQueue.tsx`: derive queued/running/done/error counts → stats row.
- Effect: when RUNNING count drops to 0 and jobs finished in this run → toast `batchQueue.finished` (`{{done}} succeeded, {{failed}} failed`).

### A5. Status filter chips + search

- Local filter state (all/queued/running/done/error) + filename search; derived filtering in `BatchQueue.tsx`.

### A6. Drag & drop files onto the page

- Reuse `FileDropZone` pattern: window `dragover`/`drop`, map `e.dataTransfer.files` → `getPathForFile`, reuse the enqueue path. Styled drop overlay while dragging.

### A7. Duplicate detection + per-operation extension filtering

- Skip files already queued by normalized input path → toast `batchQueue.skippedDuplicates`.
- Filter by operation using `FILE_EXTENSIONS` (`shared/file-extensions.ts`): images for `compress_image`; video/audio otherwise; warn on skipped.

### A8. Clear completed

- New IPC `IPC.QUEUE_CLEAR_COMPLETED` (`queue-clear-completed`) → `job-queue.ts` removes DONE/ERROR entries; handler in `main/ipc/queue.ts`.
- `BatchControls.tsx`: **Clear completed** button (enabled when any done/error).

---

## Phase B — Queue Engine (Main Process)

### B1. Concurrency control

Largest refactor. `job-queue.ts` serializes with single `running`/`currentJob`/`currentTranscoder`.

- Replace with an active set (job + transcoder emitter per entry) and a `concurrency` cap (constructor param, **default 1**). `processNext` starts up to N QUEUED jobs.
- New IPC `IPC.QUEUE_SET_CONCURRENCY` (`queue-set-concurrency`, 1–4).
- `settingsStore.ts`: persist `queueConcurrency` (localStorage); `BatchControls.tsx` concurrency select.
- Tests: `job-queue.test.ts` (only N run concurrently; drains fully), `main/ipc/queue.test.ts`, `BatchControls.test.tsx`.

### B2. Reorder / priority

- `QueueJob` gains optional `priority: number` (default 0); `processNext` picks highest priority, then FIFO.
- New IPC `IPC.QUEUE_MOVE` (`queue-move`, id + `-1|1`) swapping only among QUEUED jobs.
- `QueueJobCard.tsx`: up/down arrows on queued jobs → `onMove`.
- Drag-and-drop reorder noted as future work; arrows are the MVP.

### B3. Pause / resume queue

`ITranscoder` already has `pause()/resume()` (`main/transcoders/types.ts:36`).

- `job-queue.ts`: `paused` flag; `pause()` pauses the active transcoder and blocks new starts; `resume()` resumes and drains. Add `paused: boolean` to `QueueJob`.
- New IPC `QUEUE_PAUSE` / `QUEUE_RESUME`.
- `BatchControls.tsx`: Pause/Resume toggle (disabled when idle). `QueueJobCard.tsx` passes `paused` to `ProgressBar` (already styled for it).

---

## Phase C — Persistence

### C1. Restore queue across restarts

- `job-queue.ts`: debounce-write a JSON snapshot to `path.join(app.getPath('userData'), 'queue-state.json')` after add/remove/status/progress mutations. On construction, load it: **RUNNING → QUEUED** (rerun on launch); DONE/ERROR preserved; restore concurrency. `cancelAll()` clears the file.
- `queue-state` log constants; main-side unit tests with a temp dir; integration test optional.
- Renderer: no change needed beyond existing `queueList()` on mount.

---

## Phase D — Batch Configuration Depth

### D1. Output directory picker + overwrite handling

- New IPC `IPC.SELECT_DIRECTORY` (`select-directory`, `showOpenDialog` with `openDirectory`) in `dialogs.ts`; preload `selectDirectory()`.
- `BatchControls.tsx`: optional output-folder field + Browse button. `handleAddFiles` builds output as `dir? dir/basename<suffix>.ext : source-adjacent`.
- Overwrite: `QUEUE_ADD` validation — when new `overwrite?: boolean` is false and output exists, reject with a typed error (new code in `shared/errors.ts`). Overwrite toggle in `BatchControls`.
- Tests: `main/ipc/dialogs.test.ts`, `main/ipc/queue.test.ts`, `BatchControls.test.tsx`, `BatchQueue.test.tsx`.

### D2. Mixed per-file operations (review dialog) — **Done**

- New component `QueueAddReviewDialog.tsx`: after picking files, show a MUI dialog listing each file with a per-job operation dropdown (+ codec/transcoder), then enqueue all. `handleAddFiles` becomes "select → review → enqueue". Toolbar op is the pre-filled default.
- Tests: new `QueueAddReviewDialog.test.tsx`, `BatchQueue.test.tsx`. (Per-file codec/transcoder overrides were folded into the operation dropdown; codecs follow from the chosen operation.)

---

## Phase E — Advanced

### E1. Export / import queue — **Done**

- New IPC `IPC.EXPORT_QUEUE` (`export-queue`) → save dialog + write JSON `{version, concurrency, jobs:[{input,output,options,transcoder}]}`; `IPC.IMPORT_QUEUE` (`import-queue`) → open + validate + enqueue via existing `addJob`.
- `BatchControls.tsx`: Export/Import buttons. Log constants + handler tests.
- Implemented as `IPC.QUEUE_EXPORT` (`queue-export`) / `IPC.QUEUE_IMPORT` (`queue-import`) to match the existing `queue-*` channel family (same channels as the IPC surface table below). Export excludes job `id`/`status`/`progress`/`error`/`createdAt`; import applies the file's `concurrency` via `setConcurrency` and re-enqueues via `addJob`. Validation rejects with `ErrorCode.INVALID_QUEUE_FILE`.

### E2. Per-job error details + options summary — **Done**

- `QueueJobCard.tsx`: expand/collapse (MUI `Collapse`) showing full `error`, compact `options` summary (codecs/bitrate/scale/hwaccel), and `createdAt`.

### E3. Estimated remaining time (best-effort) — **Done**

- `src/shared/estimate.ts`: `estimateRemaining(jobs, progress)` derives an estimate from the running jobs' live `eta` snapshots (averaged, valid >0 only) × (queued + running) count; `formatEstimate(seconds)` renders `45s`/`1m 30s`/`1h 5m`.
- `BatchQueue.tsx` stats row appends ` · ETA ~{{eta}}` (i18n `batchQueue.etaEstimate`) whenever running jobs have a usable ETA; hidden otherwise.
- No duration probing; deliberately experimental and kept in the stats row.

---

## New IPC Surface (summary)

| Channel | Direction | Purpose |
| --- | --- | --- |
| `queue-reveal` | invoke | `shell.showItemInFolder(output)` |
| `select-directory` | invoke | Output folder picker |
| `queue-clear-completed` | invoke | Remove done/error jobs |
| `queue-set-concurrency` | invoke | Set parallel jobs (1–4) |
| `queue-move` | invoke | Reorder a queued job (±1) |
| `queue-pause` / `queue-resume` | invoke | Pause/resume the queue |
| `queue-export` / `queue-import` | invoke | Persist queue to/from JSON |

---

## Execution Order

A1 → A3 → A4/A5 → A6/A7 → A2/A8 → B1 → B2/B3 → C1 → D1 → E1/E2 → D2 → E3
(Completed: A1–E3. All phases A–E complete.)

---

## Checkpoints / Progress

Updated at each completed checkpoint so work can be resumed later. "Done" = implemented + tests pass (`npx vitest run <paths>`).

| Item | State | Notes |
| --- | --- | --- |
| A1. Live per-job progress | **Done** | `progress` map + `updateProgress` in store/types; `BatchQueue` subscribes `onQueueProgress`; `QueueJobCard` passes time/speed/eta into `ProgressBar`. Tests: queueStore, QueueJobCard, BatchQueue. 27 tests green. |
| A2. Retry failed jobs | **Done** | `QueueJobCard` Retry button when `status === ERROR` (i18n `batchQueue.retry`); `BatchQueue.handleRetry` re-enqueues via `queueAdd(job.input, job.output, job.options, job.transcoder)`, removes errored entry, success toast. Tests: QueueJobCard, BatchQueue. 23 tests green. |
| A3. Reveal output / copy path | **Done** | New IPC `IPC.REVEAL_FILE` (`queue-reveal`) in `src/main/ipc/system.ts` via `shell.showItemInFolder`; preload `revealFile` + stub + d.ts; registered in `handlers.ts`. `QueueJobCard`: reveal (`faFolderOpen`) + copy-path (`faCopy`, toast `toast.pathCopied`) icon buttons. Tests: system, preload index, handlers, QueueJobCard. 56 tests green (3 files). |
| A4. Summary stats + batch-finished toast | **Done** | `StatsRow` in `BatchQueue.styles.ts` + `batchQueue.stats` key; `BatchQueue` derives queued/running/done/error counts. Batch-finished toast (`batchQueue.finished`): `onQueueStatusChange` tracks RUNNING→DONE/ERROR transitions per session; effect fires once when running count drops >0→0 with tracked finishes, then resets. i18n test map updated in `test-setup.ts`. Tests: BatchQueue (13 green). |
| A5. Status filter chips + search | **Done** | Local `filter` ('all'/QUEUE_STATUS) + `search` state in `BatchQueue`; `FilterRow` (chips + TextField) in `BatchQueue.styles.ts`; derived list filters by status then input basename (case-insensitive). i18n `batchQueue.filters.*` + `batchQueue.search`. Tests: BatchQueue (15 green). |
| A6. Drag & drop files | **Done** | Window-level `dragover`/`dragleave`/`drop` listeners in `BatchQueue` using `getPathForFile(file)`; `dragging` state shows a `DropOverlay` (`BatchQueue.styles.ts`) with `batchQueue.dropHint`. Refactored enqueue into `enqueuePaths(files)` + `enqueuePathsRef` so mount-once listeners call the latest closure. Tests: BatchQueue (drop with files / drop with no files). 17 tests green. |
| A7. Duplicate detection + extension filter | **Done** | `enqueuePaths` skips (a) inputs already in `useQueueStore` (normalized path via `normalizePath`: lowercase + `/` separator) and (b) files whose extension doesn't fit the operation (`isImageFile` for compress-image, non-images otherwise). One `batchQueue.skippedDuplicates` warning toast per skipped batch. Tests: BatchQueue (dup skip, compress-image skip, compress-image enqueue). 20 tests green. |
| A8. Clear completed | **Done** | New IPC `IPC.QUEUE_CLEAR_COMPLETED` (`queue-clear-completed`); `JobQueue.clearCompleted()` removes DONE/ERROR entries (emits `removed` per job, keeps queued/running), handler in `main/ipc/queue.ts`, preload `queueClearCompleted()` + d.ts + stub. `BatchControls` "Clear completed" button (`faCheckDouble`, `batchQueue.clearCompleted`) enabled via `hasCompleted` prop; `BatchQueue.handleClearCompleted` also prunes the local store. Tests: job-queue, queue handlers, preload index, ipc-channels, BatchControls, BatchQueue. |
| B1. Concurrency control | **Done** | `JobQueue` refactored to an active-set model: `activeJobs: Map<id, ITranscoder>` + `concurrency` cap (constructor + `setConcurrency`, clamped 1–4, `MAX_CONCURRENCY`); `processNext` loops `startJob` until the cap is hit; progress/end/error handlers drop the job from the active set and re-drain. New IPC `IPC.QUEUE_SET_CONCURRENCY` (`queue-set-concurrency`) → `queue.ts` handler + preload `queueSetConcurrency()` + d.ts + stub. `settingsStore` persists `queueConcurrency` to localStorage (`readStoredQueueConcurrency` clamps; `setQueueConcurrency` forwards to main); `BatchControls` gets a controlled 1–4 `ConcurrencySelect`; `BatchQueue` pushes the persisted cap on mount. Also fixed a latent missing `Typography` import in `BatchQueue` (used by `DropOverlay`). Tests: job-queue (N concurrent, drain, error-drain, cap raise/lower, clamp), queue handlers, preload index, ipc-channels, BatchControls, settingsStore, BatchQueue. 925 tests green; all builds pass. |
| B2. Reorder / priority | **Done** | `QueueJob` gains optional `priority` (default 0); `JobQueue.addJob(..., priority)` stores it and `processNext` picks the max-priority QUEUED job, then FIFO. New `JobQueue.moveJob(id, direction)` swaps a QUEUED job with its adjacent QUEUED neighbour (non-queued jobs keep their slots), emits `'moved'` `{id, direction}`, returns boolean. New IPC `IPC.QUEUE_MOVE` (`queue-move`) → `queue.ts` handler + `moved` event forwarded as `IPC.QUEUE_MOVED` (`queue-moved`); preload `queueMove()`/`onQueueMoved()` + d.ts + stub. `QueueJobCard` shows up/down arrow buttons (`faArrowUp`/`faArrowDown`, `batchQueue.moveUp`/`moveDown`) on QUEUED jobs → `onMove(id, direction)`; `BatchQueue` wires `onMove` to `queueMove` and mirrors the reorder in `useQueueStore` via `onQueueMoved`. Tests: job-queue (priority + moveJob), queue handlers, preload index, ipc-channels, QueueJobCard, BatchQueue. 940 tests green; all builds pass. |
| B3. Pause / resume queue | **Done** | `QueueJob` gains optional `paused?: boolean`. `JobQueue.paused` flag + `isPaused()`; `pause()` suspends every active transcoder, marks RUNNING jobs `paused: true`, emits `statusChange`, blocks new starts (`processNext` early-returns); `resume()` resumes active transcoders, clears `job.paused`, emits `statusChange`, drains via `processNext`; `cancelAll()` resets the flag. New IPC `IPC.QUEUE_PAUSE` (`queue-pause`) / `IPC.QUEUE_RESUME` (`queue-resume`) → `queue.ts` handlers + preload `queuePause()`/`queueResume()` + d.ts + stub. `BatchControls` Pause (warning, disabled when no active jobs) / Resume (success) toggle via `paused` + `onPause`/`onResume` props; `QueueJobCard` passes `job.paused` to `ProgressBar`; `BatchQueue` holds `paused` state and wires handlers. Tests: job-queue (pause/resume/drain/idempotence/cancelAll), queue handlers, preload index, ipc-channels, BatchControls, BatchQueue. 957 tests green; all builds pass. |
| C1. Restore queue across restarts | **Done** | New `src/main/queue/persistence.ts`: `QueueSnapshot` (version, concurrency, jobs), `QueuePersistence` adapter interface, `FileQueuePersistence` (reads/writes `queue-state.json` in a user-data dir, tolerant `load()` returning null on missing/corrupt files). `JobQueue` constructor now accepts `number | JobQueueOptions` (`{ concurrency?, persistence?, persistDelayMs? }`); on construction `loadPersistedState()` remaps RUNNING→QUEUED (progress reset) so they re-run, preserves DONE/ERROR, restores the clamped concurrency cap, then `processNext()`. Debounced `schedulePersist()` (default 500 ms, unref'd) fires after add/remove/move/start/progress/error/end/pause/resume/setConcurrency; public `flushState()` writes immediately; `cancelAll()` clears the snapshot file. Wired in `main/ipc/queue.ts` via `new JobQueue({ persistence: new FileQueuePersistence(app.getPath('userData')) })`. New log constants `LOG_QUEUE_STATE_RESTORED/SAVED/CLEARED`. Tests: job-queue persistence block (temp dir via `os.tmpdir()+randomUUID`: restore remap, corrupt/missing files, re-run on restore, concurrency restore, flushState, debounce, status transition persistence, cancelAll clears file, re-persist after restore); queue.test.ts electron mock adds `app.getPath`. 967 tests green; all builds pass. |
| D1. Output dir picker + overwrite | **Done** | New IPC `IPC.SELECT_DIRECTORY` (`select-directory`) in `main/ipc/dialogs.ts` via `showOpenDialog({ properties: ['openDirectory','createDirectory'] })`; preload `selectDirectory()` + d.ts + stub. `BatchControls` gains controlled `OutputDirField` + Browse button (`faFolderOpen`, `batchQueue.browse`, placeholder `batchQueue.outputDirPlaceholder`) and an overwrite `Checkbox` (`batchQueue.overwrite`). `BatchQueue` holds `outputDir`/`overwrite` state; `enqueuePaths` builds `dir? dir/basename<suffix>.ext : source-adjacent`, passes `overwrite` as the 5th `queueAdd` arg, and surfaces rejections via an error toast; `handleRetry` always re-enqueues with overwrite. `QUEUE_ADD` handler validates: when `overwrite !== true` and `existsSync(output)`, rejects with new `ErrorCode.OUTPUT_EXISTS` / `outputExistsError()` (`shared/errors.ts`, also classified in `formatError`). Tests: errors (OUTPUT_EXISTS + formatError mapping), ipc-channels (`SELECT_DIRECTORY`), dialogs (registration + returns path/cancelled null), queue (rejects when exists + overwrite disabled, allows when enabled — via hoisted `existsSyncMock` fs mock), preload index (queueAdd 5th arg + selectDirectory), BatchControls (browse/field/checkbox), BatchQueue (dir output path, cancelled→source-adjacent, overwrite pass-through, error toast). 982 tests green; all builds pass. |
| D2. Per-file review dialog | **Done** | New `QueueAddReviewDialog.tsx` (+ `QueueAddReviewDialog.styles.ts`): controlled MUI dialog, one row per selected file (basename) with a per-file operation `Select` (BATCH_OPERATIONS, labels `batchQueue.operation*`) pre-filled from the toolbar operation; local `selections` reset via `useEffect` on open/files/defaultOperation; Confirm passes `{file, operation}[]`; Cancel closes without enqueuing. `BatchQueue` refactored: `handleAddFiles` now only stages `reviewFiles`; `enqueueSelections(selections)` builds options per-operation (transcode keeps video+audio, extract_audio audio only, compress_image video only), honors outputDir + overwrite, warns+skips duplicates/extension-mismatch, success toast per file, `.catch` error toast; drag-drop maps `{file, operation: operationRef.current}` via `enqueueSelectionsRef`. i18n `batchQueue.reviewTitle/reviewAdd/reviewCancel`. Tests: new `QueueAddReviewDialog.test.tsx` (5: rows pre-filled, hidden when closed, confirm defaults, per-file override, cancel), `BatchQueue.test.tsx` (add flows confirm via dialog, per-file override via `within` row scoping, cancel enqueues nothing + closes). 990 tests green; all builds pass. |
| E1. Export / import queue | **Done** | New IPC `IPC.QUEUE_EXPORT` (`queue-export`) / `IPC.QUEUE_IMPORT` (`queue-import`) in `main/ipc/queue.ts`: export via `dialog.showSaveDialog` + `writeFileSync` of `buildQueueExport` (version 1, concurrency via `getConcurrency`, jobs projected to input/output/options/transcoder only); import via `dialog.showOpenDialog` + `readFileSync` + `parseQueueExport` validation (version/concurrency/jobs/fields), applying concurrency via `setConcurrency` then `addJob` per job, rejecting with `ErrorCode.INVALID_QUEUE_FILE`. New `src/main/queue/queue-transfer.ts` (`QUEUE_EXPORT_VERSION`, `QueueExport`/`QueueExportJob`, `buildQueueExport`, `parseQueueExport`, `validateQueueExport`). `JobQueue.getConcurrency()`. Preload `queueExport()`/`queueImport()` + d.ts + stubs. `BatchControls` Export/Import buttons (`faFileExport`/`faFileImport`, `batchQueue.exportQueue`/`importQueue`); `BatchQueue` `handleExport`/`handleImport` with success/error toasts (`batchQueue.exported`/`imported`). Log constants `LOG_IPC_QUEUE_EXPORT/IMPORT_CALLED`, `LOG_QUEUE_EXPORT/IMPORT`. Tests: queue-transfer unit suite, queue handlers (export writes portable snapshot / cancelled / import enqueues / cancelled / unreadable / malformed), preload index, ipc-channels, errors (INVALID_QUEUE_FILE + formatError), BatchControls, BatchQueue. 1020 tests green; all builds pass. |
| E2. Per-job error details | **Done** | `QueueJobCard` gains a chevron toggle (`faChevronDown`/`faChevronUp`, `batchQueue.expandDetails`/`collapseDetails`, `aria-expanded`) that expands an MUI `Collapse` panel (content guarded by `expanded` so collapsed cards keep the DOM clean). Panel shows the full `error` under `batchQueue.detailsError` (the inline error hides once expanded), a compact `buildOptionRows` summary (`batchQueue.option*` keys: codecs, bitrates, qscale, scale, pixel format, trim range `start → end`, duration, copy/audio/hwaccel as Yes/No, hwaccel mode), the transcoder, and `createdAt` formatted via `toLocaleString`. New styles `DetailsBox`/`DetailsLabel`/`OptionsGrid`/`OptionRow`. Tests: QueueJobCard (collapsed default, expand shows summary/transcoder/date, toggle flip, error labeled when expanded / inline when collapsed, trim row). 1026 tests green; all builds pass. |
| E3. Estimated remaining time | **Done** | New `src/shared/estimate.ts`: `estimateRemaining(jobs, progress)` returns seconds (or null) from the running jobs' live `eta` snapshots — averages valid >0 ETAs and multiplies by (queued + running) — and `formatEstimate(seconds)` renders compact `45s`/`1m 30s`/`1h 5m`. `BatchQueue` stats row appends ` · ETA ~{{eta}}` (`batchQueue.etaEstimate`, added to `en-US.json` + test map) whenever a running job has a usable ETA; null (idle/unknown) keeps the plain stats text. No duration probing — deliberately experimental, stats-row only. Tests: `estimate.test.ts` (null when idle/no-usable-eta, extrapolation `45×3=135`, averaging `(30+90)/2×3=180`, zero/non-numeric filtering, done/failed excluded; format boundaries 0/45/59.6→`1m`/90/120/3725/3600/negative) + `BatchQueue.test.tsx` (stats row `ETA ~2m 15s`). 1037 tests green; all builds pass. |

**Working notes:**

- i18n: new keys are added only to `en-US.json`; other locales fall back via `fallbackLng: DEFAULT_LANGUAGE` (`src/renderer/i18n/config.ts:74`). Do NOT mirror keys to the other 19 files — that is deprecated; only translate en-US unless a locale adds a real translation.
- Dev environment is Windows PowerShell; **`rg` is NOT installed** — use `Select-String` or `findstr` for greps.
- FontAwesome icons available in-repo: `faRotateRight` (ErrorBoundary, now Retry), `faFolderOpen` (FilePathField/VideoCut), `faCopy` (TitleBar), `faEye` (Convert), `faDownload` (Logs), `faTrashCan`, `faEraser`.
- A1 added log constant `LOG_UPDATE_PROGRESS` in `src/shared/log-constants.ts`.
- When a `vi.mock('fs', ...)` factory provides named exports for `src` modules to use, every name must also be mirrored inside the factory's `default: {...}` object. Vite's CJS interop rewrites `import { x } from 'fs'` in `src` modules to destructure from the mocked module's **default** export, so a `default` that only carries `existsSync` makes `readFileSync`/`writeFileSync` bindings `undefined` (fixed in `main/ipc/__tests__/queue.test.ts` for E1).
