# Mux Queue Plan

- **Status:** v1 implementation complete - all 38 planned tasks done (Phase 8 deferred)
- **Branch:** `refactor/remove-batch-remux-demux`
- **Created:** 2026-11-10
- **Scope:** Dedicated queue for standalone Remux and Demux jobs, exposed as a new **Mux Queue** tab on the Batch Queue page
- **Progress:** 38 / 42 tasks complete (90%)

## Status Markers

| Marker | Meaning |
| --- | --- |
| `Status: [ ]` | Not started |
| `Status: [~]` | In progress |
| `Status: [x]` | Complete |
| `Status: [!]` | Blocked |
| `Status: [-]` | Cancelled / deferred |

Task steps use GitHub checkboxes. Phase checkpoints must be satisfied before moving to the next phase.

---

## 1. Summary

Add a second, independent job queue in the main process for standalone Remux and Demux operations. The Remux and Demux pages gain an **Add to Queue** action that enqueues the fully configured operation instead of starting it immediately. Both operation types share one queue, shown as a **Mux Queue** tab beside the existing **General Queue** tab on `/batch`. Both pages show live queue status so users can see whether the queue is empty, running, or how many jobs are waiting.

This is deliberately **not** a return of remux/demux to the batch operation list. Commit `f45550d8` removed those operations from the batch queue because one-to-many stream splitting and global batch config do not fit heterogeneous inputs. The mux queue keeps each user action as one self-contained job with its own pre-built options.

## 2. Goals

- **G1:** Enqueue a fully configured Remux job from the Remux page.
- **G2:** Enqueue a fully configured Demux job, including selected streams, split-channel targets, and output directory, from the Demux page.
- **G3:** Store both job kinds in the same dedicated queue.
- **G4:** Add a **General Queue** / **Mux Queue** tab pair to the Batch Queue page.
- **G5:** Show queue status (empty, running, queued count) on the Remux and Demux pages.
- **G6:** Support the core queue lifecycle: add, start, pause, resume, cancel, remove, clear completed, reorder queued jobs, concurrency, and persistence across restarts.
- **G7:** Leave the existing batch queue, CLI, MCP, and standalone direct-run behavior intact.

## 3. Non-Goals

- Re-adding `Remux` or `Demux` to `BATCH_OPERATIONS`.
- Auto-starting a queue when a job is added. Adding must leave jobs `QUEUED`, matching batch behavior.
- Changing the existing **Start now** direct-run path unless the product decision explicitly replaces it.
- Queue export/import, queued-job option editing, and when-done power actions in v1. These are optional phase 8 parity items.
- Deleting partially produced demux outputs after cancellation or failure. Existing direct demux behavior leaves completed targets in place; the queue should document the same policy.
- MCP/CLI exposure of the mux queue.

## 4. Verified Current State

- The working tree is clean on `refactor/remove-batch-remux-demux`; HEAD is `f45550d8 refactor(batch): remove remux and demux operations`.
- `src/shared/media-options.ts` no longer includes remux/demux in `BATCH_OPERATIONS`.
- `src/shared/types.ts:517` still defines `ConversionOperation.Remux` and `ConversionOperation.Demux`; `src/shared/types.ts:413` defines `QueueJob`; `src/shared/types.ts:1278` defines `DemuxTarget`.
- `src/main/queue/job-queue.ts` executes exactly one `convertFile` per job. `processNext` is at `src/main/queue/job-queue.ts:605`; `startJob` is at `src/main/queue/job-queue.ts:678`.
- `src/main/queue/persistence.ts:23` hardcodes `queue-state.json` and validates only the base `QueueJob` shape.
- `src/main/ipc/queue.ts:147` registers one `JobQueue` per registration and clears `queue-state.json` on `will-quit`.
- `src/preload/index.ts:528` exposes the batch queue bridge; `src/renderer/electron-api.d.ts:221` mirrors it.
- `src/renderer/stores/queueStore.ts` mirrors batch jobs and progress; `src/renderer/pages/BatchQueue.tsx` owns the batch page and is synced only while mounted.
- `src/renderer/stores/remuxStore.ts:356` builds a remux plan and calls `convertFile` directly.
- `src/renderer/stores/demuxStore.ts:255` runs demux targets sequentially and calls `convertFile` directly.
- No renderer page currently uses MUI tabs; the mux tab is a new UI pattern in this area.
- Test stubs that enumerate the preload API must be updated: `src/test-setup.ts:175`, `src/test-utils/hostile-api.ts:72`, `src/preload/__tests__/index.test.ts:114`, `src/main/ipc/__tests__/ipc-abuse-sweep.test.ts:586`.

## 5. Design Decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| D1 | Use a **separate `MuxQueue` instance** in main, not the batch `JobQueue`. | Independent lifecycle, concurrency, persistence, and UI. Avoids changing batch semantics. |
| D2 | One mux queue job represents **one user action**: one remux, or one demux batch with N targets. | Matches the user's mental model, keeps queue counts simple, and preserves one status/progress row per action. |
| D3 | A demux job stores `targets[]` and executes them **sequentially** inside that job. | Reuses the proven direct-demux behavior and avoids N separate queue cards for one extraction. |
| D4 | The mux queue has its **own concurrency cap**, default `1`, range `1..MAX_QUEUE_CONCURRENCY`. | Demux jobs are disk-heavy; a separate cap prevents the mux queue from changing batch throughput. |
| D5 | **Add to Queue** becomes the primary action on Remux/Demux; **Start now** remains as a secondary action. | Satisfies "add to queue instead of starting" without removing an existing capability. Can be removed later if product decides. |
| D6 | Use one global `MuxQueueSync` component mounted at the app level. | Remux/Demux pages need queue status even when `/batch` is not mounted. Avoids per-page subscriptions and listener leaks. |
| D7 | Deep-link the tab with `/batch?tab=mux`; default is `general`. | Shareable navigation from toasts/status indicators without new routes. |
| D8 | Persist mux jobs to `mux-queue-state.json`, separate from `queue-state.json`. | No migration, no risk to batch snapshots, independent clearing on quit. |
| D9 | Reuse `QUEUE_STATUS` values for mux jobs. | Consistent chips, filters, and status logic across both queues. |
| D10 | Do not auto-start on add; jobs stay `QUEUED` until Start or an existing running queue frees a slot. | Matches batch queue behavior and avoids surprise disk activity. |

