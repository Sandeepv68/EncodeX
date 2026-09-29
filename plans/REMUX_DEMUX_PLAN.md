# Remux & Demux Support Plan

Tracking document for adding **remux** (lossless container re-wrap via stream
copy, e.g. MKV→MP4) and **demux** (splitting a container's video/audio/subtitle
streams into separate output files) to EncodeX.

Today EncodeX already re-muxes losslessly through Convert's "Lossless copy"
toggle, CLI `convert --copy`, and MCP `convert_media { copy: true }` — but only
as a side effect of the generic convert pipeline: there is no stream selection
(`-map`), no per-stream codec control (`-c:v/-c:a/-c:s`), no container-aware
remux validation, no way to add external assets, and no way to split streams
into multiple files. Audio extraction (`extract-audio`, AudioExtract page) is a
degenerate single-audio demux.

This plan adds first-class remux and demux across all four surfaces (GUI, CLI,
MCP, batch queue) on top of the existing ITranscoder/`convert`-style pipeline.

Remux is defined here as **lossless re-multiplexing with full stream
composition**, beyond a plain container swap:

- select which of the source's video/audio/subtitle streams to keep (add/remove)
- **add** external subtitle tracks (`.srt`/`.ass`/`.vtt` files)
- **add** external audio tracks (`.m4a`/`.aac`/`.mp3`/... files)
- **add a thumbnail / cover image** (MP4/MOV `attached_pic` disposition, MKV/WebM attachment)
- **copy or import chapters** (from the source, or from an FFMETADATA chapters file)
- **sync audio/video timing losslessly** — fix a track that is early/late
  against the rest of the file (added tracks via `-itsoffset`; the primary
  file's own audio via a lossless "re-read" offset)

Demux is defined here as **stream splitting with optional per-stream
conversion**, beyond raw bitstream extraction:

- split video / each audio track / each subtitle track into separate files
- **lossless copy** by default (`-c copy`, `.h264`/`.m4a`/`.srt`-style outputs)
- **convert individual streams** when the user wants a playable target format:
  audio → `.mp3`/`.flac`/`.wav`/`.m4a` (`-c:a`), subtitles → `.srt`/`.ass`
  (`-c:s`), video → `.mkv`/`.mp4` container (`-c:v` + container)

Everything in remux stays lossless for the underlying streams; only
straightforward stream-copy-compatible codec swaps (e.g. `srt`→`mov_text` for
MP4, attached picture) are performed when embedding. Demux conversions follow
the same existing encoder path as Convert (the re-encode branch of the builder),
so only demux is allowed to re-encode.

> **Note on multi-input plumbing:** adding external assets means remux is an
> **N-input** operation (`-i primary -i subs.srt -i audio.m4a -i cover.jpg
> -i chapters.txt`), while the existing convert pipeline is single-input.
> The plan carries the extra inputs as **`ConversionOptions.additionalInputs`**
> so the existing `convertFile(input, output, options, transcoder)` IPC contract
> and the queue can stay unchanged — the options object already flows through
> every layer (renderer → preload → main → transcoder builder).
>
> **Audio/video sync is also multi-input.** Two cases:
> - Added/embedded track is early/late → delay that **whole input** with
>   `-itsoffset <n> -i <file>` (lossless; FFmpeg applies the offset when the
>   input is demuxed).
> - The **primary file's own audio** is out of sync with its own video → the
>   "re-read" trick: keep `-i primary` for video, then add a second input
>   `-itsoffset -i primary` mapped **only** to the audio streams —
>   `ffmpeg -i in.mkv -itsoffset 0.5 -i in.mkv -map 0:v -map 1:a -c copy out`.
>   Still lossless stream copy; the same file is demuxed twice. The re-read
>   input is represented as an ordinary `additionalInputs` entry whose
>   `path === primary path`, so the builder needs no special casing.
> - Offset sign convention: positive = stream plays **later** (slow down);
>   the UI/CLI expose a signed value and `buildRemuxPlan` picks the right
>   `-itsoffset` sign for the target.

User decisions (confirmed): dedicated **Remux** page and dedicated **Demux**
page; CLI `remux`/`demux` **and** MCP `remux_media`/`demux_media`; batch-queue
integration using the existing queue. Remux page also exposes subtitle add,
audio add, thumbnail, and chapter controls (this expansion); demux also supports
per-stream conversion targets (audio codec, subtitle format, video container).

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` skipped.

---

## Progress tracker

| Phase | Scope | Status |
| ----- | ----- | ------ |
| P1 | Shared contracts (types, flags, logs, error codes) | 4 / 4 |
| P2 | Transcoder builder multi-input/map/subtitle/chapters/cover + tests | 5 / 5 |
| P3 | Renderer stores + hooks + tests | 3 / 3 |
| P4 | Remux page (streams, subtitles, audio add, thumbnail, chapters) + tests | 9 / 9 |
| P5 | Demux page (route, nav, icon, shortcuts, dashboard) + tests | 6 / 6 |
| P6 | Batch queue integration + tests | 4 / 4 |
| P7 | CLI `remux`/`demux` subcommands + tests + CLI.md | 5 / 5 |
| P8 | MCP `remux_media`/`demux_media` tools + tests + MCP.md | 4 / 4 |
| P9 | i18n strings (all locales) | 2 / 2 |
| P10 | Docs + full verification | 3 / 3 |

**Implementation notes / deviations from the plan text** — (filled in as work lands).

- **Final state (2026-09-26):** all 10 phases and 47 tasks complete, nothing
  skipped. Verification: typecheck/lint clean (0 errors), `test:unit` 2557
  passed, `test:e2e` 142 passed / 2 skipped, `test:integration` 43 passed,
  `mcp:smoke` 15 tools, plus a scripted CLI + MCP remux/demux smoke on
  generated assets. Two open follow-ups: (1) the 116 new i18n keys are English
  placeholders in the 55 non-base locales, (2) GUI-only checks (drag-and-drop,
  live warning panel, in-page pause/resume) still deserve a human pass.

- Task 13 (P4): nav wiring added for `/remux` across `AppDrawer.tsx`
  (`navKeyMap['/remux'] = 'remux'`), `Dashboard.tsx`, `pageIcons.tsx`
  (`faLayerGroup`), and `shortcuts.ts` (`remux.input` = Ctrl+O, `remux.start` =
  Ctrl+Enter). Also added `global.navRemux` = Alt+0 and shifted the dashboard
  number-key shortcuts (`dashboard.remux` = 6, `dashboard.batch` = 7) so the
  dashboard card order stays aligned. A minimal placeholder
  `src/renderer/pages/Remux.tsx` was created so the lazy `/remux` route boots;
  the full page is built out in Task 14. New i18n keys (`nav.remux`,
  `dashboard.descRemux`, `remux.title`, shortcut labels) added to `en-US.json`
  only; all-locale sweep is P9 Task 43 as planned.
- Task 14 (P4): full remux page layout built out in
  `src/renderer/pages/Remux.tsx` — drop zone / `MediaPreview` input picker
  (filtered to `VIDEO_EXTENSIONS`), container select (`OUTPUT_VIDEO_EXTENSIONS`),
  source stream table (kind/index/codec/language/channels) with checkboxes bound
  to `selectedMaps` (specs replicate the store's `buildStreamMaps` per-type
  ordinals, skipping `attached_pic` cover streams), live warnings panel from
  `store.warnings`, output `FilePathField` (`selectOutput`, auto-suggested,
  `withExtension`-normalized), and start/pause/resume/cancel + `ProgressBar`.
  Run controls use `useTaskRunControls(useRemuxStore)` since the store owns the
  remux lifecycle (documented deviation from the plan's "Use `useMediaTask`" —
  the shared hook is for page-owned lifecycles; both live in `useMediaTask.ts`).
  Success toast reveal folded into `remuxStore.startRemux` as a toast `action`
  calling `window.electronAPI.revealFile(output)` (label reuses
  `batchQueue.revealInFolder`; i18n `remux.*` keys for the page added to
  `en-US.json` only). Page render/interaction tests in
  `src/renderer/pages/__tests__/Remux.test.tsx` (10 tests). Full suite green;
  renderer/mail typechecks + lint + lint:strings clean.
- Task 15 (P4): source-stream add/remove completed — "Keep all / none"
  shortcuts bound to new `remuxStore.setAllStreamsSelected(selected)` (rebuilds
  `selectedMaps` via `buildStreamMaps` = every non-cover stream, or `[]`),
  plus the primary-audio sync control ("Delay audio (seconds)", signed, bound
  to `audioSyncSeconds`, shown only while a primary audio stream is selected).
  The control reuses Task 9's lossless re-read slice in `buildRemuxPlan`; inline
  caption states it is lossless. Store gained `setAddedStreamCodec`. Page + store
  tests added (select all/none, audio sync bind/clear).
- Task 16 (P4): "Add Subtitle File" button → `selectFiles` filtered to
  `SUBTITLE_EXTENSIONS`; each chosen file is added via `remuxStore.addSubtitleFile`
  as a `RemuxInput` with `map: ['N:0']` (N = 1-based input index) and a default
  codec taken from `SUBTITLE_CODEC_CONTAINERS[container]` (e.g. `mov_text` for
  MP4, `subrip` for MKV) with `copy` offered in the per-track target-codec
  `TextField select` bound to `entry.codec` via `setAddedStreamCodec`. Removing
  an entry (trash icon) clears its warning; the existing `addedSubtitleCodecUnsupported`
  warning (Task 7) surfaces when the chosen codec/container pair is incompatible.
- Task 17 (P4): "Add Audio Track" button → `selectFiles` filtered to
  `AUDIO_EXTENSIONS`; each chosen file is added via `remuxStore.addAudioFile`
  as a `RemuxInput` (`map: ['N:0']`, `codec: 'copy'`) and its audio stream-0 is
  probed with `getMediaInfo` (info kept in a new parallel `remuxStore.addedAudioInfo`
  array so codec/channels/language render next to the track). Each row has a
  signed delay input bound to `syncOffsetSeconds` via `setAddedStreamSync`
  (emitted as `-itsoffset`, lossless) and a remove control; the combined index
  (subtitles then audio) fixes the input-index order. `addAudioFile`,
  `removeAddedStream`, and `clearSelection` keep `addedAudio`/`addedAudioInfo`
  in sync.

- Task 18 (P4): "Add Thumbnail" button → `selectFile` filtered to
  `.jpg/.jpeg/.png`; the store's `thumbnail` RemuxInput is composed
  container-aware: MKV/WebM attach it (`attachment: true`, no `-map`), MP4/MOV
  map it as an extra video input with `disposition: 'attached_pic'`. The picker
  is disabled (with an inline hint) for containers that support neither
  (checked via `isContainerCompatibleWithCover`). A live preview of the chosen
  image renders in `MediaPreview`, seeded from `getResolvedPreviewThumbnail` and
  refreshed through `getPreviewThumbnail`.
- Task 19 (P4): "Chapters" FieldBox — "Copy source chapters" toggle bound to
  `remuxStore.copyChapters` (default on, emitted `-map_chapters 0`) and an
  "Import Chapters File" button (`selectFile` filtered to `.ffmeta`/`.txt`)
  storing `remuxStore.chaptersFile` (emitted `-map_chapters N+1`, replacing the
  copy). The import control is disabled with an inline hint
  (`isContainerCompatibleWithChapters`) for containers like TS/AVI that cannot
  store chapter metadata.
- Tasks 36-38 (P7) and 39-42 (P8): see the per-task **Note** blocks in this
  document (each section records the concrete implementation, deviations, and
  test counts).

---

## P1 — Shared contracts

### Task 1 — `ConversionOptions` stream fields
Status: `[x]`

**Problem:** the options payload flowing renderer → IPC → transcoders has no
way to select individual streams (`-map`), embed external files, or drive
per-stream codecs. Remux/demux need all of these.

**Steps**
- [x] `src/shared/types.ts` (in `ConversionOptions`), add:
  - `map?: string[]` — each entry becomes a repeated `-map` flag selecting
    streams from the **primary** input (e.g. `['0:v:0', '0:a:1']`).
  - `subtitleCodec?: string` — emitted as `-c:s` (e.g. `srt`, `mov_text`,
    `ass`); used when embedding subtitle streams into containers that cannot
    hold the source sub codec.
  - `additionalInputs?: RemuxInput[]` — external files added as extra `-i`
    inputs **after** the primary input. See the `RemuxInput` interface below.
  - `chaptersFile?: string` — absolute path to an FFMETADATA chapters file;
    added as an extra `-i` input and used with `-map_chapters <that index>`.
  - `copyChapters?: boolean` — preserve the source's chapters with
    `-map_chapters 0` (default when remuxing; explicit so callers can suppress).
  - `audioSyncSeconds?: number` — signed seconds to shift the **primary file's
    audio streams** relative to its video (lossless re-read trick). Positive =
    audio plays later. Absent = no sync adjustment.
- [x] Same file, add interface:

  ```ts
  export interface RemuxInput {
    path: string;               // absolute path of the external file
    map: string[];              // -map specs targeting this input (e.g. ['1:0'])
    codec?: string;             // per-stream codec(s), e.g. 'mov_text'; keyed by map order
    disposition?: string;       // e.g. 'attached_pic' for MP4/MOV cover art
    attachment?: boolean;       // MKV/WebM: attach as stream (cover art) instead of -i
    syncOffsetSeconds?: number; // signed -itsoffset applied to THIS input before -i;
                                // positive = stream plays later. Used for added-track sync
                                // AND for the primary "re-read" entry (path === primary path).
  }
  ```

  JSDoc each field; document the input-index contract (primary = `0`,
  additional inputs = `1..N` in array order, chapters file = `N+1`); document
  that a re-read sync entry is just a `RemuxInput` whose `path` equals the
  primary path and whose `map` selects only the shifted streams.

**Checkpoint:** `npm run typecheck:renderer` green.

---

### Task 2 — Transcoder flags
Status: `[x]`

**Problem:** `FFMPEG_FLAGS` in `src/shared/transcoder-constants.ts` has
`COPY`/`INPUT`/`NO_AUDIO`/`NO_VIDEO` but no `-map`, `-c:s`, `-map_chapters`,
`-attach`, or disposition/metadata flags.

**Steps**
- [x] In `FFMPEG_FLAGS` add: `MAP: '-map'`,
      `SUBTITLE_CODEC: '-c:s'`, `MAP_CHAPTERS: '-map_chapters'`,
      `DISPOSITION: '-disposition'`, `ATTACH: '-attach'`,
      `METADATA_STREAM_TYPE: '-metadata:s:t'`, `ITSOFFSET: '-itsoffset'`.
- [x] Export `SUBTITLE_CODEC_CONTAINERS` guidance map used by the compat guard
      (Task 7): `{ mp4: ['mov_text', 'subrip'], mov: ['mov_text', 'subrip'],
      mkv: ['subrip', 'ass', 'webvtt'], webm: ['webvtt'], ts: ['subrip'] }`.
- [x] Document `-map` spec syntax (`0[:type[:index]]`; `map` specs for
      additional inputs reference their own input index).

**Checkpoint:** typecheck green.

---

### Task 3 — Log constants
Status: `[x]`

**Problem:** builders log each flag they emit; stream selection, subtitle
codec, additional inputs, thumbnails, and chapters need matching entries.

**Steps**
- [x] `src/shared/log-constants.ts` (near `LOG_VIDEO_CODEC`/`LOG_AUDIO_CODEC`):
      add `LOG_MAP`, `LOG_SUBTITLE_CODEC`, `LOG_ADDITIONAL_INPUT`,
      `LOG_THUMBNAIL`, `LOG_CHAPTERS_FILE`, `LOG_COPY_CHAPTERS`,
      `LOG_ATTACH_COVER`, `LOG_DISPOSITION_KEYED`,
      `LOG_STREAM_SKIPPED_NO_MATCH`, `LOG_CHAPTERS_COPY_UNSUPPORTED`,
      `LOG_SYNC_OFFSET` (logs `-itsoffset` emission + the signed value) — all in
      the existing placeholder style.

**Checkpoint:** typecheck green.

---

### Task 4 — Error codes
Status: `[x]`

**Problem:** remux/demux need distinct failure signals for stream-mapping
mismatches, incompatible container/codec pairs, and bad auxiliary assets.

**Steps**
- [x] `src/shared/errors.ts` (`ErrorCode`): add
      `STREAM_NOT_FOUND` (`-map` spec matches no input stream),
      `INCOMPATIBLE_CONTAINER` (a stream's codec cannot be muxed into the
      chosen container in stream-copy mode), `AUXILIARY_INPUT_NOT_FOUND` (an
      added subtitle/audio/chapter/cover file is missing). Reuse
      `INVALID_FORMAT` for unreadable ffmetadata/chapter files.

**Checkpoint:** typecheck green.

---

## P2 — Transcoder builder support

### Task 5 — Multi-input, `-map`, `-c:s` emission in `buildFfmpegArgs`
Status: `[x]`

**Problem:** `buildFfmpegArgs` (`src/main/transcoders/ffmpeg-utils.ts:137`)
emits exactly one `-i` input, blanket `-c copy`, and no mapping. All CLI-based
backends (FFToolCore, BmfCore) share this builder; `FfmpegCore.convert`
(fluent-ffmpeg) passes outputOptions and must be extended in parallel.

**Steps**
- [x] Input section: emit `-itsoffset <s>` immediately before `-i <path>` for
      every additional input (or the primary re-read entry) whose
      `syncOffsetSeconds` is set — FFmpeg requires `-itsoffset` to precede the
      `-i` it modifies. Log `LOG_SYNC_OFFSET`. After the primary `-i`, for each
      `additionalInputs` entry (skipping `attachment: true` entries — those are
      emitted in the output section) push `-itsoffset` (if any) then `-i <path>`;
      log `LOG_ADDITIONAL_INPUT`. If `chaptersFile` is set, push
      `-i <chaptersFile>` last; log `LOG_CHAPTERS_FILE`.
- [x] Copy-mode branch: emit `-map <spec>` for every entry in `options.map`
      (logged `LOG_MAP`) **and** for every additionalInput `map` spec —
      `-map` flags may appear before the codec flags; order within the branch:
      maps first, then `-c copy`, then per-stream overrides.
- [x] Per-stream codecs: after `-c copy`, emit `-c:s <subtitleCodec>` when set
      (log `LOG_SUBTITLE_CODEC`), and `-c:<kind or specifier> <codec>` for each
      additionalInput `codec` (log via `LOG_ADDITIONAL_INPUT` line). Order
      matters: a specific `-c:s`/`-c:a`/`-c:v` must follow the blanket `-c copy`.
- [x] Chapters: emit `-map_chapters 0` when `copyChapters !== false`; emit
      `-map_chapters <N+1>` instead when `chaptersFile` is set (input index of
      the metadata file). Log `LOG_COPY_CHAPTERS`/`LOG_CHAPTERS_FILE`.
- [x] Attachments / cover art in the output section:
      - `attachment: true` input → `-attach <path>` then
        `-metadata:s:t mimetype=image/jpeg` (log `LOG_ATTACH_COVER`).
      - cover as `-i`-mapped video with `disposition` → `-disposition:v:<n>
        attached_pic` (log `LOG_DISPOSITION_KEYED`).
- [x] `src/main/transcoders/ffmpeg-core.ts`: mirror the same flags via
      fluent-ffmpeg outputOptions based on the same `options` fields.

**Checkpoint:** `npm run test:unit` — new builder cases pass (multi-input
ordering, `-map` indices, `-c:s` after `-c copy`, chapters index, attach vs
disposition, `-itsoffset` positioning and sign).

---

### Task 6 — FfmpegCore.convert multi-input parity
Status: `[x]`

**Problem:** `FfmpegCore` is the default backend for GUI/CLI when
`TRANSCODER_TYPES[0]` (`FFMPEG`) is selected; it must accept all the new
`options` fields with the same semantics as the raw builder.

**Steps**
- [x] Extend `FfmpegCore.convert` to append additional `-i` inputs (via
      `ffmpeg.input(path)`), the `-map`/`-c:s`/`-map_chapters`/`-attach`/
      `-disposition` flags through `outputOptions`, and include the extra
      inputs in the spawn command. Ensure it stays in lock-step with the args
      `buildFfmpegArgs` produces for FFTOOL/BMF (compare in a unit test).

**Checkpoint:** `npm run test:unit` green for both backends on the same
options payload.

---

### Task 7 — Container compatibility guard for remux
Status: `[x]`

**Problem:** remux must reject (or warn on) a target container that cannot hold
a source or added stream — e.g. `.ass` subs into MP4 (must be re-encoded, so
warn), PGS subs into MP4, VP9-only WebM, attached pictures in non-MKV. The
`CONTAINERS` list in `src/shared/codec-containers.ts` already classifies video
codecs against containers.

**Steps**
- [x] `src/shared/codec-containers.ts`: add
      `isContainerCompatibleWithStream(containerExt, stream: MediaStreamInfo)`
      — video via `isExtensionCompatibleWithVideoCodec`, audio via
      `AUDIO_CONTAINERS` (fallback true), subtitle via a small
      `SUBTITLE_CONTAINERS` map (`subrip`→`srt, mkv, mp4, mov, ts`,
      `ass`→`ass, mkv, mov`, `webvtt`→`webvtt, mkv, webm, mp4`,
      `hdmv_pgs_subtitle`/`dvd_subtitle`→`mkv, m2ts`).
- [x] Add `isSubtitleCodecAllowed(codec, containerExt)` using the
      `SUBTITLE_CODEC_CONTAINERS` guidance from Task 2.
- [x] Add `isContainerCompatibleWithCover(containerExt)` — attached picture
      only for `mkv`/`webm`; `attached_pic` disposition for `mp4`/`mov`.
- [x] Export `remuxWarnings(inputs, additionalInputs, chaptersFile, containerExt)`
      returning a structured `{ icon: 'info'|'warning'|'error', stream, message }[]`
      for GUI + CLI + MCP reuse, covering: incompatible source stream, unsupported
      added subtitle codec, chapters not writable to target container, cover not
      supported by target container.

**Checkpoint:** `npm run test:unit` — new helper cases pass.

---

### Task 8 — Demux target naming helper
Status: `[x]`

**Problem:** demux must derive one output path per extracted stream
(`name.video.h264`, `name.audio_0.m4a`, `name.subtitle_0.srt`) in a shared,
testable place so GUI, CLI, and MCP stay consistent.

**Steps**
- [x] `src/shared/codec-containers.ts` (or `src/shared/stream-utils.ts`): add
      `suggestedExtensionForStream(stream: MediaStreamInfo): string` — video →
      `suggestedExtensionForVideoCodec`, audio →
      `suggestedExtensionForAudioCodec` (fallback `mkv`/`mka`), subtitle →
      `srt` for text subs / `mks` for bitmap subs.
- [x] Add `DemuxMediaPreferences` type:
      `{ videoContainer?: string; audioCodec?: string; subtitleCodec?: string }`
      — per-kind **conversion** targets. Absent = lossless copy with the
      stream's default extension.
- [x] Add `buildDemuxTargets(input, baseName, selectedStreams, media?)
      : DemuxTarget[]` where `DemuxTarget = { index, kind, map, copy, codec?,
      container?, output }`. When `media` requests a kind (e.g.
      `audioCodec: 'mp3'`), set `copy: false` + `codec` so the builder emits
      `-c <kind>:<codec>`; otherwise copy. Output extension follows the target
      codec/container. Mapping: `basename.kind_index.ext`.

**Checkpoint:** `npm run test:unit` — naming + conversion-target cases pass.

---

### Task 9 — `buildRemuxArgs` shared helper
Status: `[x]`

**Problem:** the Remux GUI, CLI, and MCP all need to translate a container +
stream-selection + asset list into the exact same `ConversionOptions`. Centralize
it so all surfaces agree and are unit-tested once.

**Steps**
- [x] `src/main/cli/cli-util.ts` (or a new `src/shared/remux-utils.ts` — prefer
      shared so GUI can import it): add
      `buildRemuxPlan(input, { container, maps, additionalInputs,
      chaptersFile, copyChapters, audioSyncSeconds }): { options: ConversionOptions; output: string }`
      which sets `copy: true`, `map`, `additionalInputs`, `chapters`/chapter
      flags, derives the output extension from `container` (validated against
      the guard in Task 7), and rejects with `INCOMPATIBLE_CONTAINER` on hard
      incompatibilities. Keep it pure and CLI-free (mirrors the MCP
      `buildBatchPlan`/`buildExtractAudioPlan` pattern).
- [x] Sync handling inside `buildRemuxPlan`: when `audioSyncSeconds` is set,
      take the primary's selected audio `map` specs out of `map`, append a
      re-read `RemuxInput { path: input, map: [<those specs re-indexed to the
      new input>], syncOffsetSeconds: audioSyncSeconds }` to `additionalInputs`,
      and add `-c:a copy` (via `subtitleCodec`-style override or `extraArgs`)
      so the shifted audio is still stream-copied. Emit the re-read entry last
      (after user-added inputs) so its input index is deterministic.
- [x] Sign handling: accept a **signed** delay (audio later = positive) and set
      `syncOffsetSeconds` on the entry accordingly; document the convention in
      the JSDoc and the CLI help text.

**Checkpoint:** `npm run test:unit` green (buildRemuxPlan + buildDemuxTargets,
incl. a sync case asserting `-itsoffset` value, re-read `map` re-indexing, and
`-c:a copy`).

---

## P3 — Renderer stores + hooks

### Task 10 — `remuxStore`
Status: `[x]`

**Problem:** the Remux page needs form + run state like the existing
`audioExtractStore` (`src/renderer/stores/audioExtractStore.ts`).

**Steps**
- [x] `src/renderer/stores/remuxStore.ts` (Zustand singleton): state
      `{ input, container, streams(MediaStreamInfo[]), selectedMaps(string[]),
      addedSubtitles(RemuxInput[]), addedAudio(RemuxInput[]),
      thumbnail(RemuxInput|null), chaptersFile(string|null),
      copyChapters(bool), audioSyncSeconds(number|null), output, isDirty,
      isConverting, isPaused, progress, warnings }`; actions `setInput` (probe
      via `getMediaInfo`, populate streams, auto-suggest output), `setContainer`
      (recompute warnings), `toggleStream`, `addSubtitleFile`/`removeAddedStream`,
      `setAddedStreamSync` (per-entry `syncOffsetSeconds`), `setAudioSync`
      (primary audio delay seconds), `setThumbnail`, `setChaptersFile`,
      `setCopyChapters`, `setOutput`, `startRemux` (validate, run
      `buildRemuxPlan` with `audioSyncSeconds`, call
      `window.electronAPI.convertFile(input, output, plan.options,
      TRANSCODER_TYPES[0])`), `pause`/`resume`/`cancel`, `clearSelection`.
- [x] Subscribe once to `onConversionProgress` gated on `isConverting`.

**Checkpoint:** `npm run test:unit` green.

---

### Task 11 — `demuxStore`
Status: `[x]`

**Problem:** demux orchestrates *multiple* `convertFile` calls (one per selected
stream). The store owns the sequential runner and aggregated progress.

**Steps**
- [x] `src/renderer/stores/demuxStore.ts`: state `{ input, streams,
      selectedIndices(number[]), outputDir, targets(DemuxTarget[]),
      media(DemuxMediaPreferences), isConverting, isPaused, progress,
      current(kind|index|null) }`; actions `setInput` + probe + generate
      `buildDemuxTargets` (passing `media`), `toggleStream`, `setMedia`
      (per-kind conversion targets: video container, audio codec, subtitle
      codec; clears back to copy on change), `setOutputDir`, `startDemux`
      (run each target sequentially via `convertFile` with `{ copy: t.copy,
      map: [t.map], videoCodec/audioCodec/subtitleCodec when !t.copy,
      video:false/audio:false as appropriate }`), `pause`/`resume`/`cancel`,
      `clearSelection`.

**Checkpoint:** `npm run test:unit` green.

---

### Task 12 — `useMediaTask` reuse
Status: `[x]`

**Problem:** both pages need pause/resume/cancel UI wiring; `useMediaTask`
(`src/renderer/hooks/useMediaTask.ts`) already wraps this for single tasks but
demux is N-invocation.

**Steps**
- [x] Extend `useMediaTask` (or add thin page-local wrappers) so Remux reuses it
      as-is and Demux exposes `current` sub-task info for progress display.

**Checkpoint:** `npm run test:unit` green.

---

## P4 — Remux page

### Task 13 — Route + navigation registration
Status: `[x]`

**Steps**
- [x] `src/renderer/App.tsx` (~line 59-77): `const Remux = lazy(() =>
      import('./pages/Remux'));` and `{ path: '/remux', element: <Remux /> }`
      (~line 155-166).
- [x] `src/shared/app-constants.ts` (`NAV_ITEMS`): `{ to: '/remux', label: 'Remux' }`.
- [x] `src/renderer/pageIcons.tsx`: `'/remux': <FontAwesomeIcon icon={faLayerGroup} />`.
- [x] `src/renderer/constants/shortcuts.ts`: `remux.input`/`remux.start`.
- [x] `src/renderer/pages/Dashboard.tsx`: `'/remux': 'descRemux'` in `descKeys`
      + nav-key ternary.

**Checkpoint:** app boots; `/remux` reachable from drawer, dashboard, shortcut.

---

### Task 14 — Remux page core layout
Status: `[x]`

**Steps**
- [x] `src/renderer/pages/Remux.tsx`: input picker (`selectFile` filtered to
      `VIDEO_EXTENSIONS`) → container select (`OUTPUT_VIDEO_EXTENSIONS`) →
      source stream table (kind/index/codec/language/channels) with
      checkboxes bound to `selectedMaps` → live warnings panel from
      `remuxWarnings` → output path (`selectOutput`, auto-suggested) →
      start/pause/resume/cancel + progress → success toast + reveal. Use
      `useMediaTask`.

**Checkpoint:** `npm run test:unit` green (basic render).

---

### Task 15 — Source stream add/remove
Status: `[x]`

**Steps**
- [x] The stream table is the "remove audio" control: unchecking any primary
      audio stream drops it (`map` omits it). "Keep all / none" shortcuts.
- [x] Implement `toggleStream` to rebuild `selectedMaps` as ordered `0:v:0`,
      `0:a:1`, `0:s:0`-style specs for the primary input only.
- [x] Add a **sync control** for the primary audio ("Delay audio (ms / s)",
      signed): binds to `audioSyncSeconds`; when set, `buildRemuxPlan` performs
      the re-read slice (Task 9) so video stays at `0` and audio shifts.
      UI shows an inline hint that this is lossless (stream copy, no re-encode)
      and disables the control when no primary audio is selected.

**Checkpoint:** `npm run test:unit` green.

---

### Task 16 — Add subtitle tracks
Status: `[x]`

**Steps**
- [x] "Add subtitle file" button → `selectFiles` filtered to
      `.srt`/`.ass`/`.vtt` → each becomes an `additionalInputs` `RemuxInput`
      with `map: ['N:0']`.
- [x] For each added subtitle, show a target-codec select (default from
      container per Task 2 `SUBTITLE_CODEC_CONTAINERS`, e.g. `mov_text` for
      MP4/MOV, `copy`/`subrip` for MKV) bound to `codec`.
- [x] When the user's chosen container cannot hold the added subtitle format
      (e.g. `.ass` → MP4), surface the Task 7 warning; unchecking the entry
      clears it.

**Checkpoint:** `npm run test:unit` + manual smoke (MKV remux with .ass→mp4
mov_text conversion).

---

### Task 17 — Add audio tracks
Status: `[x]`

**Steps**
- [x] "Add audio track" button → `selectFiles` filtered to audio extensions
      (`.m4a`/`.aac`/`.mp3`/`.flac`/`.opus`/`.ogg`/`.wav`) → each becomes a
      `RemuxInput` `map: ['N:0']`, `codec: 'copy'`, and is listed with its
      stream info (probe each added file's audio stream 0 via `getMediaInfo`).
- [x] Per-added-track "remove" control; ordering fixes the input index order.
- [x] Per-added-track **sync delay** input (signed ms/s) bound to
      `syncOffsetSeconds` → emitted as `-itsoffset` losslessly; label reuse
      `remux.addedTrackDelay`.

**Checkpoint:** `npm run test:unit` + manual smoke (MP4 with added .m4a track,
both heard in output; an added track delayed by 2 s via `-itsoffset`).

---

### Task 18 — Thumbnail / cover art
Status: `[x]`

**Steps**
- [x] "Thumbnail image" picker → `selectFile` filtered to
      `.jpg`/`.jpeg`/`.png` → stored as `thumbnail` RemuxInput.
- [x] Behavior is container-aware: MKV/WebM → `attachment: true`
      (attached picture stream); MP4/MOV → `-i` + `disposition:
      attached_pic` mapped as a video stream. Disable/warn the picker for
      containers that support neither.
- [x] Live preview of the chosen image.

**Checkpoint:** `npm run test:unit` + manual smoke (thumbnail shows in
Explorer/QuickTime after remux).

---

### Task 19 — Chapters
Status: `[x]`

**Steps**
- [x] Default: `copyChapters` on so source chapters survive remux
      (`-map_chapters 0`).
- [x] "Import chapters file" button → `selectFile` filtered to
      `.ffmeta`/`.txt` (FFMETADATA `[CHAPTER]` format) → stored as
      `chaptersFile`, replacing `copyChapters` emission (`-map_chapters N+1`).
- [x] Warn when the selected container does not store chapters (none of
      MP4/MOV/MKV/WebM lists it as unsupported today, but keep the guard for
      TS/AVI).

**Checkpoint:** `npm run test:unit` + manual smoke (chapters list in media
player after remux).

---

### Task 20 — Remux validation behavior
Status: `[x]`

**Steps**
- [x] Warnings are inline and non-blocking; hard errors (stream type that
      cannot be copied to the container at all) block start and surface via the
      error store with the new `INCOMPATIBLE_CONTAINER` code. Missing auxiliary
      files surface `AUXILIARY_INPUT_NOT_FOUND`.

**Checkpoint:** manual UI smoke + unit tests.

**Notes**: warnings recomputed by `setContainer`/`toggleStream`/`setAddedStreamCodec`
stay inline and never block `startRemux` (store test `startRemux stores
non-blocking warnings from the plan`). Hard container incompatibility already
threw `INCOMPATIBLE_CONTAINER` from `buildAndValidateRemuxPlan`; `startRemux`
catches it and routes through `useErrorStore.showError` WITHOUT converting
(store test `startRemux rejects a hard container incompatibility without
converting`). The remaining `AUXILIARY_INPUT_NOT_FOUND` gap was closed in the
main process: `CONVERT_FILE` now runs `existsSync` on every
`options.additionalInputs[].path` plus `options.chaptersFile` before creating
the transcoder and throws `createError(ErrorCode.AUXILIARY_INPUT_NOT_FOUND,
..., <missingPath>)` (renderer has no fs access; the check is centralized
where the file is actually opened). `inferErrorCode` gained an
`'auxiliary input'`/`'added subtitle, audio'` message branch so the code
survives IPC serialization on its way to the error store. Tests:
`CONVERT_FILE rejects with AUXILIARY_INPUT_NOT_FOUND` for a missing added
input and a missing chapters file (existing files still convert), a
`formatError` inference test, and a store test proving `startRemux` surfaces
`AUXILIARY_INPUT_NOT_FOUND` without converting. Full suite: 178 files / 2397
tests green; typecheck:main + typecheck:renderer clean.

---

### Task 21 — Analytics events
Status: `[x]`

**Steps**
- [x] `src/shared/analytics/events.ts`: add `remux_started`, `remux_completed`,
      `remux_failed` with `{ container, streamCount, addedSubs, addedAudio,
      hasThumbnail, hasChapters, hasAudioSync }` payloads; send from
      `remuxStore` (mirror `audio_extract_completed`).

**Checkpoint:** typecheck + analytics tests green.

**Notes**: three events added to the taxonomy (`AnalyticsEventName`,
`AnalyticsEventPayloadMap`, `ANALYTICS_EVENT_GROUP` = `convert`,
`ANALYTICS_EVENT_TIER` = `v1`). `remux_completed` also carries a `durationSec`
field (mirrors `audio_extract_completed`); `remux_failed` is skipped when the
failure was a CANCELLED conversion (mirrors `audio_extract_failed`). All three
are sent from `remuxStore.startRemux` via `recordAnalyticsEvent` /
`createAnalyticsEvent`: `remux_started` right before `convertFile`,
`remux_completed` after success (with elapsed seconds), `remux_failed` in the
catch branch with the AppError code. Wire test (`AnalyticsWiring.test.ts`)
auto-checks every event name has a non-test call site and passes. typecheck +
analytics/remux store tests green; `lint:aptabase` clean (only pre-existing
unused-directive warnings).

---

### Task 22 — Log constants + preload log lines
Status: `[x]`

**Steps**
- [x] `src/shared/log-constants.ts`: `LOG_START_REMUX`, `LOG_REMUX_COMPLETE`,
      `LOG_REMUX_FAILED`.
- [x] Preload: add matching `LOG_*` debug lines for the remux store calls.

**Checkpoint:** typecheck green.

**Notes**: `LOG_START_REMUX`, `LOG_START_REMUX_NO_INPUT_FILE`,
`LOG_START_REMUX_NO_OUTPUT_FILE`, `LOG_REMUX_COMPLETE`, and `LOG_REMUX_FAILED`
added to `log-constants.ts` (alphabetical placement) and consumed by
`remuxStore.startRemux` — replacing the previous generic `startConversion:` /
`Conversion completed/failed` lines so remux lifecycle is identifiable in the
main log. The preload already bridges every remux store call
(`getMediaInfo`/`convertFile`/`pause`/`resume`/`cancel`/`revealFile`) with its
own info-level lines, and remux shares those existing IPC channels, so no
remux-specific preload bridge lines exist (unlike Task 39's CLI/MCP constants).
typecheck:renderer/main/preload all green; remux store + page tests (50)
green.

---

### Task 23 — Remux page styles + i18n keys
Status: `[x]`

**Steps**
- [x] `src/renderer/styles/Remux.styles.ts` only if layout differs from existing
      page patterns; otherwise reuse existing style components.
- [x] `en-US.json`: `nav.remux`, `dashboard.descRemux`, `remux.*` (title,
      container, streams, streamIndex, addSubtitle, addAudio, thumbnail,
      chapters, selectAll, warnings, start/pause/resume/cancel,
      `audioSync`, `audioSyncHint`, `addedTrackDelay`,
      `addedTrackDelayHint`). See P9 for the all-locale sweep.

**Checkpoint:** locale validation passes.

Note: No `Remux.styles.ts` needed — the page reuses `FieldBox`/`FieldLabel`
from `form.styles.ts`, `SelectedFileName`/`ActionRow` from
`AudioExtract.styles.ts`, and `PageContainer`'s standard layout, matching the
page-pattern reuse the task permits. All task keys verified present in
`en-US.json`; a scripted check of `Remux.tsx` confirmed every `t('…')` call
resolves against en-US (the only "miss" was the `{{file}}` interpolation
literal, a false positive). `npm run validate:locales` still reports the 55
non-en locales missing the remux/demux/nav/shortcuts/toast keys — this is the
expected pre-sweep state: the plan defers all non-en locales to P9 Task 43,
whose own checkpoint is the passing `validate:locales` (each earlier i18n task
13/14 records the same deferral: "all-locale sweep is P9 Task 43 as planned").

---

## P5 — Demux page

### Task 24 — Route + navigation registration
Status: `[x]`

**Steps** — same shape as Task 13 for `/demux`:
- [x] `App.tsx`: `Demux` lazy page + `/demux` route.
- [x] `NAV_ITEMS`: `{ to: '/demux', label: 'Demux' }`.
- [x] `pageIcons.tsx`: `'/demux': <FontAwesomeIcon icon={faScissors} />`.
- [x] `shortcuts.ts`: `demux.input`/`demux.start`.
- [x] `Dashboard.tsx`: `'/demux': 'descDemux'` + nav ternary.

**Checkpoint:** app boots; `/demux` reachable everywhere.

Note: same registration surface as Task 13's `/remux` wiring — `AppDrawer.tsx`
`navKeyMap['/demux'] = 'demux'`, `Dashboard.tsx` desc + nav ternary, and
`pageIcons.tsx`. `demux` was added to the `ShortcutSection` union and
`SHORTCUT_SECTIONS` (plus `shortcuts.sections.demux` label). Because every
Alt+digit is already assigned (Alt+1..9 + Alt+0 = remux), no `global.navDemux`
shortcut exists; the demux page is reachable via the drawer, the dashboard card,
and dashboard number key 7. The dashboard digit shortcuts were shifted so card
order stays aligned: `dashboard.remux` = 6, `dashboard.demux` = 7,
`dashboard.batch` = 8 (matching the Task 13 precedent). A minimal placeholder
`src/renderer/pages/Demux.tsx` (title + page chrome only, full extraction UI is
Task 25) plus a 1-test smoke render keep the lazy `/demux` route bootable. New
i18n keys (`nav.demux`, `dashboard.descDemux`, `demux.title`,
`shortcuts.sections.demux`, `shortcuts.demux.*`, `shortcuts.dashboard.demux`)
added to `en-US.json` only; all-locale sweep is P9 Task 43 as planned.
`npm run typecheck:renderer`, lint (renderer), and `lint:strings` clean;
affected unit tests (constants, shortcuts, AppDrawer, ShortcutsHelpDialog,
Dashboard, App, Demux) green.

---

### Task 25 — Demux page component
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/renderer/pages/Demux.tsx`: input picker → probed stream list grouped
      by kind (video/audio/subtitle) with checkboxes + suggested output names →
      per-kind **conversion target selectors** (video: `copy`/`.mkv`/`.mp4`;
      audio: `copy`/`mp3`/`m4a`/`flac`/`wav`; subtitle: `copy`/`srt`/`ass`
      via the Task 29 `.srt` gain-loss rules) → output-directory picker
      (`selectDirectory`) → per-stream summary (showing copy vs convert) →
      start/pause/resume/cancel with per-stream progress (`current` from the
      store) → per-file toast + reveal. Use `demuxStore`.

**Checkpoint:** `npm run test:unit` green. — 179 files / 2411 tests pass.

**Note:** The page uses the store's existing single success toast (`toast.demuxed`);
the per-file reveal is folded into that toast's action (revealing the first
extracted output), mirroring the remux precedent (Task 14). There is no
directory-reveal IPC, so the action targets the first target's concrete output.
Bitmap-subtitle conversion fallback (`.mks` copy) is Task 26. The page's
`demux.*` keys were added to `en-US.json` in this task (Task 29 completes the
full `.srt` gain-loss set); `validate:locales` non-en parity stays deferred to
P9 Task 43.

