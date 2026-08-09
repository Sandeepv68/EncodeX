# Close-Confirmation Extension Plan

Extends the existing close-guard (see `CLOSE_CONFIRMATION_PLAN.md`) so that closing the
window asks for confirmation not only when a job is *in progress*, but also when a job is
**ready to run** (a form is configured but not started) or the user has **unsaved form
changes**, on the Convert, Image Compress, Audio Extract, and Video Cut pages.

Today the guard only checks the "running" flags (`isConverting` / `isCutting` / queue jobs),
so a configured-but-not-started job or an edited form closes without warning. This plan makes
the guard consider "pending work" = in-progress OR ready OR dirty.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. `taskStore`: add a `hasPendingWork` flag + `setHasPendingWork` setter (global mirror
      for the Image Compress page, which keeps its form in local state).
- [x] C2. `audioExtractStore`: add an `isDirty` flag, set on every user form edit
      (input/output/codec/bitrate), cleared by `clearSelection`; add it to `AudioExtractState`.
- [x] C3. `videoCutStore`: export a pure `isVideoCutDirty(state)` helper (draft differs from
      defaults), reused by the close guard so it can't drift from the page's own `isDirty`.
- [x] C4. `CloseConfirmDialog`: rename the check to `hasPendingWork()` and evaluate per page:
      - Convert: `isConverting || isDirty` (store already tracks `isDirty`; `resetForm()`
        clears it after a successful conversion).
      - Audio Extract: `isConverting || isDirty`.
      - Video Cut: `isCutting || isVideoCutDirty(...)`.
      - Image Compress: `useTaskStore.isConverting || useTaskStore.hasPendingWork`.
      - Batch Queue: unchanged (`queued`/`running` jobs).
- [x] C5. `ImageCompress` page: publish pending work into `taskStore` — set true when an input
      image is selected, false on clear-selection and on unmount (the local form is discarded
      when navigating away).
- [x] C6. i18n: broaden `closeConfirm.message` in `en-US.json` so the copy matches the wider
      trigger set (in-progress OR ready OR unsaved changes), then sync the change across all
      55 other locale files (English dialects reuse the new en-US text; every other locale
      gets a translated update conveying the same meaning).
- [x] C7. `test-setup.ts`: update the mocked `closeConfirm.message` to the new English copy.
- [x] C8. Tests: extend `CloseConfirmDialog.test.tsx` (dirty/ready cases for Convert, Audio
      Extract, Video Cut, Image Compress + updated message), `taskStore.test.ts`,
      `audioExtractStore.test.ts` (dirty lifecycle), `videoCutStore.test.ts`
      (`isVideoCutDirty`), `ImageCompress.test.tsx` (flag published/cleared).
- [x] C9. Docs: update the "Semantics" table in `CLOSE_CONFIRMATION_PLAN.md`.
- [x] C10. Verify: `npx prettier --check`, `npx tsc --noEmit -p tsconfig.json`,
      `npx vitest run`.

## Semantics: which work counts as "pending"

| Page | In progress (existing) | Ready / dirty (new) |
| --- | --- | --- |
| Convert | `useConversionStore.isConverting` | `useConversionStore.isDirty` (any edit; auto-suggested output after input selection; cleared by `resetForm()` on success) |
| Image Compress | `useTaskStore.isConverting` | `useTaskStore.hasPendingWork` (input selected; cleared on clear-selection/unmount) |
| Audio Extract | `useAudioExtractStore.isConverting` | `useAudioExtractStore.isDirty` (input/output/codec/bitrate edited; cleared by `clearSelection`) |
| Video Cut | `useVideoCutStore.isCutting` + `useTaskStore.isConverting` | `isVideoCutDirty(state)` (draft differs from defaults; persisted draft counts on startup) |
| Batch Queue | `queued`/`running` jobs | — (unchanged) |

Paused conversions still count (recoverable only while the app is open). A completed
conversion on Convert resets the form so it no longer blocks closing; on Audio Extract and
Video Cut the form stays configured, so it still counts as "ready".

## Files touched

| Area | File |
| --- | --- |
| Stores | `src/renderer/stores/taskStore.ts`, `src/renderer/stores/audioExtractStore.ts`, `src/renderer/stores/videoCutStore.ts`, `src/renderer/stores/types.ts` |
| Guard | `src/renderer/components/CloseConfirmDialog.tsx` |
| Pages | `src/renderer/pages/ImageCompress.tsx` |
| i18n | `src/renderer/i18n/locales/en-US.json`, `src/test-setup.ts` |
| Tests | `src/renderer/components/__tests__/CloseConfirmDialog.test.tsx`, `src/renderer/stores/__tests__/taskStore.test.ts`, `src/renderer/stores/__tests__/audioExtractStore.test.ts`, `src/renderer/stores/__tests__/videoCutStore.test.ts`, `src/renderer/pages/__tests__/ImageCompress.test.tsx` |
| Docs | `docs/CLOSE_CONFIRMATION_EXTENSION_PLAN.md`, `docs/CLOSE_CONFIRMATION_PLAN.md` |

## i18n

`closeConfirm.message` (en-US) becomes:

> There are jobs in progress or unsaved changes. Closing now will cancel them.

## Verification

- `npx prettier --check "src/**/*.{ts,tsx,json}"`
- `npx tsc --noEmit -p tsconfig.json`
- `npx vitest run` (full suite)