### Recommended v1 scope

- Included: add, list, start, pause, resume, cancel single, cancel all, remove, clear completed, reorder, concurrency, persistence, retry failed, reveal/copy output.
- Deferred: export/import, edit queued options, when-done power action, cross-queue scheduler.

## 6. Data Model

Add shared mux queue types, preferably in `src/shared/types.ts` beside `QueueJob`, or in a new `src/shared/mux-queue-types.ts` re-exported from `src/shared/types.ts`.

```ts
export type MuxQueueKind = 'remux' | 'demux';

export interface MuxQueueTarget {
  /** Absolute output path for this target. */
  output: string;
  /** Fully built options for one FFmpeg invocation. */
  options: ConversionOptions;
  /** Short UI label, e.g. "video:0", "audio:1", "chapters", "mkv". */
  label?: string;
  /** Optional source stream index for demux targets. */
  sourceIndex?: number;
}

export interface MuxQueueJob {
  id: string;
  kind: MuxQueueKind;
  input: string;
  /** Remux: the single output file. Demux: the output directory. */
  output: string;
  targets: MuxQueueTarget[];
  transcoder: TranscoderType;
  status: (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS];
  progress: number;
  error?: string;
  priority?: number;
  paused?: boolean;
  createdAt: number;
}

export interface MuxQueueAddPayload {
  kind: MuxQueueKind;
  input: string;
  output: string;
  targets: MuxQueueTarget[];
  transcoder?: TranscoderType;
  overwrite?: boolean;
}

export interface MuxQueueSnapshot {
  version: number;
  concurrency: number;
  jobs: MuxQueueJob[];
}
```

### Target construction

- **Remux:** `targets` has exactly one entry. Its `options` come from the same `buildAndValidateRemuxPlan` result used by `startRemux`; `output` is the remux output path; `label` can be the target container.
- **Demux:** map each `DemuxTarget` from `demuxStore.targets` to:
  - `output: target.output`
  - `options: optionsForTarget(target)`
  - `label: `${target.kind}:${target.index}``
  - `sourceIndex: target.index`
- Extract `optionsForTarget` from `demuxStore.ts` into `src/shared/demux-utils.ts` so the renderer enqueue path and tests share one implementation.

### Progress model

For a job with `N` targets and a running target at index `i` with percent `p`:

```text
overallPercent = round(((i + clamp(p, 0, 100) / 100) / N) * 100)
```

- Keep the running target's `fps`, `speed`, `eta`, `time`, and `bitrate` in the emitted `ConversionProgress`; only `percent` is aggregated.
- Emit `progress` at most once per underlying progress event. Clamp to `0..100`.
- On completion, set `progress` to `COMPLETED_PROGRESS.percent`.

### Failure and cancellation policy

- A target failure marks the whole mux job `ERROR`, stops remaining targets, and preserves already completed outputs.
- Cancellation stops the current target, removes the job, and preserves already completed outputs.
- `error` should identify the failing target label, e.g. `Demux target audio:1 failed: ...`, so the card is actionable.

## 7. Architecture and Data Flow

```text
Remux page ── build plan ──┐
                           ├── muxQueueAdd(payload) ── IPC ── MuxQueue.addJob()
Demux page ── build targets┘                                      │
                                                                  ├── mux-queue-state.json
                                                                  └── MuxQueueRunner
                                                                        │
                                                                        ├── target 0: FFmpeg transcoder
                                                                        ├── target 1: FFmpeg transcoder
                                                                        └── target N: FFmpeg transcoder

MuxQueue events ── IPC push ── MuxQueueSync ── muxQueueStore ──┬── Mux Queue tab
                                                              ├── Remux status indicator
                                                              └── Demux status indicator
```

- The renderer never writes queue state directly. It invokes IPC and mirrors push events.
- The main process owns job IDs, status transitions, persistence, output collision checks, and execution.
- The renderer builds operation options because the Remux/Demux pages already own the validated form state. Main validates the payload shape before accepting it.

## 8. IPC Contract

Add constants in `src/shared/ipc-channels.ts`.

| Channel | Direction | Payload | Returns |
| --- | --- | --- | --- |
| `MUX_QUEUE_ADD` | invoke | `MuxQueueAddPayload` | `string` job id |
| `MUX_QUEUE_REMOVE` | invoke | `id: string` | `void` |
| `MUX_QUEUE_LIST` | invoke | none | `MuxQueueJob[]` |
| `MUX_QUEUE_GET_STATE` | invoke | none | `{ paused: boolean; concurrency: number }` |
| `MUX_QUEUE_START` | invoke | none | `void` |
| `MUX_QUEUE_PAUSE` | invoke | none | `void` |
| `MUX_QUEUE_RESUME` | invoke | none | `void` |
| `MUX_QUEUE_CANCEL_ALL` | invoke | none | `void` |
| `MUX_QUEUE_CLEAR_COMPLETED` | invoke | none | `number` removed |
| `MUX_QUEUE_SET_CONCURRENCY` | invoke | `concurrency: number` | `void` |
| `MUX_QUEUE_MOVE_TO` | invoke | `id: string, toPosition: number` | `boolean` |
| `MUX_QUEUE_ADDED` | push | `MuxQueueJob` | — |
| `MUX_QUEUE_REMOVED` | push | `id: string` | — |
| `MUX_QUEUE_STATUS_CHANGE` | push | `MuxQueueJob` | — |
| `MUX_QUEUE_PROGRESS` | push | `{ job: MuxQueueJob; progress: ConversionProgress }` | — |
| `MUX_QUEUE_CANCELLED` | push | none | — |
| `MUX_QUEUE_MOVED` | push | `{ id: string; toPosition: number }` | — |

Main-side validation for `MUX_QUEUE_ADD`:

- `kind` is `remux` or `demux`.
- `input` and `output` are non-empty strings.
- `targets` is a non-empty array, bounded by `MAX_MUX_QUEUE_TARGETS` (recommend `100`).
- Each target has a non-empty output, a serializable `ConversionOptions` object, and no duplicate output path within the job.
- No target output collides with an existing mux queue job's target output.
- When `overwrite !== true`, no target output already exists on disk.
- Optional cross-queue check against batch queue outputs in phase 7.
- Reject with existing `AppError` codes where possible (`OUTPUT_EXISTS`, `INVALID_QUEUE_FILE`-style validation, or a new `INVALID_MUX_QUEUE_PAYLOAD`).