---

### Task 26 — Demux subtitle handling
Status: `[x]` — 2026-09-25

**Steps**
- [x] Text subtitles (subrip/ass/webvtt): extract with `-c:s copy`
      (`.srt`/`.ass`/`.webvtt` preserved) **or** convert with `-c:s srt`
      (`.ass`/`.webvtt` → `.srt`), `-c:s ass`, `-c:s webvtt` as selected.
- [x] Bitmap subtitles (PGS/DVDSUB): extract to `.mks` (MKV) preserving the
      stream. **Conversion note:** a bitmap subtitle cannot become plain
      `.srt` in a stream-copy pipeline (needs OCR/re-encode), so selecting
      `srt` for a bitmap stream shows a warning and falls back to `.mks`
      copy (no silent conversion). If OCR-based subtitle conversion is
      wanted in the future it becomes a separate re-encode feature (out of
      scope here).

**Checkpoint:** unit tests for each subtitle codec path (`copy`, `srt`,
`ass`) + manual smoke with a PGS-subtitle sample (warn + `.mks` fallback).

**Note:** `suggestedExtensionForStream` now maps text-subtitle codecs to their
native extension on copy (`subrip`→`srt`, `ass`→`ass`, `webvtt`→`vtt`) and
keeps `.mks` for bitmap subs, so extracting a PGS/DVDSUB stream suggests `.mks`
automatically. `buildDemuxTargets` converts text subs to `srt`/`ass`/`webvtt`
(`webvtt`→`.vtt`) as requested and silently keeps bitmap subs as stream copy.
New shared `demuxWarnings(streams, media)` (in `codec-containers.ts`) emits a
`bitmapSubtitleWarning`-coded finding for every bitmap subtitle selected while a
text conversion is requested; `demuxStore` now carries a `warnings` field
(built alongside targets in `buildTargets`, cleared in `clearSelection`) and the
Demux page renders them in a `demux-warnings` FieldBox with `faTriangleExclamation`
(before the output-dir field). Two new en-US keys (`demux.subtitleWarning`,
`demux.subtitleWarningHint`) added; full `.srt` gain-loss key sweep stays Task 29.
Coverage: shared codec-containers tests (copy/`srt`/`ass`/`webvtt`, PGS warning),
`demuxStore` (warning + `.mks` fallback, text conversions), Demux page
(warning render/dismiss, native `.ass`/`.vtt` output names). Full suite:
179 files / 2421 tests pass.

