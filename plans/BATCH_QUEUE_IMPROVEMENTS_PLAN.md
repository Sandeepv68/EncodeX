# Batch Queue Improvements Plan

Tracking document for the batch-queue quality pass. Each task lists the files
touched, the concrete steps, a verification checkpoint, and its status. Status
legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` skipped.

---

## P1 — High-impact fixes

### Task 1 — Aggregate add/skip feedback + retry error handling
Status: `[x]`

**Problem:** Adding N files fires N success toasts; skips only count duplicates
and hide the filenames; a failed retry (`handleRetry`) rejects unhandled.

**Steps**
- [x] In `enqueueSelections` (`src/renderer/pages/BatchQueue.tsx`):
  - collect an `added` counter and a `skippedNames` list (failures surface as
    per-file error toasts);
  - emit **one** success toast `batchQueue.enqueued {count}` when `added > 0`;
  - keep a per-file error toast for `queueAdd` rejections (message is
    informative) and stop toasting success per file;
  - emit one warning toast `batchQueue.skippedDuplicates {count, names}` when
    anything was skipped (rename semantics: now also covers non-media skips).
- [x] Wrap `handleRetry` in try/catch; show `toast.jobAdded` on success and an
      error toast on failure.
- [x] Tests: update success-toast assertions to `batchQueue.enqueued`; add a
      mixed add/fail aggregation test; add a retry-failure error-toast test.

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

### Task 2 — Extract-audio default extension + audio container codec filter
Status: `[x]`

**Problem:** `extract_audio` defaults to `.mp4` even for AAC (should be `.m4a`),
and the audio container picker offers every container regardless of codec.

**Steps**
- [x] `src/shared/codec-containers.ts`: add `AUDIO_CODEC_CONTAINERS` map and
      `getAudioCodecContainers(codec)` helper (codec → compatible container list).
- [x] `src/renderer/pages/BatchQueue.tsx`:
  - default `extract_audio` output extension to
    `suggestedExtensionForAudioCodec(audioCodec)`;
  - add `handleAudioCodecChange` that clears an incompatible `container`
    (mirrors `handleVideoCodecChange`); wire it to `onAudioCodecChange`.
- [x] `src/renderer/components/BatchEncodingPanel.tsx`: for `extract_audio`,
      build `containerOptions` from `getAudioCodecContainers(audioCodec)`.
- [x] Tests: update extract-audio output expectation to `.m4a`; add a
      codec-filter test in `BatchEncodingPanel.test.tsx` (mp3 hidden for aac,
      visible for `libmp3lame`).

**Checkpoint:** `npm run test:unit -- BatchQueue BatchEncodingPanel` green.

---

### Task 3 + Task 8 — Output collision prevention + dedupe by input+output
Status: `[x]`

**Problem:** dedupe keys on input alone (blocks legitimately different outputs
for the same source) and two jobs can silently target the same output path.

**Steps**
- [x] `src/renderer/pages/BatchQueue.tsx` `enqueueSelections`:
  - dedupe key becomes `${normalizedInput}|${normalizedOutput}`;
  - track existing outputs (from store) and outputs claimed within this batch;
  - skip (with name in the warning toast) when the pair is already queued **or**
    the computed output is already claimed by another job;
- [x] Keep `skipped` warning reporting these too.
- [x] Tests: update the duplicate test so the queued job's output matches what
      the enqueue would generate; add "same input → different output allowed"
      and "two selections colliding on one output are both reported" tests.

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

### Task 4 — Cancel All confirmation
Status: `[x]`

**Problem:** the destructive Cancel All button acts immediately with no way to
undo.

**Steps**
- [x] `src/renderer/pages/BatchQueue.tsx`: add `cancelConfirmOpen` state;
      `handleCancelAll` opens the dialog; confirm runs the existing
      `queueCancelAll` + `clearJobs` + info toast.
- [x] Render `ConfirmDialog` with localized title/message/confirm/cancel labels.
- [x] Tests: update the cancel-all test to confirm the dialog; add a
      cancel-dialog-dismissal test asserting nothing was cancelled.

**Checkpoint:** `npm run test:unit -- BatchQueue ConfirmDialog` green.

---

## P2 — Quality improvements

### Task 5 — Media file validation + picker filter + drop validation
Status: `[x]`

**Problem:** the file picker shows all files and non-media files dropped or
selected (e.g. a `.txt`) get a confusing `queueAdd` error.

**Steps**
- [x] `handleAddFiles` passes `FILE_FILTERS.MEDIA_FILES` to `selectFiles`.
- [x] `enqueueSelections` validates each file against `MEDIA_INPUT_EXTENSIONS`
      (dotfile-aware extension read) and skips non-media files into the warning
      toast with their basename.
- [x] Tests: assert the picker is called with `FILE_FILTERS.MEDIA_FILES`; add a
      "skips non-media files dropped/selected with a warning" test.

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

### Task 6 — Pause state sync from main
Status: `[x]`

**Problem:** if the queue is paused and the app re-opens the Batch page, the
toolbar shows Pause instead of Resume (paused state lives only in the main
process).

**Steps**
- [x] `src/shared/ipc-channels.ts`: add `QUEUE_GET_STATE: 'queue-get-state'`.
- [x] `src/main/ipc/queue.ts`: handle `QUEUE_GET_STATE` returning
      `{ paused: jobQueue.isPaused(), concurrency: jobQueue.getConcurrency() }`.
- [x] `src/preload/index.ts` + `src/renderer/electron-api.d.ts`: expose
      `queueGetState(): Promise<{ paused: boolean; concurrency: number }>`.
- [x] `src/test-setup.ts`: stub `queueGetState` → `{ paused: false, concurrency: 1 }`.
- [x] `BatchQueue`: on mount, seed `paused` from `queueGetState().paused`.
- [x] Tests: main `queue.test.ts` handler test; renderer test that a paused
      main state shows the Resume button on mount.

**Checkpoint:** `npm run test:unit -- BatchQueue` + main `queue.test.ts` green.

---

### Task 7 — Persist last-used batch config
Status: `[x]`

**Problem:** re-entering the Batch page resets operation/codecs/container/
bitrates/quality/scale/pixel-format to defaults.

**Steps**
- [x] `src/shared/constants.ts`: add `BATCH_CONFIG_STORAGE_KEY =
      'encodex-batch-config'`.
- [x] New `src/renderer/stores/batchConfig.ts` with `readStoredBatchConfig()`
      (validated, defaults on missing/invalid) and `persistBatchConfig(config)`.
- [x] `BatchQueue`: initialize the encoding `useState` hooks from the stored
      config; add a `useEffect` persisting on any config change.
- [x] Tests: unit tests for the helpers + a renderer restore-on-mount test.

**Checkpoint:** `npm run test:unit -- batchConfig BatchQueue` green.

---

### Task 9 — Empty filtered results + dotfile output handling
Status: `[x]`

**Problem:** with jobs present, a filter/search that matches nothing shows a
blank list; dotfiles (`.env`) derive bogus outputs like `/_converted.hidden`.

**Steps**
- [x] `BatchQueue` render: when `jobs.length > 0` but `visibleJobs.length === 0`,
      show `batchQueue.noResults` empty text.
- [x] Dotfile-safe output derivation: read the extension and stem from the
      basename (an extension must follow a non-leading dot); fall back to the
      codec-suggested extension when the source has none.
- [x] Tests: no-results message test; dotfile handling test
      (`/in/.env` has no extension, so it is reported as a skipped non-media
      file with a warning instead of producing a bogus `/_converted.env`).

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

## P3 — Deferred (not in this pass)
Status: `[x]`

- [x] Lazy thumbnail rendering for large queues: thumbnails (and the expensive
      ffmpeg preview IPC call) are deferred via an IntersectionObserver until
      the card scrolls within 300px of the viewport, so large queues never
      spawn preview work for off-screen cards. (True windowed virtualization
      would require a new dependency and was deliberately kept out of scope.)
      Generated thumbnails are persisted: the renderer keeps a per-session
      cache (`src/renderer/utils/preview-cache.ts`) that stores resolved values
      and seeds a remounted card's initial render (`getResolvedPreviewThumbnail`
      → `useState` initializer) so navigation, drag overlays, and reordering
      show an existing thumbnail instantly with no async gap; the main-process
      preview IPC handlers back it with a disk cache (`src/main/preview-cache.ts`,
      `userData/previews/`) keyed by source path and validated by file size +
      integer-ms mtime, so a thumbnail is generated once per source file and
      survives renderer reloads and app restarts. Cache hits/misses/write
      failures are logged (`LOG_PREVIEW_CACHE_*`) for diagnosis. Files:
      `src/renderer/components/QueueJobCard.tsx`,
      `src/renderer/utils/preview-cache.ts`, `src/main/preview-cache.ts`,
      `src/main/ipc/image.ts`.
- [x] Native OS completion notification when a batch finishes: the renderer
      raises an HTML5 `Notification` (surfaced as a system notification in
      Electron) with the batch summary next to the existing toast; permission
      is requested once when undecided and all failures are swallowed.
      Files: `src/renderer/pages/BatchQueue.tsx`,
      `src/renderer/i18n/locales/en-US.json` (`batchQueue.notificationTitle`).
- [x] Import/export consistency: the main-process `QUEUE_IMPORT` handler skips
      jobs whose `input|output` pair is already queued or whose output path is
      already claimed (same normalization as the batch page), returning only
      the count of genuinely new jobs. Files: `src/main/ipc/queue.ts`.

**Checkpoint:** `npm run test:unit -- QueueJobCard BatchQueue` + main
`queue.test.ts` green.