## 9. Persistence

- File: `mux-queue-state.json` in `app.getPath('userData')`.
- Version: new `MUX_QUEUE_STATE_VERSION = 1`.
- Snapshot shape: `MuxQueueSnapshot`.
- Restore semantics:
  - `RUNNING` jobs become `QUEUED` and `progress = 0`.
  - `paused` is cleared.
  - `DONE`/`ERROR` jobs are preserved.
  - Restored jobs do not start automatically.
- Generalize `FileQueuePersistence` to accept a filename and a job validator, or add a sibling `FileMuxQueuePersistence`. Keep `FileQueuePersistence` default behavior byte-for-byte compatible.
- `will-quit` must clear both `queue-state.json` and `mux-queue-state.json`.
- Corrupt or version-mismatched mux snapshots are ignored, never partially applied.
- Persistence writes remain debounced and `unref`'d, matching the batch queue.

## 10. Renderer State and UI

### `muxQueueStore`

Add `src/renderer/stores/muxQueueStore.ts` mirroring `queueStore` plus queue state:

```ts
interface MuxQueueState {
  jobs: MuxQueueJob[];
  progress: Record<string, ConversionProgress>;
  paused: boolean;
  concurrency: number;
  setJobs(jobs: MuxQueueJob[]): void;
  addJob(job: MuxQueueJob): void;
  removeJob(id: string): void;
  updateJob(job: MuxQueueJob): void;
  updateProgress(id: string, progress: ConversionProgress): void;
  clearJobs(): void;
  setPaused(paused: boolean): void;
  setConcurrency(concurrency: number): void;
}
```

### `MuxQueueSync`

Add `src/renderer/components/MuxQueueSync.tsx`:

- On mount: call `muxQueueList()` and `muxQueueGetState()`.
- Subscribe to `onMuxQueueAdded`, `onMuxQueueRemoved`, `onMuxQueueStatusChange`, `onMuxQueueProgress`, `onMuxQueueCancelled`, `onMuxQueueMoved`.
- Return every unsubscribe function on unmount.
- Tolerate a missing preload bridge (tests, hostile environments) and non-array list payloads.
- Mount once inside the app shell in `src/renderer/App.tsx`, not inside route pages.

### `useMuxQueueStatus`

Add a selector/hook returning:

```ts
{
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  active: boolean;
  empty: boolean;
}
```

Use it in the Mux tab badge and the Remux/Demux status indicators.

### Batch Queue tabs

- Add a tab shell to `src/renderer/pages/BatchQueue.tsx` with `general` and `mux`.
- Preserve the existing general queue JSX and behavior. Prefer conditional rendering over moving the large batch body unless extraction clearly reduces risk.
- Read/write `?tab=general|mux` with the router's search params. Invalid/missing values fall back to `general`.
- Show counts in tab labels or badges, e.g. `Mux Queue (3)`.
- General tab retains add files/folder, encoding panel, review dialog, filters, DnD, export/import, when-done.
- Mux tab shows only queue management for mux jobs; jobs are added from the Remux/Demux pages.

### Mux Queue tab components

- `src/renderer/components/MuxQueuePanel.tsx`
  - Empty state with buttons to open Remux and Demux.
  - Controls: Start, Pause/Resume, Cancel All, Clear Completed, concurrency selector.
  - Job list with filters/search only if cheap to reuse; otherwise v1 can show all jobs.
  - DnD reorder for `QUEUED` jobs via `muxQueueMoveTo`.
- `src/renderer/components/MuxQueueJobCard.tsx`
  - Kind chip: Remux / Demux.
  - Input filename and thumbnail (reuse preview cache if practical).
  - Status chip, progress bar, error text.
  - Output summary: remux shows the output path; demux shows `N outputs -> outputDir`.
  - Expandable details listing target labels and outputs.
  - Actions: remove, reveal output/folder, copy path, retry failed.
  - Wrap progress in `ErrorBoundary`, matching `QueueJobCard`.
- Reuse `ProgressBar`, `EllipsisTooltip`, `ErrorBoundary`, and queue card styles where possible.

### Remux page integration

- Add `enqueueRemux()` to `remuxStore`.
- Factor the existing validation/plan-building block from `startRemux` into a helper so direct run and enqueue cannot drift.
- `enqueueRemux` calls `window.electronAPI.muxQueueAdd` with one target and shows a success toast with a **View queue** action navigating to `/batch?tab=mux`.
- Do not clear the form automatically; users may want to enqueue variants or verify settings.
- Add `MuxQueueStatusIndicator` near the action row.
- Primary action: **Add to Queue**. Secondary: **Start now** (existing direct path).
- Disable Add to Queue while the enqueue IPC is pending to prevent double submission.

### Demux page integration

- Add `enqueueDemux()` to `demuxStore`.
- Build `MuxQueueTarget[]` from the current `targets`; reject empty input or empty targets with the same error codes as `startDemux`.
- Call `muxQueueAdd` with `kind: 'demux'`, `output: outputDir`, and all targets.
- Show a success toast with **View queue**.
- Do not clear the selection automatically.
- Add the same `MuxQueueStatusIndicator`.
- Primary action: **Add to Queue**. Secondary: **Start now**.

### Status indicator behavior

- Empty: `Mux queue is empty`.
- Active: `Mux queue: {{queued}} queued, {{running}} running`.
- Stopped with work: `Mux queue: {{queued}} queued`.
- Completed-only: optionally `{{done}} completed` or hide the active counts.
- Clicking the indicator navigates to `/batch?tab=mux`.

## 11. File Map