---

### Task 27 — Analytics events
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/shared/analytics/events.ts`: `demux_started`, `demux_completed`,
      `demux_failed` with `{ kindCounts, streamCount, convertedKinds }`; send
      from `demuxStore`.

**Checkpoint:** typecheck + tests green.

**Note:** taxonomy additions — new `DemuxTargetKind` type
(`'video' | 'audio' | 'subtitle'`), the three `demux_*` names wired into
`AnalyticsEventName`, `AnalyticsEventPayloadMap`, `ANALYTICS_EVENT_GROUP`
(`'convert'`) and `ANALYTICS_EVENT_TIER` (`'v1'`), mirroring the `remux_*`
block. `demux_started` fires once per run before the sequential loop,
`demux_completed` (with `durationSec`) fires when every target succeeded, and
`demux_failed` fires on the first non-cancelled target error (cancellation
stays silent, matching remux). Payloads are derived by a module-local
`demuxAnalyticsSummary(targets)` (per-kind counts, stream total, re-encoded
kinds) — categorical only, no paths. Covered by 4 new demuxStore tests
(finish, fail, cancel-silence, converted kinds) with the AnalyticsService
facade mocked; `AnalyticsWiring` completeness test passes via the store call
sites.

---

### Task 28 — Log constants
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/shared/log-constants.ts`: `LOG_START_DEMUX`, `LOG_DEMUX_STREAM`,
      `LOG_DEMUX_COMPLETE`, `LOG_DEMUX_FAILED`, `LOG_DEMUX_CONVERT_KIND`
      (logs when a stream is re-encoded vs copied).

