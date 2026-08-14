�# Batch Queue Option Editing Plan

Tracking document for making encoding options editable after a job is queued.
Currently `ConversionOptions` are baked into each `QueueJob` at enqueue time, so
changing the Encoding Options panel only affects future adds. This plan adds
(both, per user decision):

1. **Global propagation** — panel changes push the current field values to every
   queued job (except jobs customized via per-job editing).
2. **Per-job editing** — each queued job card gets an "Edit options" action that
   opens a dialog reusing the encoding panel controls for that single job.

Both paths lock once the batch starts (`batchStarted = jobs.some(j =>
j.status === QUEUE_STATUS.RUNNING)`). A new `JobQueue.updateJobOptions` API
updates `job.options` (and optionally the output path) for queued jobs and
re-persists. Status legend: `[ ]` not started, `[~]` in progress, `[x]` done,
`[-]` skipped.

---

## P1 — Shared contracts

### Task 1 — IPC channel constant
Status: `[x]`

**Problem:** the renderer needs a channel to send per-job option updates.

**Steps**
- [ ] `src/shared/ipc-channels.ts`: add `QUEUE_UPDATE_OPTIONS: 'queue-update-options'`
      under the `Queue` group with a doc comment (id, options, optional output).

**Checkpoint:** typecheck green.

---

### Task 2 — Log constants
Status: `[x]`

**Steps**
- [ ] `src/shared/log-constants.ts` (near the other `LOG_QUEUE_*` entries,
      ~lines 508-562): add `LOG_QUEUE_UPDATE_OPTIONS`,
      `LOG_QUEUE_UPDATE_OPTIONS_SKIPPED` (non-queued / missing id),
      `LOG_IPC_QUEUE_UPDATE_OPTIONS` with the existing {file}-style placeholders.

**Checkpoint:** typecheck green.

---

## P2 — Main process

### Task 3 — `JobQueue.updateJobOptions`
Status: `[x]`

**Problem:** job options are immutable after enqueue; only a queued job may be
edited.

**Steps**
- [ ] `src/main/queue/job-queue.ts`: add
      `updateJobOptions(id, options, output?)` returning `boolean`:
  - log `LOG_QUEUE_UPDATE_OPTIONS` with the id;
  - find job; if missing or `job.status !== QUEUE_STATUS.QUEUED` →
    log `LOG_QUEUE_UPDATE_OPTIONS_SKIPPED`, return `false`;
  - assign `job.options = { ...options }`, optionally `job.output = output`;
  - `schedulePersist()`; `emit('statusChange', job)`; return `true`.
- [ ] `src/main/ipc/queue.ts`: register a handler for `IPC.QUEUE_UPDATE_OPTIONS`
      that logs `LOG_IPC_QUEUE_UPDATE_OPTIONS`, forwards to `queue.updateJobOptions`,
      returns the boolean.

**Checkpoint:** `npm run test:unit -- job-queue queue` green.

---

### Task 4 — Main-process unit tests
Status: `[x]`

**Steps**
- [ ] `src/main/queue/__tests__/job-queue.test.ts`: apply to QUEUED job updates
      options + optional output, schedules persist, emits `statusChange`;
      running/done/missing jobs are rejected and return `false`.
- [ ] `src/main/ipc/__tests__/queue.test.ts`: handler calls `updateJobOptions`
      with the payload and returns its result; adds `updateJobOptions` to the
      fake `JobQueue`.

**Checkpoint:** `npm run test:unit -- job-queue queue` green.

---

## P3 — Bridge (preload / typings / test scaffolding)

### Task 5 — Preload method + renderer type
Status: `[x]`

**Steps**
- [ ] `src/preload/index.ts`: expose `queueUpdateOptions(id, options, output?)`
      invoking `IPC.QUEUE_UPDATE_OPTIONS`, with a doc comment.
- [ ] `src/renderer/electron-api.d.ts`: add `queueUpdateOptions` to
      `ElectronAPI` (same signature).
- [ ] `src/test-setup.ts`: add `queueUpdateOptions: vi.fn().mockResolvedValue(false)`
      to the `electronAPI` stub.
- [ ] `e2e/mocks/preload.js`: add a `queueUpdateOptions` mock that updates the
      matching job in the store and emits `queue-status-change`.

**Checkpoint:** typecheck green; `npm run test:unit -- preload` green.

---

### Task 6 — Preload test
Status: `[x]`

**Steps**
- [ ] `src/preload/__tests__/index.test.ts`: assert `queueUpdateOptions` exists
      and sends `QUEUE_UPDATE_OPTIONS` with `(id, options, output)`.

**Checkpoint:** `npm run test:unit -- preload` green.

---

## P4 — Renderer helpers

### Task 7 — `batch-options` util
Status: `[x]`

**Problem:** per-job dialog and global propagation must compute options/output
identically to the add-time code without duplication.

**Steps**
- [ ] New `src/renderer/utils/batch-options.ts`:
  - `inferJobOperation(options)` → `transcode` (has `videoCodec`),
    `extract_audio` (has `audioCodec`), `compress_image` (has `qscale`),
    else the first `BATCH_OPERATIONS` value;
  - `buildBatchOptions(operation, values, hw)` — the existing
    `BatchQueue.buildOptions` logic (codec/bitrate/qscale/scale/pixelFormat +
    hardware acceleration), so `BatchQueue` can stop duplicating it;
  - `recomputeJobOutput(job, container)` — swaps the output extension when
    `container` is a compatible container/format for the job's codecs (uses
    `getVideoCodecContainer` / `getAudioCodecContainers` / `IMAGE_FORMATS`),
    else returns the output unchanged.