| Area | File | Change |
| --- | --- | --- |
| Shared types | `src/shared/types.ts` or `src/shared/mux-queue-types.ts` | Add mux job/target/payload/snapshot types |
| Shared constants | `src/shared/constants.ts` | Add mux queue limits/defaults |
| Shared guards | `src/shared/mux-queue-guards.ts` | Add runtime payload/job/snapshot guards |
| Shared demux helper | `src/shared/demux-utils.ts` | Move/export `optionsForTarget` |
| IPC channels | `src/shared/ipc-channels.ts` | Add `MUX_QUEUE_*` channels |
| IPC guards | `src/shared/ipc-guards.ts` | Add mux push-event guards |
| Log constants | `src/shared/log-constants.ts` | Add mux queue log prefixes |
| Main queue | `src/main/queue/mux-queue.ts` | New mux queue engine |
| Main runner | `src/main/queue/mux-job-runner.ts` | Sequential remux/demux execution |
| Main queue utils | `src/main/queue/queue-utils.ts` | Extract shared clamp/pure helpers |
| Main persistence | `src/main/queue/persistence.ts` | Generic filename/validator or mux adapter |
| Main IPC | `src/main/ipc/mux-queue.ts` | New `registerMuxQueueHandlers` |
| Main IPC registry | `src/main/ipc/handlers.ts` | Register mux handlers |
| Main IPC queue | `src/main/ipc/queue.ts` | Generalize will-quit snapshot clearing |
| Preload | `src/preload/index.ts` | Add mux bridge methods/subscriptions |
| Renderer API types | `src/renderer/electron-api.d.ts` | Mirror mux bridge |
| Renderer store | `src/renderer/stores/muxQueueStore.ts` | New store |
| Renderer store types | `src/renderer/stores/types.ts` | Add mux queue state type |
| Renderer sync | `src/renderer/components/MuxQueueSync.tsx` | Global sync component |
| Renderer hook | `src/renderer/hooks/useMuxQueueStatus.ts` | Status selector |
| Queue page | `src/renderer/pages/BatchQueue.tsx` | Add tab shell |
| Queue panel | `src/renderer/components/MuxQueuePanel.tsx` | New mux queue panel |
| Queue card | `src/renderer/components/MuxQueueJobCard.tsx` | New mux job card |
| Status UI | `src/renderer/components/MuxQueueStatusIndicator.tsx` | Shared page indicator |
| Remux store | `src/renderer/stores/remuxStore.ts` | Add `enqueueRemux` |
| Demux store | `src/renderer/stores/demuxStore.ts` | Add `enqueueDemux` |
| Remux page | `src/renderer/pages/Remux.tsx` | Add queue action/status |
| Demux page | `src/renderer/pages/Demux.tsx` | Add queue action/status |
| App shell | `src/renderer/App.tsx` | Mount `MuxQueueSync` |
| i18n | `src/renderer/i18n/locales/*.json` | Add keys to every locale |
| Test stubs | `src/test-setup.ts` | Add mux bridge mocks |
| Hostile API | `src/test-utils/hostile-api.ts` | Add mux methods/subscribers |
| Preload tests | `src/preload/__tests__/index.test.ts` | Add channel mapping tests |
| IPC abuse tests | `src/main/ipc/__tests__/ipc-abuse-sweep.test.ts` | Cover new channels |
| E2E | `e2e/specs/mux-queue.spec.ts` | New end-to-end coverage |

## 12. Progress Tracker

| Phase | Tasks | Done | Status | Gate |
| --- | ---: | ---: | --- | --- |
| P0 - Baseline and plan | 1 | 1 | Complete | Plan reviewed |
| P1 - Shared contracts and persistence | 5 | 5 | Complete | Types, guards, persistence tests pass |
| P2 - Main mux queue engine | 6 | 6 | Complete | Queue lifecycle and runner tests pass |
| P3 - IPC and preload | 5 | 5 | Complete | IPC/preload/abuse tests pass |
| P4 - Renderer state and sync | 4 | 4 | Complete | Store and listener tests pass |
| P5 - Queue UI | 6 | 6 | Complete | Tabs, panel, card, DnD tests pass |
| P6 - Page integration and i18n | 6 | 6 | Complete | Enqueue and status tests pass |
| P7 - Hardening and verification | 5 | 5 | Complete | E2E, lint, typecheck, build pass |
| P8 - Optional parity | 4 | 0 | Deferred | Product decision |
| **Total** | **42** | **38** | **90%** | |

---

## 13. Phases and Tasks

### Phase 0 — Baseline and Plan

#### Task 0.1 — Verify baseline and author this plan

**Status: [x] — 2026-11-10**

**Steps**
- [x] Confirm branch, HEAD, and clean working tree.
- [x] Trace `JobQueue`, batch IPC, preload bridge, `queueStore`, `BatchQueue`, `remuxStore`, and `demuxStore`.
- [x] Confirm remux/demux are removed from `BATCH_OPERATIONS` but remain valid standalone operations.
- [x] Record architecture, data model, IPC contract, and phased task breakdown in this file.

**Checkpoint:** Plan reviewed and approved. No production code changed.

---

### Phase 1 — Shared Contracts and Persistence

#### Task 1.1 — Add shared mux queue types and constants

**Status: [x]**

**Steps**
- [x] Add `MuxQueueKind`, `MuxQueueTarget`, `MuxQueueJob`, `MuxQueueAddPayload`, and `MuxQueueSnapshot`.
- [x] Add `MAX_MUX_QUEUE_TARGETS`, `MUX_QUEUE_STATE_FILENAME`, `MUX_QUEUE_STATE_VERSION`, and `MUX_QUEUE_DEFAULT_CONCURRENCY`.
- [x] Reuse `QUEUE_STATUS` and `TranscoderType`; do not create parallel status enums.
- [x] Keep `ConversionOperation.Remux` and `.Demux` available for standalone flows.
- [x] Add JSDoc consistent with existing shared types.

**Checkpoint:** `npm run typecheck:main` and `npm run typecheck:renderer` pass with the new types unused.

#### Task 1.2 — Add mux queue runtime guards

**Status: [x]**

**Steps**
- [x] Create `src/shared/mux-queue-guards.ts`.
- [x] Add `isMuxQueueAddPayload`, `isMuxQueueJob`, `isMuxQueueSnapshot`, `isMuxQueueProgressEvent`, and `isMuxQueueMovedEvent`.
- [x] Validate kind, string paths, target count, target output uniqueness, option field types, finite numbers, and status values.
- [x] Reject non-serializable or cyclic values by validating only known fields.
- [x] Add unit tests for valid payloads, missing fields, wrong types, duplicate target outputs, and oversized target lists.

**Checkpoint:** Guard tests pass and hostile payloads are rejected without throwing.

#### Task 1.3 — Generalize persistence for a second queue

**Status: [x]**

**Steps**
- [x] Refactor `FileQueuePersistence` to accept an optional filename and job validator, or add `FileMuxQueuePersistence`.
- [x] Preserve the default `queue-state.json` behavior and existing batch tests.
- [x] Add mux snapshot load/save/clear using `mux-queue-state.json`.
- [x] Ensure invalid mux snapshots return `null` and never partially restore.
- [x] Add temp-directory unit tests for missing, corrupt, version-mismatched, and valid mux snapshots.