**Checkpoint:** typecheck green.

**Note:** constants added in the sorted sections of log-constants.ts
(`LOG_DEMUX_*` after `LOG_DISPOSITION_KEYED`, `LOG_START_DEMUX` between
`LOG_START_CONVERSION_NO_OUTPUT_FILE` and `LOG_START_EXTRACT`). demuxStore now
logs: `LOG_START_DEMUX <input> -> <count> targets`, per-target
`LOG_DEMUX_STREAM <kind> <index> -> <output>` + `LOG_DEMUX_CONVERT_KIND copy|re-encode`,
`LOG_DEMUX_FAILED <err>` on the first non-cancelled failure, and
`LOG_DEMUX_COMPLETE <input> -> <count> streams` on full success (generic
`LOG_CONVERSION_FAILED`/`LOG_START_CONVERSION` references dropped;
`LOG_START_CONVERSION_NO_INPUT_FILE` retained for the no-input guard).
Typecheck + demuxStore tests green.

---

### Task 29 — Demux styles + i18n keys
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/renderer/styles/Demux.styles.ts` only if needed.
- [x] `en-US.json`: `nav.demux`, `dashboard.descDemux`, `demux.*` (title,
      outputDir, streamGroup, subtitleWarning, bitmapSubtitleWarning, copyLabel,
      convertLabel, videoContainer, audioCodec, subtitleFormat, extractLabels,
      etc.).

**Checkpoint:** locale validation passes.

**Note:** no `Demux.styles.ts` needed — the page reuses `FieldBox`/`FieldLabel`
(`form.styles`) and `SelectedFileName`/`ActionRow` (`AudioExtract.styles`) plus
a couple of inline `sx` props that pass `lint:inline-styles`. `nav.demux`,
`dashboard.descDemux`, and the bulk of `demux.*` (title, outputDir,
copyLabel, convertLabel, videoContainer, audioCodec, subtitleFormat,
selectStream, summary, start/pause/resume/cancel, toast) already landed with
Tasks 22/25. Added this task: `demux.streamGroup` ("{{kind}} streams", now used
for the per-kind table headings) and `demux.bitmapSubtitleWarning` (localized
body used when `warning.code === 'bitmapSubtitleWarning'`, with the shared
English `warning.message` as fallback for future codes — matches the
`RemuxWarning` doc contract "UI localizes via code"). Full `validate:locales`
pass is deferred to Task 43 (P9) exactly like the remux/convert keys; the
en-US additions here are covered by `lint:strings` (clean) + page/store tests
(39 passing).

---

## P6 — Batch queue integration

### Task 30 — Operation enum + constants
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/shared/types.ts` (`ConversionOperation`, ~line 436-447): add
      `Remux = 'remux'`, `Demux = 'demux'`.
