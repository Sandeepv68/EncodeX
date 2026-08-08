# Batch Queue Encoding Options Plan

**Status:** Approved — full control set, separate options panel, keep-source container default
**Scope:** Add per-operation encoding options (video/audio codec, container, bitrates, scale, pixel format) to the `/batch` BatchQueue page.

## Current State

- `BatchQueue.tsx:145,152` hardcodes `videoCodecRef = 'libx264'` and `audioCodecRef = 'aac'`; **no UI writes to them**.
- `buildOptions` (`BatchQueue.tsx:361-374`) only passes `videoCodec` / `audioCodec` / `hardwareAcceleration` / `hwaccelMode` into job options.
- Output filename always reuses the **source extension** (`BatchQueue.tsx:401-405`), so the container is fixed by the input file.
- `BatchControls.tsx` exposes only: operation type, transcoder backend, suffix, output folder, overwrite, concurrency, and action buttons.
- The main process `buildFfmpegArgs` (`src/main/transcoders/ffmpeg-utils.ts:111-130`) **already supports** `videoBitrate`, `audioBitrate`, `qscale`, `scale`, `pixelFormat`, and `ConversionOptions` (`src/shared/types.ts:84`) allows all fields — no main-process changes needed.

## Reusable Pieces

- `CodecSelect` component (`src/renderer/components/CodecSelect.tsx`) — grouped, capability-filtered video/audio codec picker; safe to use anywhere (`useCapabilities` is module-cached; `getCapabilities` is stubbed in `src/test-setup.ts:74`).
- `GroupedSelect` (`src/renderer/components/GroupedSelect.tsx`) — pixel-format picker (needs a `groupIcons` map, as in `Convert.tsx:96`).
- Constants in `src/shared/media-options.ts`: `VIDEO_CODECS`, `AUDIO_CODECS`, `VIDEO_BITRATE_OPTIONS`, `BITRATE_OPTIONS`, `SCALE_OPTIONS`, `PIXEL_FORMATS`.
- `codec-containers.ts`: `getVideoCodecContainer(codec).containers` for compatible container lists.
- i18n labels `convert.videoCodec`, `convert.audioCodec`, `convert.videoBitrate`, `convert.audioBitrate`, `convert.scale`, `convert.pixelFormat` — **already translated in all 20 locales**, so reused as-is.

## Design Decisions

1. **Full control set** (parity with the Convert page): video codec, audio codec, container, video bitrate, audio bitrate, scale, pixel format.
2. **Separate "Encoding options" panel**: a second `Paper` rendered below `BatchControls` in the page `<Stack spacing={2}>`, shown per operation.
3. **Container default = "Auto (source)"** (`''`): output extension unchanged unless the user picks a container explicitly.
4. **Controlled state** replaces `operationRef`/`videoCodecRef`/`audioCodecRef` so the panel can react to codec changes (container list) and the page can conditionally render per operation.
5. **compress_image** shows image options (output format, quality, scale). The format reuses the `container` state (chosen extension replaces the source extension) and quality maps to `qscale`. Compress_image no longer passes the default `videoCodec` — ffmpeg infers the image encoder from the output extension.
6. **Switching operations resets the container** (`handleOperationChange` → `setContainer('')`), since the value has different semantics per operation (video/audio containers vs image formats).

## Implementation Steps

### Step 1 — Plan document

- [x] Create this tracking file.

### Step 2 — i18n keys

- [x] Add `batchQueue.encodingOptions` ("Encoding options"), `batchQueue.container` ("Container"), `batchQueue.containerAuto` ("Auto (source)") to `en-US.json` and all 19 non-US locale files (per-locale translations via a temp script; keeps full batchQueue parity from the previous sweep).
- [x] Verify all 20 files parse and `batchQueue` stays key-parity with en-US. **All 20 locales at 60 keys; prettier clean.**

### Step 3 — `BatchControls` operation becomes controlled

- [x] `src/renderer/components/types.ts`: replace `operationRef: RefObject<string>` with `operation: string` + `onOperationChange: (operation: string) => void` in `BatchControlsProps`.
- [x] `BatchControls.tsx`: use `value={operation}` / `onChange={(e) => onOperationChange(e.target.value)}` on `OperationSelect`; drop `operationRef`.
- [x] `BatchQueue.tsx`: add `const [operation, setOperation] = useState<string>(BATCH_OPERATIONS[0].value)`; pass `operation` + `onOperationChange={setOperation}`; use `operation` for the review dialog `defaultOperation`.