**Checkpoint:** Batch persistence tests remain unchanged and pass; mux persistence tests pass.

#### Task 1.4 — Clear both snapshots on quit

**Status: [x]**

**Steps**
- [x] Replace the single `persistedQueue` reference with a registry or add an equivalent mux clear registration.
- [x] Ensure `will-quit` clears both `queue-state.json` and `mux-queue-state.json`.
- [x] Keep the listener registered at most once per process.
- [x] Add a test that both clear methods are called on the quit path.

**Checkpoint:** Quit cleanup is verified for both queues.

#### Task 1.5 — Phase 1 verification

**Status: [x]**

**Steps**
- [x] Run `npm run typecheck`.
- [x] Run focused unit tests for shared guards and persistence.
- [x] Confirm no renderer or main code imports mux types from a local-only module.
- [x] Update this plan's task markers and progress tracker.

**Checkpoint:** Phase 1 gate passed.

---

### Phase 2 — Main Mux Queue Engine

#### Task 2.1 — Implement `MuxQueue`

**Status: [x]**

**Steps**
- [x] Create `src/main/queue/mux-queue.ts` with `EventEmitter` and the same event names as `JobQueue`: `added`, `removed`, `statusChange`, `progress`, `cancelled`, `moved`, `drained`.
- [x] Implement `addJob(payload)`, `getJobs()`, `getState()`, `start()`, `pause()`, `resume()`, `cancelJob()`, `cancelAll()`, `removeJob()`, `clearCompleted()`, `moveJobTo()`, `setConcurrency()`, and `flushState()`.
- [x] Use a concurrency-capped active set and a single `processNext` entry point.
- [x] Reuse/extract `clampConcurrency` and pure ordering helpers into `src/main/queue/queue-utils.ts`; update `JobQueue` imports without behavior changes.
- [x] Preserve insertion-order and priority semantics from the batch queue.
- [x] Do not start jobs on add.

**Checkpoint:** `MuxQueue` unit tests cover add/start/remove/reorder/concurrency without running FFmpeg.

#### Task 2.2 — Implement the sequential mux job runner

**Status: [x]**

**Steps**
- [x] Create `src/main/queue/mux-job-runner.ts`.
- [x] Accept a `transcoderFactory` for tests, defaulting to `createTranscoder`.
- [x] For each target in order, create an FFmpeg transcoder and wire `progress`, `error`, and `end`.
- [x] Resolve only after all targets complete; reject on the first non-cancelled target error.
- [x] Expose `pause()`, `resume()`, and `cancel()` that forward to the current transcoder.
- [x] On cancel, stop the loop and reject with the existing cancellation error code.
- [x] Include the failing target label in the error message.

**Checkpoint:** Fake-transcoder tests prove target order, failure short-circuit, cancellation, and pause/resume forwarding.

#### Task 2.3 — Aggregate progress correctly

**Status: [x]**

**Steps**
- [x] Compute overall progress as `((targetIndex + targetPercent / 100) / targetCount) * 100`.
- [x] Clamp percent to `0..100`; never persist `NaN` or `Infinity`.
- [x] Keep current target `fps`, `speed`, `eta`, `time`, and `bitrate` in the emitted progress object.
- [x] Set `progress` to `COMPLETED_PROGRESS.percent` on success.
- [x] Emit progress only while the job is still in the queue.

**Checkpoint:** Progress tests cover single-target, multi-target, mid-target, and completion values.

#### Task 2.4 — Persistence restore semantics

**Status: [x]**

**Steps**
- [x] Load mux snapshots in the constructor.
- [x] Remap `RUNNING` to `QUEUED`, reset progress, and clear `paused`.
- [x] Preserve targets and options exactly.
- [x] Apply the saved concurrency cap with clamping.
- [x] Emit no events during restore; the renderer performs a fresh list on mount.
- [x] Add tests for restored jobs, paused flags, and invalid snapshots.

**Checkpoint:** Restore tests pass and no job auto-starts.

#### Task 2.5 — Output collision and duplicate guards

**Status: [x]**

**Steps**
- [x] Reject duplicate target outputs inside one job.
- [x] Reject a target output already claimed by another mux job.
- [x] Respect `overwrite`: when false, reject existing files on disk.
- [x] Add `hasOutputPath` or equivalent for cross-queue checks in phase 7.
- [x] Enforce `MAX_MUX_QUEUE_TARGETS`.
- [x] Add tests for duplicate paths, existing files, overwrite, and target limits.

**Checkpoint:** No duplicate work can be enqueued within the mux queue.

#### Task 2.6 — Phase 2 verification

**Status: [x]**

**Steps**
- [x] Run focused `MuxQueue` and runner tests.
- [x] Run existing `job-queue` tests to prove the helper extraction did not regress batch behavior.
- [x] Update task markers and progress tracker.

**Checkpoint:** Phase 2 gate passed.

---

### Phase 3 — IPC and Preload

#### Task 3.1 — Add IPC and log constants

**Status: [x]**

**Steps**
- [x] Add all `MUX_QUEUE_*` invoke and push channels to `src/shared/ipc-channels.ts` with JSDoc.
- [x] Add `LOG_IPC_MUX_QUEUE_*` and `LOG_MUX_QUEUE_*` constants to `src/shared/log-constants.ts`.
- [x] Add guard functions for mux push payloads to `src/shared/mux-queue-guards.ts` (shared with the persistence layer).
- [x] Add tests for event guard acceptance/rejection.

**Checkpoint:** Channel and guard constants compile and are covered by tests.

#### Task 3.2 — Implement `registerMuxQueueHandlers`

**Status: [x]**

**Steps**
- [x] Create `src/main/ipc/mux-queue.ts`.
- [x] Create one `MuxQueue` per registration with `FileMuxQueuePersistence`.
- [x] Register add/list/get-state/start/pause/resume/cancel-all/clear-completed/set-concurrency/move-to handlers.
- [x] Validate `MUX_QUEUE_ADD` with the shared guard before calling `addJob`.
- [x] Reject output collisions and existing files according to `overwrite`.
- [x] Forward all queue events to the corresponding push channels.
- [x] Log invocations and lifecycle transitions with the new log constants.
- [x] Do not log full file paths at info level if existing queue logging avoids it; match current conventions.