- [ ] Refactor `src/renderer/pages/BatchQueue.tsx` to use `buildBatchOptions`
      instead of its inline builder.

**Checkpoint:** typecheck green.

---

### Task 8 — Util unit tests
Status: `[x]`

**Steps**
- [ ] New `src/renderer/utils/__tests__/batch-options.test.ts`: operation
      inference for each shape; `buildBatchOptions` per operation with/without
      hw; `recomputeJobOutput` container swap, incompatible-container no-op,
      compress_image format swap, unknown-op no-op.

**Checkpoint:** `npm run test:unit -- batch-options` green.

---

## P5 — Renderer UI

### Task 9 — `QueueJobCard` edit action
Status: `[x]`

**Steps**
- [ ] `src/renderer/components/types.ts`: extend `QueueJobCardProps` with
      `onEditOptions?: (job: QueueJob) => void`, `editLocked?: boolean`,
      `customized?: boolean`.
- [ ] `src/renderer/components/QueueJobCard.tsx`: for QUEUED jobs render an
      edit (pencil) button calling `onEditOptions(job)`; when `editLocked`,
      disable it with a tooltip; when `customized`, show a subtle marker.
- [ ] `src/renderer/styles/QueueJobCard.styles.ts`: styles for the edit button /
      customized marker.
- [ ] `src/renderer/components/__tests__/QueueJobCard.test.tsx`: button
      rendered for queued jobs, hidden otherwise, disabled when locked, callback
      fires with the job.

**Checkpoint:** `npm run test:unit -- QueueJobCard` green.

---

### Task 10 — `QueueJobOptionsDialog` (new component)
Status: `[x]`

**Steps**
- [ ] New `src/renderer/components/QueueJobOptionsDialog.tsx` + props in
      `types.ts`: MUI `Dialog` embedding `BatchEncodingPanel` (operation
      inferred via `inferJobOperation`; missing fields seeded from passed
      `defaults`); codec/container compatibility resets mirror `BatchQueue`;
      Save builds options via `buildBatchOptions`, recomputes output via
      `recomputeJobOutput`, fires `onSave(job, options, output)`; Cancel /
      backdrop close fires `onClose`.
- [ ] New `src/renderer/components/__tests__/QueueJobOptionsDialog.test.tsx`.

**Checkpoint:** `npm run test:unit -- QueueJobOptionsDialog` green.

---

### Task 11 — `BatchQueue` global propagation + locking + alert
Status: `[x]`

**Steps**
- [ ] `src/renderer/pages/BatchQueue.tsx`:
  - `batchStarted = jobs.some(j => j.status === QUEUE_STATUS.RUNNING)`;
  - `customizedIds` state + ref mirror;
  - propagation effect on
    `[videoCodec, audioCodec, container, videoBitrate, audioBitrate, quality,
    scale, pixelFormat, batchStarted]`: skip when `batchStarted` or no QUEUED
    jobs; for each QUEUED job not in `customizedIds`, build options +
    recomputed output; on output collision with any job, skip that job and
    collect its name; call `queueUpdateOptions(id, options, output?)` per job;
    toast `batchQueue.outputCollisionSkipped {count, names}` when any skipped.
  - `editJob` state; `handleEditSave` (collision guard vs other jobs → warn and
    keep dialog open; else update + add to `customizedIds` + success toast);
  - render `AccelAlert` banner below `BatchEncodingPanel` when any QUEUED job
    exists: `optionsLockedAlert` (warning) when `batchStarted`,
    `optionsEditableAlert` (info) otherwise;
  - pass `onEditOptions`, `editLocked={batchStarted}`,
    `customized={customizedIds.has(job.id)}` to cards.
- [ ] `src/renderer/pages/__tests__/BatchQueue.test.tsx`: propagation calls
      `queueUpdateOptions` per queued job and skips customized ones; no
      propagation while running; per-job dialog save updates + marks customized;
      alert text for locked/editable states; collision skip + warning.

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

## P6 — i18n

### Task 12 — Locale keys (56 files, parity enforced)
Status: `[x]`

**Steps**
- [ ] Add to every `src/renderer/i18n/locales/*.json` `batchQueue` section
      (scripted; values = en-US text for now):
      `optionsEditableAlert`, `optionsLockedAlert`, `editOptions`,
      `optionsLocked`, `jobCustomized`, `editOptionsTitle`, `editOptionsSave`,
      `optionsUpdated`, `outputCollision`, `outputCollisionSkipped`,
      `optionsUpdateFailed` (used by the save handler's failure toast).

**Checkpoint:** `npm run validate:locales` green.

---

## P7 — Verification

### Task 13 — Full verification pass
Status: `[x]`

**Steps**
- [ ] `npm run typecheck`
- [ ] `npm test` (`vitest run`)
- [ ] `npm run lint`
- [ ] `npm run validate:locales`

**Checkpoint:** all green.