### Step 4 — `BatchQueue` state refactor

- [x] Replace `operationRef`, `videoCodecRef`, `audioCodecRef` with state:
  - `operation` (default `BATCH_OPERATIONS[0].value`)
  - `videoCodec` (default `'libx264'`), `audioCodec` (default `'aac'`)
  - `container` (default `''` = keep source), `videoBitrate`/`audioBitrate` (default `''`), `scale` (default `''`), `pixelFormat` (default `'yuv420p'`)
- [x] `buildOptions` additionally emits `videoBitrate`/`audioBitrate`/`scale`/`pixelFormat` (transcode: all; extract_audio: audio bitrate only) plus `qscale`/`scale` for compress_image; compress_image drops the video codec so ffmpeg picks the image encoder from the output extension.
- [x] `enqueueSelections` output extension: `const ext = !container ? file.split('.').pop() : container;` so a chosen container/format replaces the source extension (any operation).
- [x] Add `handleVideoCodecChange`: on video-codec change, reset `container` to `''` when it is no longer in `getVideoCodecContainer(v).containers`.
- [x] Add `handleOperationChange`: switches the operation and resets `container` to `''` (container/format semantics differ per operation).

### Step 5 — `BatchEncodingPanel` component (+ styles)

- [x] New `src/renderer/components/BatchEncodingPanel.tsx` + `BatchEncodingPanel.styles.ts` (Paper mirroring `ControlsPaper`).
- [x] New `BatchEncodingPanelProps` in `src/renderer/components/types.ts` (controlled: operation + the encoding values incl. `quality` + their setters).
- [x] `compress_image` renders image controls: output format (reuses `container`/`IMAGE_FORMATS`), quality (number input, `QSCALE_RANGE`), and scale.
- [x] `transcode`: Video codec (`CodecSelect` type=video), Audio codec (`CodecSelect` type=audio), Container select ("Auto (source)" + `getVideoCodecContainer(videoCodec).containers`), Video bitrate, Audio bitrate, Scale, Pixel format (`GroupedSelect` with a local `pixelGroupIcons` map).
- [x] `extract_audio`: Audio codec, Container select (audio list — new exported `AUDIO_CONTAINER_EXTENSIONS` in `codec-containers.ts`), Audio bitrate.
- [x] Render panel in `BatchQueue.tsx` inside the `<Stack spacing={2}>` after `<BatchControls>`.

### Step 6 — Tests

- [x] `BatchControls.test.tsx`: pass `operation`/`onOperationChange`; change the operation-ref test to assert `onOperationChange('extract_audio')`.
- [x] `BatchQueue.test.tsx`: update the three exact options-object assertions (lines 96/127/146) for the new fields; add a test that choosing a container changes the output extension.
- [x] New `BatchEncodingPanel.test.tsx`: renders transcode controls; extract_audio hides video controls; compress_image renders nothing; container select fires `onContainerChange`.
- [x] Drop handler kept `operationRef` — restored as a ref mirrored from `operation` state (registered once with `[]` deps).

### Step 7 — Verification

- [x] `npx prettier --check` on touched files.
- [x] Typecheck (`npm run typecheck` / tsc) — only the pre-existing `hwaccelMode` error at `BatchQueue.tsx:461` (was 407; unrelated, buildOptions return type kept as-is).
- [x] Run `BatchQueue`, `BatchControls`, `BatchEncodingPanel`, `codec-containers` test suites. **70/70 pass.**

## Progress

| Item                                  | State    |
| ------------------------------------- | -------- |
| 1. Plan document                      | **Done** |
| 2. i18n keys                          | **Done** |
| 3. BatchControls operation controlled | **Done** |
| 4. BatchQueue state refactor          | **Done** |
| 5. BatchEncodingPanel component       | **Done** |
| 6. Tests                              | **Done** |
| 7. Verification                       | **Done** |

## Notes

- `convert.*` labels are reused (already translated); only 3 new `batchQueue` keys require translation.
- The pre-existing `hwaccelMode` TS error at `BatchQueue.tsx:461` is unrelated to this change.
- i18n test map in `src/test-setup.ts` falls back to the key, so no test-map additions are needed for the new keys.