**Checkpoint:** Handler tests cover every channel and event forwarding.

#### Task 3.3 — Register handlers and quit cleanup

**Status: [x]**

**Steps**
- [x] Call `registerMuxQueueHandlers(win, send)` from `src/main/ipc/handlers.ts`.
- [x] Ensure handler registration order does not affect existing IPC.
- [x] Ensure will-quit clears the mux snapshot.
- [x] Add an integration test that the handler set includes the mux channels.

**Checkpoint:** App boot registers both queue handler sets.

#### Task 3.4 — Expose the preload bridge

**Status: [x]**

**Steps**
- [x] Add `muxQueueAdd`, `muxQueueRemove`, `muxQueueList`, `muxQueueGetState`, `muxQueueStart`, `muxQueuePause`, `muxQueueResume`, `muxQueueCancelAll`, `muxQueueClearCompleted`, `muxQueueSetConcurrency`, and `muxQueueMoveTo`.
- [x] Add `onMuxQueueAdded`, `onMuxQueueRemoved`, `onMuxQueueStatusChange`, `onMuxQueueProgress`, `onMuxQueueCancelled`, and `onMuxQueueMoved`.
- [x] Mirror every method and subscription in `src/renderer/electron-api.d.ts`.
- [x] Add mocks to `src/test-setup.ts` and `src/test-utils/hostile-api.ts`.
- [x] Update preload tests with channel mapping and hostile-event cases.

**Checkpoint:** Renderer code can call the mux bridge with full type coverage.

#### Task 3.5 — Phase 3 verification

**Status: [x]**

**Steps**
- [x] Run preload tests.
- [x] Run IPC handler tests.
- [x] Run `src/main/ipc/__tests__/ipc-abuse-sweep.test.ts`.
- [x] Run `npm run typecheck:main`, `typecheck:preload`, and `typecheck:renderer`.
- [x] Update task markers and progress tracker.

**Checkpoint:** Phase 3 gate passed.

---

### Phase 4 — Renderer State and Sync

#### Task 4.1 — Add `muxQueueStore`

**Status: [x]**

**Steps**
- [x] Create `src/renderer/stores/muxQueueStore.ts`.
- [x] Hold `jobs`, `progress`, `paused`, and `concurrency`.
- [x] Add `setJobs`, `addJob`, `removeJob`, `updateJob`, `updateProgress`, `clearJobs`, `setPaused`, and `setConcurrency`.
- [x] Reject non-array job lists and non-finite progress values.
- [x] Add the state type to `src/renderer/stores/types.ts`.
- [x] Add unit tests mirroring `queueStore` coverage.

**Checkpoint:** Store tests pass, including hostile payloads.

#### Task 4.2 — Add global `MuxQueueSync`

**Status: [x]**

**Steps**
- [x] Create `src/renderer/components/MuxQueueSync.tsx`.
- [x] Fetch the initial list and state on mount.
- [x] Subscribe to all mux push events and mirror them into the store.
- [x] Return all unsubscribers on unmount.
- [x] Tolerate a missing bridge and failed IPC calls.
- [x] Mount once in `src/renderer/App.tsx`.
- [x] Add listener-leak and route-change tests.

**Checkpoint:** Mux status remains correct across route changes with no duplicate listeners.

#### Task 4.3 — Add status selector

**Status: [x]**

**Steps**
- [x] Create `src/renderer/hooks/useMuxQueueStatus.ts`.
- [x] Return total, queued, running, done, failed, active, and empty counts.
- [x] Use memoized selectors to avoid rerender storms.
- [x] Add tests for empty, queued-only, running, mixed, and completed-only states.

**Checkpoint:** Status counts match `QUEUE_STATUS` values.

#### Task 4.4 — Phase 4 verification

**Status: [x]**

**Steps**
- [x] Run store, sync, and selector tests.
- [x] Run renderer typecheck.
- [x] Update task markers and progress tracker.

**Checkpoint:** Phase 4 gate passed.

---

### Phase 5 — Queue UI

#### Task 5.1 — Add General/Mux tabs to Batch Queue

**Status: [x]**

**Steps**
- [x] Add a MUI tab shell to `src/renderer/pages/BatchQueue.tsx`.
- [x] Keep the existing general queue body intact and render it under the `general` tab.
- [x] Render `MuxQueuePanel` under the `mux` tab.
- [x] Read/write `?tab=general|mux`; fall back to `general` for missing/invalid values.
- [x] Show per-tab counts using the status selectors.
- [x] Preserve the existing page title, condense behavior, and general queue shortcuts.
- [x] Add tests for default tab, deep link, tab switch, and general queue regression.

**Checkpoint:** Existing batch tests pass unchanged except for tab-aware queries.

#### Task 5.2 — Build `MuxQueuePanel`

**Status: [x]**

**Steps**
- [x] Add controls for Start, Pause/Resume, Cancel All, Clear Completed, and concurrency.
- [x] Reuse `BatchControls` where its props are generic enough; otherwise create `MuxQueueControls`.
- [x] Show queued/running/done/failed stats.
- [x] Disable controls when they cannot act (e.g. Pause with no active jobs).
- [x] Keep all labels in i18n; no hardcoded strings.
- [x] Add component tests for control enable/disable and IPC calls.

**Checkpoint:** Mux queue can be driven entirely from the tab.

#### Task 5.3 — Build `MuxQueueJobCard`

**Status: [x]**

**Steps**
- [x] Show kind chip, input filename, status chip, progress bar, and error.
- [x] Show remux output path or demux target count/output directory.
- [x] Expand to list target labels and outputs.
- [x] Add remove, reveal, copy path, and retry failed actions.
- [x] Wrap progress rendering in `ErrorBoundary`.
- [x] Reuse preview-cache thumbnails if low risk; otherwise defer thumbnails.
- [x] Add tests for remux, demux, running, done, error, and multi-target rendering.

**Checkpoint:** Both job kinds are readable and actionable.

#### Task 5.4 — Add reorder and list actions

**Status: [x]**

**Steps**
- [x] Reuse the `@dnd-kit` pattern from the general queue.
- [x] Only `QUEUED` jobs are draggable.
- [x] Call `muxQueueMoveTo` and mirror the `MUX_QUEUE_MOVED` event.
- [x] Provide non-drag fallback if DnD is unavailable.
- [x] Add tests for successful move, rejected move, and no-op move.

**Checkpoint:** Reordering works without affecting running/completed jobs.