- [x] `src/shared/media-options.ts` (`BATCH_OPERATIONS`, ~line 255-259): add
      `{ value: 'remux', label: 'Remux' }` and `{ value: 'demux', label: 'Demux' }`.
- [x] Representation decision (documented in plan notes): a demux selection is
      enqueued as **one queue job per extracted stream** (each with its own
      output) so existing queue progress/pause/cancel logic works untouched.
      **Preferred:** per-stream jobs.

**Checkpoint:** typecheck green.

**Note:** `ConversionOperation.Remux/'remux'` and `Demux/'demux'` added to the
enum; `BATCH_OPERATIONS` gained both entries (typed `as const`). Representation
decision confirmed: demux enqueues **one job per extracted stream** (each job
carries its own `-map`/output), leaving the queue runner untouched. Since the
operation dropdowns render via per-operation label maps, both `operationLabels`
maps (BatchControls + QueueAddReviewDialog) gained `remux`/`demux` entries wired
to new en-US keys `batchQueue.operationRemux`/`operationDemux`; also updated the
`ConversionOperation` enum test (+2 members). Typecheck + BatchControls/
batchConfig tests green.

---

### Task 31 — Batch options builder
Status: `[x]` — 2026-09-25

**Steps**
- [x] `src/renderer/utils/batch-options.ts`: in `buildBatchOptions`
      (~line 86-105) handle `remux` (keep container field, force `copy: true`,
      map `selectedMaps`, drop encoders) and `demux` (stream/kind fields plus
      the `DemuxMediaPreferences` — video container, audio codec, subtitle
      format — threaded into each job's options). Extend `buildOutputPath`
      (~line 130-145) so `remux` uses the selected container extension and
      `demux` uses the stream-derived or conversion-target extension.
      Extend `inferJobOperation` (~line 152-160): `copy: true` + container ⇒
      `remux`; `map` present ⇒ `demux`.
- [x] `src/renderer/utils/__tests__/batch-options.test.ts`: remux/demux cases
      incl. a demux job with `audioCodec: 'mp3'` (assert `copy: false` +
      codec emitted).

**Checkpoint:** `npm run test:unit` green.

**Note:** `BatchEncodingValues` gained optional `selectedMaps` (remux
`-map` edge list), `demuxKind`/`demuxMap` (the single stream this per-stream
job covers), and `demuxVideoContainer`/`demuxAudioCodec`/`demuxSubtitleFormat`
(the per-kind `DemuxMediaPreferences` targets; empty = lossless stream copy).
`buildBatchOptions` returns early for the new operations: `remux` → `{ copy:
true, map: selectedMaps }` with all encoders dropped; `demux` → per-kind
`-vn`/`-an` guards + `map: ['<spec>']`, `copy` flipped off and the matching
codec emitted when the kind's conversion target is set (video encoder derived
from the container via `DEFAULT_VIDEO_ENCODERS`, now exported from
`shared/codec-containers.ts`; the mp3 `audioCodec` case asserts `copy: false`).
`buildOutputPath` gained an optional `streamName` inserted between stem and
suffix (so per-stream demux outputs are distinct, e.g.
`movie.audio_1_encodex_demux.srt`) plus explicit `remux`/`demux` → source-ext
fallback; the container value still takes precedence, so callers pass the
per-stream stream-derived/conversion ext as `container`. `inferJobOperation`
checks `map`/`copy` BEFORE codec markers (converted demux jobs still carry
their re-encode codec) — `map` ⇒ `remux` only when video AND audio edges are
kept, else `demux`; `copy` ⇒ `remux`. `recomputeJobOutput` swaps the ext
freely for remux jobs and leaves per-stream demux outputs untouched. Typecheck
+ batch-options tests green (54 passing).

---

### Task 32 — Queue job utils + panels
Status: `[x]` — 2026-09-26

**Steps**
- [x] `src/renderer/utils/queue-job-utils.ts`: `planEnqueues` accepts remux
      (video files only) and demux (video files only); extension expectations
      (~line 116).
