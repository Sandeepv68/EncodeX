# Video & Image Rotation Plan

Tracking document for adding rotation and mirroring (flip) support for videos and
images in EncodeX. Today there is no filter/rotation capability anywhere in the
app — the only FFmpeg video filter is `scale` (see `buildFfmpegArgs` in
`src/main/transcoders/ffmpeg-utils.ts`, and `FfmpegCore.convert` in
`src/main/transcoders/ffmpeg-core.ts`).

This plan adds two mechanisms, selectable by the same single `rotate` +
`flipH`/`flipV` fields:

1. **Pixel rotation (re-encode path)** — an FFmpeg filter chain using
   `transpose=N` (90° CW / 90° CCW / 180°) plus `hflip`/`vflip`, merged into ONE
   `-vf` argument together with the existing `scale`. Works for every container
   (MP4, MKV, WebM, GIF, and all image outputs). Interpolation-free at 90°
   steps; requires re-encoding.
2. **Lossless metadata rotation (stream-copy path)** — `-metadata:s:v rotate=N`
   alongside `-c copy` for MP4 / MOV / MKV outputs only. No re-encode, no quality
   loss, orientation applied by the player. Mirrors (`hflip`/`vflip`) have no
   lossless equivalent and stay pixel-only.

User decisions (confirmed): **90/180/270 + mirror** plus **lossless metadata
rotation**; placement on the **Convert page and the Batch queue** (transcode +
compress-image panels and the per-job dialog). Profiles are out of scope.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` skipped.

---

## Progress tracker

| Phase | Scope | Status |
| ----- | ----- | ------ |
| P1 | Shared contracts (types, constants, logs) | 3 / 3 |
| P2 | Transcoder builders + unit tests | 4 / 4 |
| P3 | Renderer state (store, hook) + tests | 3 / 3 |
| P4 | Convert page UI | 2 / 2 |
| P5 | Batch queue (utils, panels, page) | 4 / 4 |
| P6 | i18n strings | 2 / 2 |
| P7 | Verification (typecheck, lint, tests) | 3 / 4 |

**Implementation notes / deviations from the plan text**

- `ROTATION_VALUES` is `['', '90', '180', '270']` (the empty string is the
  "no rotation" option so the Convert/Batch selects bind directly to the store
  string). `ROTATE_DEGREES` still maps only the three real angles.
- Task 11: the rotation/mirror row renders in **both** modes. In copy mode the
  flip switches are disabled and an alert appears: an info note when rotation
  can be stored as lossless metadata (MP4/MOV/MKV, no mirror), otherwise a
  warning with a "Turn off lossless copy" action. `useConversion` casts the
  store's string to `ConversionOptions['rotate']`.
- Task 18: the two steps are marked `[-]` (skipped, see the Status legend) — the
  new `convert.*` keys are **not** added to the `test-setup.ts` i18n mock because
  the existing convert keys are absent there too (the mock's key fallback keeps
  tests asserting on translation keys), and no `e2e/mocks/preload.js` option
  stub models the conversion payload.
- Task 19: `npm run typecheck`, `npm run lint`, and `npm run test:unit`
  (1908 tests, 148 files) all pass; the manual FFmpeg orientation smoke test
  remains outstanding (only remaining item).
- Batch queue note (Task 15): batch jobs always re-encode, so no copy-mode
  nuance is surfaced in the batch panel; rotation/mirror are simply part of the
  built options for `transcode` and `compress_image`.

---

## P1 — Shared contracts

### Task 1 — `ConversionOptions` rotation fields
Status: `[x]`

**Problem:** the options payload that flows renderer → IPC → transcoders has no
way to express rotation or mirroring.

**Steps**
- [x] `src/shared/types.ts` (in `ConversionOptions`, ~line 87-106): add
      `rotate?: '90' | '180' | '270'` (undefined/absent = no rotation),
      `flipH?: boolean`, `flipV?: boolean`. JSDoc for each: pixel filters;
      copy-mode metadata rotation applied only for MP4/MOV/MKV in the builders.

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 2 — Transcoder constants
Status: `[x]`

**Problem:** the metadata rotation flag, container allow-list, and the
degrees→metadata map need a single shared source.

**Steps**
- [x] `src/shared/transcoder-constants.ts` (in `FFMPEG_FLAGS`, ~line 57-84): add
      `METADATA_ROTATE: '-metadata:s:v'`.
- [x] Same file, after `FFMPEG_FLAGS`: export
      `METADATA_ROTATION_CONTAINERS = ['mp4', 'mov', 'mkv'] as const` and
      `isMetadataRotationContainer(ext: string): boolean` (lowercase compare).
- [x] Same file: export `ROTATION_VALUES = ['90', '180', '270'] as const` and
      `ROTATE_DEGREES: Record<'90' | '180' | '270', string>` mapping to the
      `rotate` metadata value.

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 3 — Log constants
Status: `[x]`

**Problem:** the builders log flags they emit; rotation needs matching entries.

**Steps**
- [x] `src/shared/log-constants.ts` (near `LOG_SCALE`/`LOG_PIXEL_FORMAT`):
      add `LOG_ROTATION`, `LOG_ROTATION_METADATA`,
      `LOG_ROTATION_COPY_UNSUPPORTED` following the existing placeholder style.

**Checkpoint:** typecheck green.

---

## P2 — Transcoder builders

### Task 4 — CLI builder (`ffmpeg-utils.ts`)
Status: `[x]`

**Problem:** `buildFfmpegArgs` (line 61) currently emits `-vf` only when `scale`
is set, as a raw `scale=WxH`. Rotation must (a) merge into that same `-vf`
argument when present, and (b) be expressible losslessly in copy mode via
metadata for supported containers.

**Steps**
- [x] Add exported helpers:
      - `buildRotationFilters(options): string[]` → array `['transpose=1']` for
        `'90'`, `['transpose=2','transpose=2']` for `'180'`,
        `['transpose=2']` for `'270'`; append `'hflip'` when `flipH`,
        `'vflip'` when `flipV`.
      - `buildVideoFilterChain(options): string | null` → `scale=<WxH>` first,
        then `...buildRotationFilters(options)`; join with `','`; null when empty.
      - `metadataRotationValue(options, output): string | null` → non-null only
        when `options.copy && options.rotate && !flipH && !flipV` and
        `isMetadataRotationContainer(getExtension(output))`; returns the
        `rotate=` metadata value from `ROTATE_DEGREES`.
- [x] Replace the scale-only `-vf` block (lines 94-97) with:
      a single `buildVideoFilterChain` call → `args.push(-vf, chain)`.
- [x] In copy mode (line 71-72), after `-c copy`: if `metadataRotationValue`
      returns a value, push `-metadata:s:v` `rotate=<deg>` and log
      `LOG_ROTATION_METADATA`; else if a rotation/flip was requested, log
      `LOG_ROTATION_COPY_UNSUPPORTED` and continue (UI warns up-front).
- [x] Import `getExtension` from `../../shared/codec-containers`.

**Checkpoint:** `npm run test:unit -- ffmpeg-utils` green (new + existing).

---

### Task 5 — Fluent builder (`ffmpeg-core.ts`)
Status: `[x]`

**Problem:** `FfmpegCore.convert` (line 155) handles scale via `cmd.size()`
(sizeFilters) or a `scale=W:-2` `videoFilters` call. fluent-ffmpeg emits
`videoFilters` BEFORE `sizeFilters` in one `-filter:v` argument, so `transpose`
must be part of the `videoFilters` chain (scale-first ordering) whenever
rotation is present.

**Steps**
- [x] In the non-copy branch, replace the scale-only block (lines 204-212) with:
      - if rotation/flip filters exist → build a combined chain
        (`scale=` respecting `keepAspectRatio` `:-2` variant, then the rotation
        filters) and call `cmd.videoFilters(chain)` once;
      - else keep the existing two paths (`cmd.size(...)` /
        `videoFilters('scale=' + :-2)`) unchanged.
- [x] In the copy branch (line 180-182), after `-c copy`: reuse
      `metadataRotationValue(options, output)` → `cmd.outputOptions('-metadata:s:v', 'rotate=<deg>')`.
- [x] Import the new helpers from `./ffmpeg-utils`.

**Checkpoint:** `npm run test:unit -- ffmpeg-core` green (new + existing).

---

### Task 6 — CLI builder tests
Status: `[x]`

**Steps**
- [x] `src/main/transcoders/__tests__/ffmpeg-utils.test.ts`: add cases
      - scale + rotate 90 → `['-vf', 'scale=1280x720,transpose=1']`;
      - rotate 180 → `transpose=2,transpose=2`;
      - rotate + flipH/flipV ordering (`...,transpose=1,hflip`);
      - rotation without scale → `['-vf', 'transpose=1']`;
      - copy + mp4 + rotate 90 (no flips) → `-c copy` + `-metadata:s:v rotate=90`;
      - copy + webm + rotate → no `-metadata:s:v` flag;
      - copy + rotate + flips → no metadata flag.

**Checkpoint:** `npm run test:unit -- ffmpeg-utils` green.

---

### Task 7 — Fluent builder tests
Status: `[x]`

**Steps**
- [x] `src/main/transcoders/__tests__/ffmpeg-core.test.ts`: add cases
      - `videoFilters('scale=1280x720,transpose=1')` when scale+rotate;
      - `videoFilters('transpose=1')` when rotate only;
      - `size()` NOT called when rotation present;
      - copy + mp4 → `outputOptions('-metadata:s:v', 'rotate=90')`;
      - copy + webm → no metadata call.

**Checkpoint:** `npm run test:unit -- ffmpeg-core` green.

---

## P3 — Renderer state

### Task 8 — Conversion store types + state
Status: `[x]`

**Steps**
- [x] `src/renderer/stores/types.ts` (`ConversionState`): add
      `rotate: string`, `flipH: boolean`, `flipV: boolean` and setters
      `setRotate`, `setFlipH`, `setFlipV` (JSDoc, mirror existing setters).
- [x] `src/renderer/stores/conversionStore.ts`: add to `INITIAL_STATE`
      `rotate: ''`, `flipH: false`, `flipV: false`; implement the three setters
      (mark `isDirty: true`); import the new `LOG_*` constants if surfaced.

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 9 — `useConversion` options payload
Status: `[x]`

**Steps**
- [x] `src/renderer/hooks/useConversion.ts` (lines 138-149): pass
      `rotate: store.rotate || undefined`, `flipH: store.flipH || undefined`,
      `flipV: store.flipV || undefined`.
- [x] Add all three to the `useCallback` dependency array (lines 162-176).

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 10 — Store tests
Status: `[x]`

**Steps**
- [x] `src/renderer/stores/__tests__/conversionStore.test.ts`: assert the three
      setters update state and mark the form dirty; `resetForm` clears them.

**Checkpoint:** `npm run test:unit -- conversionStore` green.

---

## P4 — Convert page UI

### Task 11 — Convert page controls
Status: `[x]`

**Problem:** the user needs a rotation selector + flip switches, and clear
copy-mode guidance (metadata rotation only for MP4/MOV/MKV; otherwise re-encode).

**Steps**
- [x] `src/renderer/pages/Convert.tsx`:
      - pull `rotate`, `flipH`, `flipV` (+ setters) out of `useConversion()`;
      - add a `Stack` with a `TextField select` (`ROTATION_VALUES` from
        `media-options`/constants; values `''`/`90`/`180`/`270`, labels from
        i18n) plus two `Switch` rows for Flip horizontally / Flip vertically,
        inside the `!copyMode` block after the qscale/scale/pixelFormat stack;
      - add a copy-mode branch (inside the outer `PageSection`, after the
        `!copyMode` block): a computed `rotationCopyMode` state using
        `outputExt` + `isMetadataRotationContainer` to render either:
          - an `Alert severity="info"` for MP4/MOV/MKV explaining rotation is
            applied as lossless metadata, with flip switches disabled + hint; or
          - an `Alert severity="warning"` (unsupported container / flips) with an
            action button "Turn off lossless copy" calling `setCopyMode(false)`.

**Checkpoint:** `npm run typecheck:renderer` + `npm run lint` green.

---

### Task 12 — Convert page tests
Status: `[x]`

**Steps**
- [x] `src/renderer/pages/__tests__/Convert.test.tsx`: render the rotation select
      / flip switches; selecting rotation passes it and flips into the
      `convertFile` options; in copy mode with `.mp4` output the metadata note
      appears; with an unsupported container the warning + "turn off copy" action
      appears.

**Checkpoint:** `npm run test:unit -- Convert` green.

---

## P5 — Batch queue

### Task 13 — Batch options util
Status: `[x]`

**Steps**
- [x] `src/renderer/utils/batch-options.ts`: add `rotate: string`,
      `flipH: boolean`, `flipV: boolean` to `BatchEncodingValues` (line 27-36);
      `buildBatchOptions` (line 59): include `rotate`, `flipH`, `flipV` for
      `transcode` AND `compress_image` operations.

**Checkpoint:** `npm run test:unit -- batch-options` green.

---

### Task 14 — Batch options tests
Status: `[x]`

**Steps**
- [x] `src/renderer/utils/__tests__/batch-options.test.ts`: rotation fields flow
      through for transcode and compress_image; empty rotation is omitted.

**Checkpoint:** `npm run test:unit -- batch-options` green.

---

### Task 15 — Batch UI panels
Status: `[x]`

**Steps**
- [x] `src/renderer/components/BatchEncodingPanel.tsx` and
      `QueueJobOptionsDialog.tsx`: add the same rotation select + flip switches to
      the shared field grid (they both drive `BatchEncodingValues`); disabled when
      the element is locked (running batch / external edit).
- [x] Keep copy-mode nuance out of the batch panel for now (batch jobs always
      re-encode by default); document in code.

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 16 — Batch page wiring
Status: `[x]`

**Steps**
- [x] `src/renderer/pages/BatchQueue.tsx`: add `rotate`, `flipH`, `flipV` state
      (defaults from `initialConfig`), thread through both `buildBatchOptions`
      call sites (lines 545, 784), the effects/dependencies (lines 511-516,
      547-565, 786), the panel `defaults` prop (line 1401), and profile
      application (line 1042) if present in the profile later.
- [x] `BatchQueue.test.tsx`: rotation values land in `queueAdd` options.

**Checkpoint:** `npm run test:unit -- BatchQueue` green.

---

## P6 — i18n

### Task 17 — en-US strings
Status: `[x]`

**Steps**
- [x] `src/renderer/i18n/locales/en-US.json` (`convert` namespace, lines 60-119):
      add `rotation`, `rotationHint`, `rotateNone`, `rotate90Cw`, `rotate180`,
      `rotate270Ccw`, `flipHorizontal`, `flipVertical`, `flipHint`,
      `rotateCopyMetadataNote`, `rotateCopyUnsupported`,
      `rotateTurnOffCopy`. Other locales fall back to en-US.

**Checkpoint:** `npm run validate:locales` (or typecheck) green.

---

### Task 18 — Test i18n mock + e2e preload stub
Status: `[x]`

**Steps**
- [-] `src/test-setup.ts` (lines 17-70): add the new `convert.*` keys to the
      mock dictionary so component tests render human-readable labels.
- [-] `e2e/mocks/preload.js`: add `rotate`/`flipH`/`flipV` to its
      conversion-option stub if it models options.

**Checkpoint:** `npm run test:unit` green.

---

## P7 — Verification

### Task 19 — Full gate
Status: `[~]`

**Steps**
- [x] `npm run typecheck` (renderer + main + preload)
- [x] `npm run lint`
- [x] `npm run test:unit`
- [ ] Manual smoke: convert an MP4 90° CW (re-encode) and a stream-copy
      MP4 90° (metadata) and confirm orientation.

**Checkpoint:** all green.

---

## Open notes / risks

- **Metadata rotation caveat:** only MP4/MOV/MKV muxers honor `rotate`; WebM,
  FLV, GIF and image outputs always take the re-encode path. Mirrors always
  re-encode.
- **fluent-ffmpeg ordering:** `videoFilters` precede `sizeFilters` in the emitted
  `-filter:v`; rotation therefore forces the full chain through `videoFilters`
  (scale-first) instead of `cmd.size()`.
- **180°** = `transpose=2,transpose=2` (equivalent to `hflip,vflip`); kept as
  transpose for explicitness.
- **Profiles:** intentionally out of scope per conversation; `ConversionProfile`
  gains no rotation field in this iteration.