#### Task 5.5 — Add empty state and page links

**Status: [x]**

**Steps**
- [x] Show an empty state when the mux queue has no jobs.
- [x] Add buttons/links to `/remux` and `/demux`.
- [x] Add a short explanation that mux jobs are added from those pages.
- [x] Ensure keyboard focus and accessible labels.
- [x] Add tests for empty state navigation.

**Checkpoint:** New users can discover how to add mux jobs.

#### Task 5.6 — Phase 5 verification

**Status: [x]**

**Steps**
- [x] Run `BatchQueue` tests and new mux panel/card tests.
- [x] Run renderer lint and typecheck.
- [x] Run a11y tests for the new tab/card controls.
- [x] Update task markers and progress tracker.

**Checkpoint:** Phase 5 gate passed.

---

### Phase 6 — Page Integration, i18n, and Analytics

#### Task 6.1 — Add `enqueueRemux`

**Status: [x]**

**Steps**
- [x] Factor remux validation/plan building into a helper used by both `startRemux` and `enqueueRemux`.
- [x] Build one `MuxQueueTarget` with the remux output and options.
- [x] Call `window.electronAPI.muxQueueAdd`.
- [x] Show `toast.remuxQueued` with a **View queue** action.
- [x] Route IPC errors through `useErrorStore`.
- [x] Do not call `convertFile` from the enqueue path.
- [x] Add tests for valid enqueue, missing input/output, incompatible container, and IPC failure.

**Checkpoint:** Remux settings enqueue exactly as configured.

#### Task 6.2 — Add `enqueueDemux`

**Status: [x]**

**Steps**
- [x] Extract `optionsForTarget` to `src/shared/demux-utils.ts` and update the direct runner.
- [x] Map every current `DemuxTarget` to a `MuxQueueTarget`.
- [x] Call `muxQueueAdd` with `kind: 'demux'` and `output: outputDir`.
- [x] Show `toast.demuxQueued` with a **View queue** action.
- [x] Reject empty input/targets with existing error codes.
- [x] Do not call `convertFile` from the enqueue path.
- [x] Add tests for single-target, multi-target, split-channel, and failure cases.

**Checkpoint:** Demux selection, split channels, and output directory survive enqueue.

#### Task 6.3 — Add the page actions

**Status: [x]**

**Steps**
- [x] Add **Add to Queue** as the primary action on Remux and Demux.
- [x] Keep **Start now** as a secondary action.
- [x] Disable Add to Queue while the enqueue IPC is pending.
- [x] Keep existing direct-run disabled states intact.
- [x] Add accessible labels and keyboard behavior.
- [x] Add page tests for button presence, disabled states, and double-click prevention.

**Checkpoint:** Both pages can enqueue without starting work.

#### Task 6.4 — Add the shared status indicator

**Status: [x]**

**Steps**
- [x] Create `src/renderer/components/MuxQueueStatusIndicator.tsx`.
- [x] Render empty, queued, running, and completed-only states.
- [x] Make the indicator navigate to `/batch?tab=mux`.
- [x] Place it near the action row on Remux and Demux.
- [x] Add tests for each status state and navigation.

**Checkpoint:** Users see queue status from both operation pages.

#### Task 6.5 — Add i18n keys and analytics

**Status: [x]**

**Steps**
- [x] Add `batchQueue.tabs.*`, mux tab labels, empty state, job kind, target count, status, and toast keys to `en-US.json`.
- [x] Add `remux.addToQueue`, `remux.queued`, `demux.addToQueue`, and `demux.queued`.
- [x] Propagate keys to every locale; run `npm run sync:locales` if that is the repository convention.
- [x] Run `npm run validate:locales` and `npm run validate:locale-usage`.
- [x] Add analytics events: `mux_queue_job_added`, `mux_queue_started`, `mux_queue_completed`, `mux_queue_failed`, and `mux_queue_cancelled`.
- [x] Include only categorical fields: kind, target count bucket, transcoder, mode, and error code.
- [x] Run `npm run analytics:schema-check`.
- [x] Add `LOG_*` constants for enqueue and lifecycle events.

**Checkpoint:** No hardcoded strings; locale and analytics checks pass.

#### Task 6.6 — Phase 6 verification

**Status: [x]**

**Steps**
- [x] Run Remux/Demux store and page tests.
- [x] Run i18n validation and hardcoded-string lint.
- [x] Run renderer typecheck.
- [x] Update task markers and progress tracker.

**Checkpoint:** Phase 6 gate passed.

---

### Phase 7 — Hardening and Verification

#### Task 7.1 — Add end-to-end coverage

**Status: [x]**

**Steps**
- [x] Add `e2e/specs/mux-queue.spec.ts`.
- [x] Enqueue a remux from the Remux page and verify the Mux Queue tab shows it.
- [x] Enqueue a demux with multiple targets and verify target count/output summary.
- [x] Start the queue, observe progress, pause, resume, and complete with the E2E media mock.
- [x] Cancel a running job and cancel all.
- [x] Verify the Remux/Demux status indicators update.
- [x] Update E2E preload mocks for the mux bridge.

**Checkpoint:** End-to-end flow passes in CI.

#### Task 7.2 — Cross-queue collision and limits

**Status: [x]**

**Steps**
- [x] Check new mux target outputs against batch queue outputs.
- [x] Check new batch outputs against mux target outputs.
- [x] Reject with a clear error when a path is already claimed by either queue.
- [x] Enforce target and job-count limits.
- [x] Validate paths are non-empty and do not contain NUL.
- [x] Add tests for both directions of the cross-queue check.

**Checkpoint:** Two queues cannot silently overwrite each other's outputs.

#### Task 7.3 — Close-confirmation and active-work audit

**Status: [x]**

**Steps**
- [x] Inspect the window close-confirmation flow for active batch queue handling.
- [x] Include active mux jobs in the same guard if the batch queue is included.
- [x] Ensure closing with queued/running mux jobs prompts consistently.
- [x] Add a test for the close guard with a running mux job.
- [x] Document the snapshot-clearing behavior on confirmed quit.

**Checkpoint:** Closing the app cannot silently discard active mux work.

#### Task 7.4 — Documentation, logging, and observability review

**Status: [x]**