- [x] Batch panel components: container selection for `remux`; stream/format
      options for `demux` (consistent with existing per-operation panels).

**Checkpoint:** `npm run test:unit` green (179 files / 2466 tests).

**Note:** `planEnqueues` became `async` (returns `Promise<EnqueuePlan>`) with a
new optional `probe?: (file) => Promise<MediaStreamInfo[]>` on
`PlanEnqueuesContext` — **batch demux probes each file at add time** (via
`getMediaInfo`) and emits **one draft per selected stream**, filtering
`attached_pic` streams and the panel's `demuxKinds` (default all three) and
building targets with `buildDemuxTargets`; each draft gets its per-stream output
(`streamName` from the target name) and per-stream `buildBatchOptions('demux',
{ ...enc, demuxKind, demuxMap })`. A file whose probe fails or matches no stream
is skipped once. `BatchQueue.enqueueSelections` awaits the plan and passes
`probe`. Remux needs no special branch — the existing single-draft path plus
`buildBatchOptions('remux')` covers it.

Panels: `BatchEncodingPanelProps` gained `demuxKinds` /
`demuxVideoContainer` / `demuxAudioCodec` / `demuxSubtitleFormat` plus four
change callbacks (`components/types.ts`). `BatchEncodingPanel` renders a
container select for `remux` (generic video containers from
`getVideoCodecContainer('')`) and, for `demux`, a stream-kind toggle group plus
per-kind target selects mirroring the single-file Demux page's target sets
(`copy` ↔ `''`). `BatchQueue` holds the four fields as state (seeded from
`BatchConfig`, threaded into the persist effect, the options-propagation effect
+ deps, the `planEnqueues` enc literal, the panel props and the
`QueueJobOptionsDialog` defaults); `BatchConfig` (stores/batchConfig.ts)
persists them with `demuxKinds` validated against `DEFAULT_DEMUX_KINDS` (now
exported from `queue-job-utils.ts`). `QueueJobOptionsDialog` seeds a single
demux job's kind/`map`/conversion target from its baked options (target derived
from the output extension, falling back to a `DEFAULT_VIDEO_ENCODERS` reverse
lookup) and re-emits them on save, and seeds a remux job's container from its
output extension. New en-US keys: `demux.extractStreams`,
`batchQueue.remuxContainerHint`. Tests: BatchEncodingPanel (+6 remux/demux
cases), QueueJobOptionsDialog (+2), batchConfig (+1), BatchQueue (+3 page-level
remux/demux enqueue cases).

**Note:** demux conversion targets carry the *short* target name in the emitted
codec (`audioCodec: 'm4a'` for the m4a target), exactly as the shipped
single-file flow does (`demuxStore.optionsForTarget` → `buildDemuxTargets`
`target.codec`). Batch demux therefore mirrors that behaviour; mapping short
names to real encoder names for both flows is a separate follow-up.

---

### Task 33 — Queue job migration note
Status: `[x]` — 2026-09-26

**Steps**
- [x] `FileQueuePersistence` (`src/main/queue/`): verify persisted jobs with
      `map`/`copy`/`additionalInputs`/chapters fields round-trip. Prefer
      additive fields; add type-guard migration only if required.

**Checkpoint:** `npm run test:unit` green.

**Note:** **No migration required.** Both queue serialization paths are
pass-through over the whole `options` object, so every additive field
(`map`, `copy`, `video`/`audio`, `subtitleCodec`, `additionalInputs`,
`chapters`, …) round-trips unchanged and `QUEUE_STATE_VERSION` /
`QUEUE_EXPORT_VERSION` stay at `1`:
- `FileQueuePersistence.save` writes `JSON.stringify(snapshot)` and
  `JobQueue.buildSnapshot()` shallow-copies each job (`{ ...job }`), so
  `options` is serialized verbatim; `load()` only checks that `jobs` is an array.
- `buildQueueExport` projects jobs to `{ input, output, options, transcoder }`
  and `validateQueueExport` only requires `options` to be an object — no field
  whitelist, so nothing is dropped on import.

Verified with tests: `src/main/__tests__/job-queue.test.ts` (restores remux and
demux jobs with their `copy`/`map`/`video`/`audio`/`subtitleCodec` options
intact; a `flushState()` → `load()` cycle preserves `map` + `additionalInputs`
+ `chapters`) and `src/main/queue/__tests__/queue-transfer.test.ts` (a
build → JSON → parse round-trip keeps every multi-input/metadata option).

---

## P7 — CLI subcommands

### Task 34 — `remux` subcommand
Status: `[x]` — 2026-09-26

**Steps**
- [x] `src/main/cli/cli-remux.ts` (new). Flags:
      `-o/--output`, `-f/--format <container>`, repeatable `--map <spec>`,
      repeatable `--add-subtitle <file[::subcodec]>`, repeatable
      `--add-audio <file>`, `--thumbnail <image>`, `--chapters <ffmeta-file>`,
      `--no-chapters`, `--subtitle-codec <codec>`, `--no-subtitles`,
      `--audio-sync <seconds>` (signed; primary-file audio delay via the
      re-read trick), repeatable `--set-sync <seconds>` applied to the
      preceding `--add-*` input (per-added-track offset), `--transcoder <type>`
      (reuse global). Builds options via `buildRemuxPlan` (passing
      `audioSyncSeconds` and per-input `syncOffsetSeconds`),
      validates with `remuxWarnings`, exits `EXIT_CODES.USAGE` (2) on hard
      incompatibility, `EXIT_CODES.NOT_FOUND` (4) on missing auxiliary input.
- [x] Register in `src/main/cli/cli.ts` dispatch with alias `rmx`.
- [x] `e2e/cli.spec.ts`: remux smoke (MKV→MP4), remux with `--add-audio`,
      `--thumbnail`, `--chapters`, remux with `--audio-sync 0.5`; assert
      container header + exit 0. Unit tests in `src/main/cli/__tests__/`.

**Checkpoint:** `npm run test:unit` + `npm run test:e2e` green.

**Note:** `buildRemuxCliPlan(input, flags, streams)` is the pure entry point
(container resolution, stream selection, extra inputs, chapters) and returns
`{ options, output, container, warnings }` from
`buildAndValidateRemuxPlan`; `runRemux` probes with `getInfo`, prints
`remuxWarnings` findings, and fails with `CLI_EXIT_USAGE` on the thrown
`INCOMPATIBLE_CONTAINER` **or** any `icon: 'error'` warning, with
`CLI_EXIT_NOT_FOUND` for a missing primary/added subtitle/added audio/thumbnail/
chapters file (checked up front so a typo fails before FFmpeg spawns).
Warnings with `icon: 'warning' | 'info'` are printed and the remux proceeds —
mirroring the GUI, which shows them without blocking.

Stream selection: explicit `--map` wins; otherwise every probed stream is
mapped through the new shared `buildPrimaryStreamMaps(streams, includeSubtitles)`
(`src/shared/remux-utils.ts`, now also used by `remuxStore.buildStreamMaps`), and
`--no-subtitles` drops subtitle streams. `--no-subtitles` combined with `--map`
is reported as ignored rather than silently filtered (explicit maps may target
added inputs).

`--set-sync` binds to the *preceding* `--add-*`, which Commander's per-option
arrays cannot express, so `--add-subtitle`/`--add-audio`/`--set-sync` share one
`createRemuxAddCollector()` coercion factory that records occurrences in argv
order (`RemuxAddToken`); `buildAddedInputs` then assigns input indices
`1..N` in that order (attachments excluded, matching `buildFfmpegArgs`) and
applies `syncOffsetSeconds` to the preceding entry. Added subtitles default to
the container's first `SUBTITLE_CODEC_CONTAINERS` entry (as the GUI picker
does), overridden by `--subtitle-codec` then by the per-file `::codec` suffix.

Supporting changes: `runConvert` was split so the progress-bar/timeout runner
is reusable as `runPreparedConversion` (`cli-convert.ts`) — behavior
unchanged, now shared with `remux`; `ATTACHED_PIC_DISPOSITION` was promoted to
`src/shared/transcoder-constants.ts` (was duplicated in `Remux.tsx` and
`remuxStore.ts`); `remux`/`demux` were added to `CLI_SUBCOMMANDS` and `rmx` to
`CLI_ALIASES` so the legacy flat-form shim does not rewrite them (Task 38).
`cli_completed`/`cli_invoked` already carry a `subcommand` property, so Task 37
needed no new event for `remux` — and now report `subcommand: 'remux'`.

Tests: 31 unit cases in `src/main/cli/__tests__/cli-remux.test.ts` (container
resolution, `::codec` parsing incl. Windows drive letters, index accounting,
`--set-sync` binding, cover attachment vs disposition, chapters
`-map_chapters` index, the audio-sync re-read entry, hard incompatibility) plus
`applyLegacyShim` cases for `remux`/`rmx`. 7 new e2e cases in
`e2e/cli.spec.ts` with `generateTestJpeg`/`generateTestAudio`/
`generateTestSubtitle`/`generateTestChapters`/`readContainerMagic` fixtures.
Two behaviors worth remembering: `--audio-sync` **replaces** the primary audio
(re-read), so the output keeps one audio stream shifted by the offset
(`start_time >= 0.4` asserted), and MKV `-attach` cover art only becomes a real
`attached_pic` stream for a real JPEG (a PNG yields an `mjpeg` video stream
because the emitted `mimetype=image/jpeg` does not match) — the e2e fixture
therefore uses JPEG.

---

### Task 35 — `demux` subcommand
Status: `[x]` - 2026-09-26

**Steps**
- [x] `src/main/cli/cli-demux.ts` (new): flags `--output-dir <dir>`,
      `--video`/`--audio`/`--subtitles` (kind filters), `--all` (default),
      `--video-container <ext>` (e.g. `mkv`/`mp4`, implies re-encode of the
      video stream when the container differs from the source's native format),
      `--audio-codec <codec>` (e.g. `mp3`/`flac`/`aac`, implies re-encode of
      audio streams), `--subtitle-format <srt|ass|copy>` (text subs only;
      bitmap subs stay `copy` with a warning), `--transcoder <type>`. Probes via
      `getInfo`, builds `buildDemuxTargets` with the `DemuxMediaPreferences`,
      runs each target through the transcoder sequentially (FFToolCore-style raw
      args; `-c <kind>:<codec>` when `!target.copy`), prints each written path.
- [x] Register in `cli.ts` with alias `split`.
- [x] `e2e/cli.spec.ts` (copy + conversion paths) + unit tests for the
      media-preference → options mapping.

**Implementation notes (2026-09-26)**

`src/main/cli/cli-demux.ts` exports the pure helpers `inputStem`,
`resolveDemuxKinds`, `demuxMediaPreferences`, `selectDemuxStreams`,
`buildDemuxCliTargets` and `demuxTargetOptions`, plus the `runDemux` runner, so
the whole CLI mapping is unit-testable without a transcoder:

- Naming/extension decisions are **not** re-implemented: `buildDemuxTargets`
  (shared, used by the GUI + MCP paths) still decides `copy` vs. re-encode,
  the encoder, the container and the output extension from
  `DemuxMediaPreferences`; the CLI only selects streams and resolves output
  paths. Consequence: "native" video container is the codec's *preferred*
  container (`suggestedExtensionForStream` → `h264` → `mp4`), so
  `--video-container mp4` on an h264 source stays a stream copy while
  `--video-container mkv` re-encodes.
- `copy` (and an empty value) is treated as "no conversion" for every kind and
  is never forwarded as an encoder name.
- Cover-art video streams (`attached_pic`) are filtered out of the targets: they
  are a remux concern, and a per-kind filter must not extract them.
- Outputs land in `--output-dir` (created recursively when missing, mirroring
  the GUI/MCP behavior) and next to the input file when the flag is absent.
  `buildDemuxTargets` returns bare file names, so the CLI joins them itself.
- A kind filter that matches no stream is a usage error (exit 2), same as
  `--chapters` for a missing chapters file in `remux`; a missing input file is
  the not-found exit (4).
- Per target: `runPreparedConversion` (shared with `convert`/`remux`) with
  `{ copy, map: [target.map] }`, the `-vn`/`-an` guards for the target's kind,
  and the encoder as raw `extraArgs: ['-c:v'|' -c:a'|' -c:s', codec]` - so the
  demux paths carry no unrelated transcoder defaults. Bitmap-subtitle fallbacks
  come from the shared `demuxWarnings` and are printed as warnings.
- The bundled FFmpeg resolves the short audio names the shared builder stores
  (e.g. `-c:a mp3` → libmp3lame): verified with `ffmpeg-static` (output byte-identical
  to `-c:a libmp3lame`), so the P6 short-name follow-up needs no encoder map.

Tests: 17 unit cases in `src/main/cli/__tests__/cli-demux.test.ts` (kind
resolution, preference normalization, cover-art filtering, target naming /
output dir, audio + video re-encode, copy-when-container-matches, bitmap
subtitle warning, `ConversionOptions` per kind, and the composed FFmpeg args
asserted through `buildFfmpegArgs`) and 8 e2e cases in `e2e/cli.spec.ts`
(all-kinds extraction incl. written paths, `split` alias + default output
location, kind filters, `--audio-codec mp3` probed as `mp3`,
`--subtitle-format ass` content check, `--video-container mkv` EBML magic,
usage error for an empty kind filter, not-found for a missing input). New e2e
fixture `generateTestDemuxSource` builds a three-kind MKV.

**Checkpoint:** tests green (typecheck, lint, 181 unit files / 2517 tests,
61/61 e2e).

---

### Task 36 — CLI docs
Status: `[x]` — 2026-09-26

**Steps**
- [x] `docs/CLI.md`: subcommand-table rows (~line 47-54), per-subcommand option
      tables, and examples for `remux` (incl. `--add-subtitle`, `--add-audio`,
      `--thumbnail`, `--chapters`, `--audio-sync`, `--set-sync`) and `demux`
      (incl. `--audio-codec`, `--video-container`, `--subtitle-format`).

**Checkpoint:** none (docs).

**Note:** the bulk of the section landed with Tasks 34/35 (subcommand rows with
the `rmx`/`split` aliases, the flat-form note, quick-start examples, and the
Remux/Demux option tables). This task closed the accuracy gaps against the
implementation: added-subtitle codec precedence is now documented
(`--subtitle-codec` > per-file `::codec` > container default), the remux section
states the concrete exit codes (usage `2` for a hard container incompatibility and
an unsupported cover container, not-found `4` for a missing primary/auxiliary
file, with non-blocking findings printed as warnings), the demux section states
that `--transcoder` applies to every per-target conversion, and a `--map`/
`--no-subtitles` example was added to the quick-start block.

---

### Task 37 — CLI analytics
Status: `[x]` — 2026-09-26

**Steps**
- [x] Record `cli_remux` / `cli_demux` analytics events alongside existing CLI
      event shapes (check `src/main/cli/` for the current analytics helper).

**Checkpoint:** typecheck.

**Note:** no new event names were added. The CLI already reports the generic
`cli_invoked`/`cli_completed` events with a `subcommand` property
(`src/main/index.ts` resolves it from `CLI_SUBCOMMANDS`, which gained
`remux`/`demux` in Task 34), so invocation-level tracking needed nothing extra.
What was missing was **operation-level** tracking: the `remux`/`demux`
subcommands recorded no `remux_*`/`demux_*` events, so CLI usage was invisible
next to the GUI. Both runners now emit them through the shared facade:
- `runRemux` (`cli-remux.ts`) records `remux_started` with the plan summary right
  before the conversion, `remux_completed` (with `durationSec`) after it, and
  `remux_failed` (with the `AppError` code) in the catch branch, skipping
  `CANCELLED` - mirroring `remuxStore.startRemux`.
- `runDemux` (`cli-demux.ts`) does the same around the sequential target loop:
  one `demux_started` before the first target, `demux_completed` only when every
  target succeeded, and `demux_failed` on the first non-cancelled failure.
- Payloads come from `src/shared/analytics/analytics-summaries.ts` so the CLI and
  the GUI stores report identical numbers. That helper was corrected in the
  process: it classified added inputs by testing `map` specs for a `:s`/`:a`
  type selector, but added entries always use a bare `1:0` spec, so
  `addedSubs`/`addedAudio` were always `0`. It now classifies by file extension
  (`SUBTITLE_EXTENSIONS`/`AUDIO_EXTENSIONS`) and takes a context argument
  (`{ container, input }`) because the target container is not part of
  `ConversionOptions` and the audio-sync "re-read" entry repeats the primary
  path (excluded from `addedAudio` via `context.input`, still counted for
  `hasAudioSync`). `hasChapters` now matches the GUI store's
  `chaptersFile || copyChapters !== false` semantics. `demuxStore`'s byte-identical
  local copy of `demuxAnalyticsSummary` was deleted in favour of the shared one.
- Tests: new `src/main/cli/__tests__/cli-analytics.test.ts` (6 cases: start/
  complete payloads for both subcommands, failure code + rethrow, cancellation
  silence, and that a failing demux stops after the first target) and
  `src/shared/analytics/__tests__/analytics-summaries.test.ts` (8 cases
  covering the extension classification, re-read exclusion, dotted-directory
  paths, attachment thumbnails, chapters, and per-kind demux counts).
  `typecheck:main` + `typecheck:renderer` clean.

---

### Task 38 — Legacy flat-form shims (note)
Status: `[x]` — 2026-09-26

**Steps**
- [x] Keep `encodex in.mkv out.mp4` mapped to `convert` (unchanged); remux/demux
      are only reachable via explicit subcommands. Document in `docs/CLI.md`.

**Checkpoint:** none (docs).

**Note:** verified rather than changed. `applyLegacyShim` prepends `convert` only
when the argv names no known subcommand, and `remux`/`demux` are listed in
`CLI_SUBCOMMANDS` while `rmx`/`split` are in `CLI_ALIASES`, so
`encodex in.mkv out.mp4` still resolves to `convert` and neither new subcommand
can be shadowed by a positional file name. Covered by
`src/main/cli/__tests__/cli-cli.test.ts` ("leaves subcommand invocations
unchanged" / "leaves subcommand aliases unchanged"); the `split` alias assertion
was added by this task. Documented in `docs/CLI.md` (quick-start note under the
CLI examples).

---

## P8 — MCP tools

### Task 39 — Pure plan builders
Status: `[x]` — 2026-09-26

**Steps**
- [x] `src/mcp/operations.ts`: add `MCPRemuxFields`/`buildRemuxPlan(input,
      fields)` — `container`, `map[]`, `addSubtitle[]` (`{file, codec?,
      syncOffsetSeconds?}`), `addAudio[]` (`{file, syncOffsetSeconds?}`),
      `thumbnail` (`{file, type: 'attachment'|'disposition'}`),
      `chapters` (`{file}` or `'source'`), `audioSyncSeconds?`, `output` —
      reusing the shared `buildRemuxPlan` from Task 9. Add `MCPDemuxFields`/
      `buildDemuxPlan(input, fields)` — `outputDir`, kinds, `videoContainer`,
      `audioCodec`, `subtitleCodec` (`srt|ass`; `copy` default) →
      `DemuxTarget[]` built with the shared `DemuxMediaPreferences`. Pure +
      unit-tested like `buildExtractAudioPlan`/`buildCutPlan`.

**Checkpoint:** `npm run test:unit` green (add `src/mcp/__tests__/operations.test.ts` cases).

**Note:** both builders take an optional third `streams: MediaStreamInfo[]`
argument (the handler probes the source with `get_media_info`'s transcoder and
passes it; the CLI/GUI parity depends on it). Without it they stay pure and
leave the stream selection to FFmpeg's defaults. `buildRemuxPlan` delegates to
the shared `buildAndValidateRemuxPlan` (Task 9), so the default `-map` comes
from `buildPrimaryStreamMaps`, added-input indices, and the audio "re-read"
trick are identical across CLI/GUI/MCP. `buildDemuxPlan` delegates to the shared
`buildDemuxTargets`, and `buildDemuxJobOptions(target)` is the per-target
`ConversionOptions` composer the tool handler enqueues with. Neither builder
imports the CLI UI (no `cli-ui`/`cli-convert`), keeping the server runnable
under plain Node. Added-track ordering is subtitles → audio → thumbnail, and
`subtitleCodec` > per-file `codec` > container default mirrors the CLI's
`--subtitle-codec` precedence. Hard findings are rejected up front with
categorized errors so MCP hosts get readable codes: `INVALID_FORMAT` (no
container), `INCOMPATIBLE_CONTAINER` (stream/cover-art/chapters),
`STREAM_NOT_FOUND` (no stream of a requested kind). Tests:
`src/mcp/__tests__/operations.test.ts` grew 19 cases (33 total) covering the
default selection, container derivation, added tracks, cover-art modes,
chapters, audio sync, both rejection codes, kind filters, per-kind
re-encodes, and the job-options composer.

---

### Task 40 — Tool registration
Status: `[x]` — 2026-09-26

**Steps**
- [x] `src/mcp/server.ts`: register `remux_media` (input, container?, output?,
      map?, addSubtitle?, addAudio?, thumbnail?, chapters?, subtitleCodec?,
      audioSyncSeconds?) and `demux_media` (input, outputDir?, video?, audio?,
      subtitles?, videoContainer?, audioCodec?, subtitleCodec?). `remux_media`
      enqueues one job (copy+map+assets); `demux_media` enqueues one job per
      target via `jobManager.enqueue`.
- [x] Update the tool catalogue count in `docs/MCP.md`.

**Checkpoint:** `src/mcp/__tests__/server.test.ts` tool-list assertions updated
(~line 96-97); new tool smoke tests (incl. a `demux_media` conversion case
`audioCodec: mp3`).

**Note:** `remux_media` probes the source first (so the default selection is
every stream and container compatibility is checked before enqueueing) and
returns `{ jobId, …, container, map, warnings }`; `demux_media` creates
`outputDir` when missing and returns
`{ total, transcoder, jobs: [{ kind, streamIndex, copy, codec, output, jobId, status }], warnings }`.
`warnings` carries the non-blocking finding codes shared with the GUI/CLI.
`FakeTranscoder` gained a scriptable `streams` probe response and
`server.test.ts` a `setup(options)` seam, so 6 new server tests (remux default
selection, added tracks + cover + chapters, the three error codes, demux
`audioCodec: 'mp3'`, `outputDir` + all kinds) run against the in-memory
transport — 32 total. The stdio catalogue is now 15 core tools (21 with the 6
GUI-parity tools), so `scripts/mcp-smoke.mjs` expects 15 and requires
`remux_media`/`demux_media`; `npm run mcp:smoke` passes.

---

### Task 41 — MCP error mapping
Status: `[x]` — 2026-09-26

**Steps**
- [x] Map `STREAM_NOT_FOUND`/`INCOMPATIBLE_CONTAINER`/
      `AUXILIARY_INPUT_NOT_FOUND` through the existing `fail(status, err)`
      handling so MCP hosts get readable errors. Add integration tests in
      `src/mcp/__tests__/mcp-stdio.integration.test.ts` for both tools
      (incl. `--add-subtitle` and `--thumbnail`).

**Checkpoint:** `npm run test:unit` (incl. integration) green.

**Note:** the codes are raised by the Task 39 builders as `AppError`s, so the
existing `fail()` path reports them as `{ ok: false, code, message, detail }`
with no extra mapping layer; a new `assertMcpAuxiliaryInputsExist` helper in
`server.ts` pre-flights every added subtitle/audio/cover/chapters file with
`AUXILIARY_INPUT_NOT_FOUND` (the primary input keeps `FILE_NOT_FOUND`). The
integration suite gained hand-written `forced.srt` and FFMETADATA fixtures plus
four tests: a real mkv remux, a remux that muxes the added subtitle + cover art
+ chapters (verified by re-probing the output for a subtitle stream), a demux
that writes every extracted stream, and one asserting
`AUXILIARY_INPUT_NOT_FOUND` / `INCOMPATIBLE_CONTAINER` / `STREAM_NOT_FOUND`.
`npm run test:integration` passes (43 tests, 4 files).

---

### Task 42 — MCP docs
Status: `[x]` — 2026-09-26

**Steps**
- [x] `docs/MCP.md`: document both tools with example call/response; update tool
      count (currently "19 tools").

**Checkpoint:** none (docs).

---

## P9 — i18n

### Task 43 — All 56 locale files
Status: `[x]` - 2026-09-26

**Steps**
- [x] Add `remux.*`, `demux.*`, and `nav`/`dashboard` additions to **every**
      locale JSON under `src/renderer/i18n/locales/` (56 files) — translate
      where strings exist, else copy English values as best-effort placeholders
      so the JSON schema stays consistent (matching prior feature plans; see
      `LOCALE_VALIDATION_PLAN.md`). Tooling may auto-fill missing keys.

**Checkpoint:** `npm run validate:locales` passes.

**Implementation notes**
- `scripts/sync-locale-keys.mjs` (new, `npm run sync:locales`) fills missing
  keys from `en-US.json` without ever overwriting an existing translation, and
  inserts each new key at its base-file position among existing siblings.
  `--dry-run` and `--locale <code>` are supported.
- All 55 non-base locales were missing exactly the same 116 keys
  (`nav.remux`/`nav.demux`, `dashboard.descRemux`/`descDemux`, the full
  `remux.*` and `demux.*` namespaces, `batchQueue.operation*`/`remuxContainerHint`,
  `toast.remuxed`/`demuxed`, and the `shortcuts.*` remux/demux entries) and had
  no stray keys, so the fill was uniform.
- Values are the **English** strings as placeholders (allowed by this task).
  Translation of the 116 new keys into the 55 locales is a follow-up pass;
  re-running `npm run sync:locales` after editing a locale keeps existing
  translations intact.
- Verified: no existing key was modified or removed in any locale (only
  additions), and `npm run validate:locales` reports
  `55 locale(s) match en-US key parity`.

---

### Task 44 — i18n test-setup mocks
Status: `[x]` - 2026-09-26

**Steps**
- [x] Confirm `src/renderer/i18n/__tests__/test-setup.ts` tolerates the new
      keys (likely no change needed thanks to key-fallback).

**Checkpoint:** `npm run test:unit` green.

**Implementation notes**
- No such directory exists — the i18n-touching tests live elsewhere and mock
  `t()` by returning the key itself, so new keys need no setup changes:
  `LanguageMenu.test.tsx`, `QueueJobCard.test.tsx`,
  `constants/__tests__/shortcuts.test.ts`, `hooks/__tests__/useLanguageDirection.test.tsx`.
- Verified: those 4 files pass (71 tests).

---

## P10 — Docs & verification

### Task 45 — Feature + architecture docs
Status: `[x]` - 2026-09-26

**Steps**
- [x] `docs/FEATURES.md`: add Remux and Demux feature sections (incl. subtitle
      add, audio add, thumbnail, chapters, and A/V sync for remux; per-stream
      conversion targets for demux).
- [x] `docs/ARCHITECTURE_TRANSCODERS.md`: document multi-input `-map`/`-c:s`/
      `-map_chapters`/`-attach`/disposition support, `-itsoffset` input
      shifting and the primary re-read sync trick, and the remux/demux flows on
      each backend.
- [x] `docs/IPC.md`: note that no new IPC channels are needed (reusing
      `CONVERT_FILE` via `ConversionOptions`); document the new option fields.

**Checkpoint:** none (docs).

**Implementation notes**
- `docs/FEATURES.md`: new "Media Remuxing" and "Stream Demuxing" sections;
  batch-queue operation list, intro line, shortcut count (70 across eleven
  sections), and dashboard range (`1`–`8`) refreshed; i18n section now
  documents `validate:locales` + `sync:locales`.
- `docs/ARCHITECTURE_TRANSCODERS.md`: new "Stream Composition (Remux) &
  Extraction (Demux)" section — option surface table, input-index contract,
  5-step multi-input flag build, the primary audio re-read trick, remux and
  demux flows, and per-backend coverage.
- `docs/IPC.md`: new "Remux & Demux reuse `CONVERT_FILE`" section with the
  `ConversionOptions` field table and the `RemuxInput` index contract.


---

### Task 46 — Final verification
Status: `[x]` - 2026-09-26

**Steps**
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test:unit`
- [x] `npm run test:e2e`
- [x] Manual smoke: remux MKV→MP4 (H.264+AAC), add `.srt`→`mov_text`, add a
      second `.m4a` audio track, attach a `.jpg` thumbnail, import an FFMETADATA
      chapters file; remux with `--audio-sync 0.5` (audio now shifted against
      video) and an added track delayed via `--set-sync`/GUI delay control;
      remux to an incompatible container (expect warning); demux video+audio+subs
      (lossless copy), demux with conversions (`--audio-codec flac`,
      `--subtitle-format srt` on an `.ass` track, `--video-container mkv`);
      demux a PGS-subtitle source (expect `.mks` + warning); batch remux 3
      files; CLI and MCP variants with the same assets.

**Checkpoint:** all green.

**Implementation notes**
- `npm run typecheck` (renderer/main/preload), `lint`, `lint:strings`,
  `lint:aptabase`, `lint:unused`: 0 errors (only pre-existing warnings in
  `LanguageMenu.tsx`, `ProfileSelector.tsx`, `QueueJobCard.tsx`).
- `npm run test:unit`: 183 files / 2557 tests passed. The Task 39-era
  `src/main/__tests__/index.test.ts` timeout did not recur.
- `npm run test:e2e`: 12 files passed, 1 skipped (`real-convert`, needs a system
  ffmpeg), 142 passed / 2 skipped. Across three full runs, two showed 2–3
  renderer `Target crashed` failures that moved between specs
  (`convert.spec.ts`, then `video-cut.spec.ts`) and passed when the spec was
  re-run alone — environment flakiness under parallel Electron load on this
  machine, not a remux/demux regression.
- GUI manual smoke was executed as a **scripted CLI + MCP smoke** on generated
  assets (2s/6s `testsrc` H.264 + AAC sine source, extra `.m4a`, `.srt`,
  `.ass`, `.jpg`, FFMETADATA chapters). Verified: MKV→MP4 stream copies are
  bit-identical (per-stream MD5 match), `.srt`→`mov_text`, second audio track,
  MKV cover via `-attach` and MP4 cover via `attached_pic` disposition,
  imported chapters, `--audio-sync 0.5` (audio `start_time` 0.500 vs video
  0.023), `--set-sync 1.5` (added track at 1.477), incompatible-codec warning,
  demux copy (`*.video.mp4`, `*.audio_0.m4a`, `*.subtitle_0.ass`), demux
  conversions (`*.video.mkv`, `*.audio_0.flac`, `*.subtitle_0.srt` with the ASS
  text converted), `--audio` kind filter, 3-file remux run, and the MCP
  `remux_media`/`demux_media` equivalents (15/15 assertions, including
  `STREAM_NOT_FOUND` mapping).
- Not covered by the scripted run: the PGS/DVDSUB source case — FFmpeg cannot
  encode text→bitmap subtitles, so no such asset can be produced offline. The
  `.mks` fallback and its warning are covered by unit tests in
  `src/shared/__tests__/codec-containers.test.ts` (`buildDemuxTargets`,
  `demuxWarnings`) and the Demux store/page tests.
- GUI-only interactions (drag-and-drop, the live compatibility-warning panel,
  pause/resume from the pages) remain manual-check items; their state logic is
  unit-tested.

---

### Task 47 — Plan close
Status: `[x]` - 2026-09-26

**Steps**
- [x] Record implementation notes/deviations in the tracking header; mark all
      phases complete or skipped with rationale.

**Checkpoint:** plan reflects reality.

**Implementation notes**
- All 10 phases (P1–P10), 47 tasks, are complete; nothing was skipped.
- Two deviations to carry forward:
  1. The 116 new i18n keys ship as **English placeholders** in the 55 non-base
     locales (allowed by Task 43). `npm run sync:locales` keeps existing
     translations intact, so a translation pass needs no tooling changes.
  2. Task 46's "manual smoke" was run as a scripted CLI + MCP smoke; the
     GUI-only drag-and-drop / live-warning-panel checks are still worth a human
     pass before release.