**Steps**
- [x] Update user-facing docs/feature lists if the repository tracks them.
- [x] Verify logs contain job id, kind, target count, and terminal status but no sensitive data.
- [x] Verify analytics events are categorical and schema-valid.
- [x] Run `npm run doc:drift` if docs are generated from source.
- [x] Confirm no new direct `console.*` calls or hardcoded strings.

**Checkpoint:** Logging and docs match repository conventions.

#### Task 7.5 — Full verification

**Status: [x]**

**Steps**
- [x] Run `npm run format:check`.
- [x] Run `npm run lint`.
- [x] Run `npm run lint:types`.
- [x] Run `npm run lint:strings`.
- [x] Run `npm run lint:unused`.
- [x] Run `npm run validate:locales`.
- [x] Run `npm run validate:locale-usage`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test:unit`.
- [x] Run `npm run test:integration`.
- [x] Run `npm run test:e2e`.
- [x] Run `npm run build`.
- [x] Record results in this plan and update the progress tracker.

**Checkpoint:** All gates pass; implementation complete for v1.

---

### Phase 8 — Optional Parity (Deferred)

These tasks are intentionally deferred until v1 is stable.

#### Task 8.1 — Mux queue export/import

**Status: [-]**

- Add export/import IPC, dialogs, and portable JSON format.
- Reuse `queue-transfer` patterns with mux-specific validation.
- Add duplicate/collision handling and tests.

#### Task 8.2 — Edit queued mux job options

**Status: [-]**

- Add `MUX_QUEUE_UPDATE_OPTIONS`.
- Allow editing remux targets and demux per-target options only while `QUEUED`.
- Reuse the batch options dialog patterns where practical.

#### Task 8.3 — When-done power action

**Status: [-]**

- Decide whether mux queue completion can trigger shutdown/sleep/hibernate.
- Avoid double-firing when both queues drain.
- Add a shared coordinator or explicit ownership rule.

#### Task 8.4 — Shared queue engine refactor

**Status: [-]**

- If `MuxQueue` and `JobQueue` drift, extract a generic `QueueEngine<TJob>`.
- Keep behavior covered by both queue test suites before and after the refactor.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Duplicated queue logic drifts from batch | Inconsistent behavior and bugs | Extract pure helpers, mirror tests, keep event contract identical |
| Demux partial outputs after cancel/failure | User sees incomplete set | Document policy; include completed targets in toast/error; do not delete silently |
| User enqueues and also clicks Start now | Duplicate work and output collision | Disable Add to Queue while pending; collision checks; clear UI messaging |
| Large demux jobs bloat the snapshot | Slow persistence / large JSON | Bound targets per job; debounce writes; validate snapshot size |
| Cross-queue output collision | One queue overwrites another's output | Phase 7 bidirectional output-claim checks |
| Renderer builds unsafe options | Invalid FFmpeg invocation | Shared guards, main-side validation, array-based args (no shell) |
| Mux status not visible outside `/batch` | Users cannot see progress | Global `MuxQueueSync` mounted at app shell |
| Listener leaks on route changes | Duplicate events / memory growth | Single global sync with cleanup; listener-leak tests |
| i18n key drift | Missing translations / hardcoded strings | Add keys to all locales; run locale validation and string lint |
| Close confirmation misses mux jobs | Data loss surprise | Phase 7 close-guard audit |

## 15. Open Questions

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | Should **Add to Queue** replace **Start now**, or coexist? | Coexist: Add to Queue primary, Start now secondary. |
| Q2 | Should mux concurrency share the batch setting? | No: separate cap, default 1, persisted in the mux snapshot. |
| Q3 | Should a demux job be one card with N targets or N cards? | One job/card with N targets. |
| Q4 | Should the form clear after enqueue? | No; show a toast with **View queue** and let the user clear manually. |
| Q5 | Should cross-queue output collisions block enqueue? | Yes, in phase 7. |
| Q6 | Should completed mux jobs survive app restart? | Follow batch behavior: persist during the session, clear on confirmed quit. |

## 16. Definition of Done

- [x] Remux page can enqueue a fully configured job without calling `convertFile`.
- [x] Demux page can enqueue a multi-target job without calling `convertFile`.
- [x] Both job kinds appear in one Mux Queue tab.
- [x] Batch Queue page has General and Mux tabs with deep-link support.
- [x] Remux and Demux pages show empty/running/queued status.
- [x] Mux queue supports start, pause, resume, cancel, remove, clear completed, reorder, and concurrency.
- [x] Mux queue persists and restores according to the documented semantics.
- [x] Output collisions are rejected within the mux queue and across queues.
- [x] All new strings exist in every locale; no hardcoded strings.
- [x] Unit, integration, and E2E tests cover the new flow.
- [x] `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, and `build` pass.
- [x] Existing batch queue, CLI, and MCP behavior is unchanged.

## 17. Verification Commands

```powershell
npm run format:check
npm run lint
npm run lint:types
npm run lint:strings
npm run lint:unused
npm run validate:locales
npm run validate:locale-usage
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

## 18. Progress Log

| Date | Phase | Update |
| --- | --- | --- |
| 2026-11-10 | P0 | Baseline verified and plan authored. No production code changed. |
| 2026-11-10 | P1 | Shared mux types, constants, runtime guards, and the mux snapshot adapter landed. Batch persistence behavior unchanged. |
| 2026-11-10 | P2 | MuxQueue engine, the sequential MuxJobRunner, progress aggregation, and output-collision guards landed. |
| 2026-11-10 | P3 | Mux IPC channels, registerMuxQueueHandlers, the preload bridge, and the renderer API types landed. |
| 2026-11-10 | P4 | muxQueueStore, the global MuxQueueSync, and useMuxQueueStatus landed. |
| 2026-11-10 | P5 | General/Mux tabs, MuxQueuePanel, MuxQueueJobCard, drag-and-drop reorder, and the empty state landed. |
| 2026-11-10 | P6 | enqueueRemux / enqueueDemux, the Add-to-Queue actions, the status indicator, i18n keys, and analytics events landed. |
| 2026-11-10 | P7 | Cross-queue output claims, the close-confirmation guard, the E2E spec, and the full verification pass landed. |
| 2026-11-10 | P7 | Mux queue translations added to every locale table; the muxQueue.* keys are translated in all 47 non-English locales. |
| 2026-11-10 | P7 | Docs updated (IPC channels, project structure, features page, drift markers) and the audit trail closed: the mux queue tests, the tab-contrast a11y fix, and the hostile-bridge resilience fix all landed. |
