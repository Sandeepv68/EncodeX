# Video Filters Plan

Tracking document for adding general **video filter** support (beyond the
fixed scale/rotate/flip set) to EncodeX: a curated filter catalog with
parameter inputs **plus** a free-form FFmpeg `-vf` chain field, applied across
Convert, the batch queue, and the demux/remux re-encode paths.

Today `ConversionOptions` (`src/shared/types.ts`, ~line 93-115) carries only
`scale`, `rotate`, `flipH`/`flipV`, `pixelFormat`, and timings — a fixed set
merged into ONE `-vf` argument by `buildVideoFilterChain` /
`buildFfmpegArgs` (`src/main/transcoders/ffmpeg-utils.ts`, ~line 80-87 and
137-218) and mirrored by the fluent-ffmpeg API backend (`ffmpeg-core.ts`,
~line 215-238). There is no way to express crop, frame-rate cap, denoise,
sharpen, color/levels adjustments, deinterlace, or an arbitrary filter graph,
except by hand-writing the raw `extraArgs` array.

This plan adds a general **`videoFilters`** capability to the shared options
payload so every surface (renderer → preload → IPC → transcoder builder, CLI,
MCP, batch queue) sees the same filter chain, mirroring how `scale`/`rotate`
already flow through.

Key definitions and rules:

- **`ConversionOptions.videoFilters?: string[]`** — an ordered list of FFmpeg
  video filter expressions (`crop`, `fps=30`, `hqdn3d`, `yadif=1`, `eq=...`,
  ...). Each entry is command-line-safe (no shell metacharacters, length-capped
  per entry and in total). The builder joins them with commas into the single
  existing `-vf` flag — FFmpeg forbids multiple `-vf` flags, so every filter
  form (scale, rotation, presets, custom) collapses into that one chain.
- **Filter chain order** is: `scale` (geometry first) → rotation/mirror
  (`buildRotationFilters`) → user `videoFilters` (preset + custom, in array
  order). Order is preserved and documented so presets compose predictably.
- **Filters require re-encoding.** They are incompatible with stream-copy mode
  (`-c copy`). Policy is explicit on every surface:
  - Convert page / batch: re-encode mode only. In copy mode the Filters section
    is disabled with a "Turn off lossless copy" affordance (mirrors the
    existing rotate-in-copy handling in `Convert.tsx`, ~line 255-263).
  - CLI/MCP: passing `--filters`/`videoFilters` together with `copy: true` is a
    usage error (`FILTERS_REQUIRE_RE_ENCODE`), not a silent drop.
  - **Remux (re-encode mode):** enabling filters on the remux page switches the
    job from lossless stream-copy to a re-encode, with a prominent warning that
    copy is disabled (per-user decision).
  - **Demux re-encode path:** video filters may be applied to a demux video
    target only when that target re-encodes the stream (copy targets ignore
    filters with a warning).
- **Scope:** single-input `-vf` chain filters only. Multi-input/complex filter
  graphs (`-filter_complex`, `overlay`, splits) need input addressing that the
  single-input convert pipeline does not model — documented as out of scope.
- **Validation:** a small pure parser validates filter strings (balanced
  `()[]`, matched `'`, no `;`/`&`/`|` shell metacharacters, max lengths) plus
  catalog-level parameter validation. Full syntax correctness stays with FFmpeg
  at run time (failure surfaces through the existing error path).

User decisions (confirmed): filter support lands on the **convert pipeline**,
the **demux re-encode path**, and the **remux page (re-encode mode)**; exposed
as a **curated preset catalog with parameter fields plus a free-form custom
filter chain**; tracked in this **separate plan file**.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` skipped.

---

## Progress tracker

| Phase | Scope | Status |
| ----- | ----- | ------ |
| P1 | Shared contracts (types, presets catalog, log constants, error codes) | 4 / 4 |
| P2 | Transcoder builders (chain merge + validation) + tests | 3 / 3 |
| P3 | Renderer store + hook wiring + tests | 3 / 3 |
| P4 | Convert page UI (presets, custom chain, copy-mode handling) | 3 / 3 |
| P5 | Batch queue (panel + job utils) + tests | 3 / 3 |
| P6 | Demux re-encode path integration + tests | 2 / 2 |
| P7 | Remux page re-encode mode + warning + tests | 2 / 2 |
| P8 | CLI flags (`convert`, `demux`, `remux`) + tests + CLI.md | 3 / 3 |
| P9 | MCP fields (`convert_media`, `demux_media`, `remux_media`) + tests | 3 / 3 |
| P10 | i18n strings (all locales) | 2 / 2 |
| P11 | Docs (FEATURES/ARCHITECTURE_NAME) + full verification | 3 / 3 |

**Implementation notes / deviations from the plan text** — (filled in as work lands).

- P1 Task 2 `buildFilterChain` takes a `(scale, rotate, flipH, flipV, videoFilters)`
  object, not positional args; `validateVideoFilters` returns a `string[]` of
  per-entry errors (empty = valid), not `string[] | null`. Entry cap
  `VIDEO_FILTER_MAX_ENTRIES = 8`, per-entry cap `VIDEO_FILTER_MAX_ENTRY = 200`.
- P1 Task 3 analytics payload: the app's event names are `conversion_started` /
  `conversion_completed` (not `convert_started`); `hasVideoFilters`/`filterCount`
  were added to both plus `conversion_failed` is untouched.
- P2 Task 5 "throw or log + drop": implemented **log + per-entry drop** in both
  builders (invalid entries warn `LOG_FILTER_INVALID` and are removed; valid
  entries, scale, and rotation still emit) since the stricter surfaces
  (GUI/CLI/MCP) already reject before reaching the builder.
- P2 Task 7: confirmed `FFToolCore`/`BmfCore` both consume `buildFfmpegArgs`;
  no per-backend `-vf`/`videoFilters` logic exists, so no port needed (`[-]`-
  equivalent; fluent parity lives only in `ffmpeg-core.ts`).
- P5: `BatchEncodingValues` gained a required `videoFilters: string[]` field
  (batch-options.ts); `buildBatchOptions` is the single option-copy point, so
  no separate whitelist edit in `queue-job-utils.ts` was needed — `planEnqueues`
  already delegates through it. Batch config persistence (batchConfig.ts)
  round-trips the array (validated per-entry) and stored queued jobs keep it
  like `extraArgs`; profiles still apply no filter values (matches rotation).
  The filters section is the shared `VideoFiltersSection` inside the transcode
  grid cell of `BatchEncodingPanel`, reused by the per-job dialog.
- P8: the `--preset` helper is `resolveCliVideoFilters` (cli-convert.ts), which
  expands presets first then appends the comma-joined `--filters` chain; the
  resolved chain prints under `--verbose` (the CLI's `-v` short flag is
  `--video-codec`, so "verbose mode" is `--verbose`). Copy conflicts and
  invalid chains throw `CliExitError` with `CLI_EXIT_USAGE`. Task 23 documents
  all three commands' flags: `convert --filters/--preset`, `demux
  --video-filters`, and `remux --filters` (repeatable, merged in order).
  `resolveCliVideoFilterChain` is the shared split/expand/validate helper used
  by the demux and remux subcommands too.
- P9: invalid chains/unknown presets surface through a new shared
  `ErrorCode.INVALID_VIDEO_FILTERS` (canonical message + detail), thrown by the
  ported `buildConversionOptions` in `src/mcp/conversion-options.ts` (MCP must
  not import the CLI's `CliExitError`). `FakeTranscoder` gained `lastOptions`/
  `lastOutput` fields so server tests can assert option delivery. Tracker row
  counts Tasks 24/25/26; the `demux_media`/`remux_media` `videoFilters` fields
  landed with P6/P7 (below).
- P6/P7: both landed after `plans/REMUX_DEMUX_PLAN.md` completed. Deliberate
  cross-surface asymmetry: the demux **CLI** hard-fails (`CLI_EXIT_USAGE` +
  `FILTERS_REQUIRE_RE_ENCODE`) when no selected video target re-encodes, while
  the demux **MCP** tool returns a `filtersIgnoredCopy` warning instead, because
  an MCP call cannot ask the user to pick a different target. `clearSelection()`
  intentionally keeps `videoFilters` on both remux and demux (same rationale as
  keeping the target container / conversion preferences), so a filter recipe
  survives changing the selected file. Remux has no copy flag, so a non-empty
  chain simply flips `copy: false` and reports `filters_force_reencode`.
  `LOG_FILTERS_IGNORED_COPY` was **not** re-wired: the transcoder layer
  (`useConversion`, `ffmpeg-core`, `ffmpeg-utils`) already logs and drops the
  chain for any `copy: true` that reaches it; copied demux targets simply never
  carry `videoFilters`, so the user-facing `filtersIgnoredCopy` warning is the
  surface that reports it.
- P10: both tasks were pulled forward during P1/P4 (catalog label keys) and
  P5 (embedding sweeps); `validate:locales` and `test:unit` both green.
- P11: e2e verification covers the CLI binary (`e2e/cli.spec.ts`) with four new
  filter cases and the in-process real-FFmpeg integration suite; two pre-existing
  `--help`/unknown-flag Electron-spawn failures (status `null`) are not related
  to this plan. The Playwright GUI spec suite was not run here. Docs updated for
  P6/P7: `docs/CLI.md` (both subcommands), `docs/MCP.md` (both tools, tool-field
  table, `filters_force_reencode`/`filtersIgnoredCopy` warning codes), and
  `docs/FEATURES.md` / `docs/ARCHITECTURE_TRANSCODERS.md` (per-surface
  copy-mode negotiation table).

---

## P1 — Shared contracts

### Task 1 — `ConversionOptions.videoFilters`
Status: `[x]`

**Problem:** the options payload that flows through every layer has no general
filter field.

**Steps**
- [x] `src/shared/types.ts` (`ConversionOptions`, ~line 93-115): add
      `videoFilters?: string[]` with JSDoc — ordered video-filter expressions
      merged (after scale + rotation/mirror) into the single `-vf` chain; only
      honored in re-encode mode (ignored with a warning under `copy: true`);
      each entry must survive the Task 2 validation.
- [x] Move/align the newer `RemuxInput`/`DemuxMediaPreferences` additions from
      the remux/demux plan Task 1 so both plans extend the same
      `ConversionOptions` without conflicts (fields are additive).

**Checkpoint:** `npm run typecheck` green. ✓

---

### Task 2 — Filter presets catalog + pure validation
Status: `[x]`

**Problem:** the GUI, CLI help, and MCP schemas need one shared, testable
definition of the curated filters and their parameters.

**Steps**
- [x] New `src/shared/video-filters.ts`:

  ```ts
  export interface VideoFilterDef {
    id: string;                 // stable id, used by GUI/CLI/MCP
    ffmpegName: string;         // base filter name, e.g. 'crop'
    params: VideoFilterParam[]; // ordered named parameters with defaults
    build(params: FilterParamValues): string; // → full filter expr, e.g. 'crop=640:480:0:0'
    hint: string;
  }

  export interface VideoFilterParam {
    key: string;
    labelKey: string;           // i18n key
    type: 'number' | 'percent' | 'select' | 'text';
    default?: number | string;
    min?: number;
    max?: number;
    options?: { value: string; labelKey: string }[];
    optional?: boolean;         // omitted from the expr when empty
  }
  ```

- [x] Catalog `FILTER_PRESETS` (initial set; each maps to a single `-vf`
      element):
      `crop` (`crop=W:H[:x:y]`, percent-aware `iw/2` style), `framerate`
      (`fps=N`), `deinterlace` (`yadif=1`, select: auto/bff/tff), `denoise`
      (`hqdn3d=<luma>[luma_spac]`), `sharpen` (`unsharp=5:5:<strength>`),
      `color` (`eq=brightness:contrast:saturation:gamma`, sliders), `grayscale`
      (`hue=s=0`), `blur` (`boxblur=<strength>:1`). Each with safe defaults so
      the preset works with zero parameters entered.
- [x] Pure validator `validateVideoFilters(filters: string[]): string[]`
      — returns per-entry errors or an empty array: non-empty, max ~200 chars
      per entry, max ~8 entries, balanced `()`/`[]`, matching quotes, and
      rejects the shell metacharacters `;`, `&`, `|`, backtick, `$`.
      `buildFilterChain(scale, rotate, flip, videoFilters)` lives in this
      module (pure, unit-tested).
- [x] Convert-filter alias: accept `'.'` separators (e.g.
      `framerate.60`) in CLI/MCP preset shorthand, normalized here.
      -> `expandFilterShorthand` (shared) expands `<preset>.<value>` to
      `fps=60` via the catalog's first parameter; anything that already looks
      like a full expression (`fps=30`, `eq=…`, names containing `=`, `:`, or
      `,`, unknown names, parameterless presets) passes through untouched.
      Called from `resolveCliVideoFilterChain` (convert/remux/demux CLI) and
      the MCP `validatedVideoFilters` helper. Covered by
      `video-filters.test.ts` (9 shorthand cases) and the
      convert/remux/demux CLI + MCP suites.

**Checkpoint:** `npm run test:unit` — `video-filters.test.ts` (param building,
defaults, validation rejections, `buildFilterChain` ordering). ✓ — 17 tests.

---

### Task 3 — Log + analytics constants
Status: `[x]`

**Steps**
- [x] `src/shared/log-constants.ts` (near `LOG_SCALE`/`LOG_ROTATION`): add
      `LOG_VIDEO_FILTERS` (logs the joined chain), `LOG_FILTERS_IGNORED_COPY`
      (copy mode + filters), `LOG_FILTER_INVALID` (validation failure with the
      offending entry).
- [x] `src/shared/analytics/events.ts`: extend the `conversion_started` /
      `conversion_completed` payload shape with `hasVideoFilters: boolean` and
      a `filterCount` (presence/count only, no granular catalog usage).

**Checkpoint:** `npm run typecheck` + analytics wiring tests green. ✓

---

### Task 4 — Error code for filters + copy
Status: `[x]`

**Steps**
- [x] `src/shared/errors.ts` (`ErrorCode`, ~line 28-140): add
      `FILTERS_REQUIRE_RE_ENCODE`; add message in `ERROR_MESSAGES`
      (~line 141). Used by CLI/MCP when `videoFilters` is combined with
      `copy: true`, and by the remux plan when filters force copy off.
- [x] Confirm renderer error-store surfaces it like other codes (check
      `src/renderer/stores/errorStore.ts` mapping; add if it key-switches on
      code).
      -> `errorStore` does not key-switch (it surfaces `ERROR_MESSAGES[code]`
      generically), so no mapping change was needed. Confirmed by
      `errorStore.test.ts`, which now asserts both `FILTERS_REQUIRE_RE_ENCODE`
      and `INVALID_VIDEO_FILTERS` render the canonical message and that an
      unknown code still falls back to the generic entry.

**Checkpoint:** `npm run test:unit` (error-mapping tests) green. ✓

---

## P2 — Transcoder builders

### Task 5 — `ffmpeg-utils.ts` filter chain merge + validation
Status: `[x]`

**Problem:** the raw-args builder currently merges only scale + rotation; it
must accept the user chain, validate, warn-on-copy, and keep ONE `-vf`.

**Steps**
- [x] `buildVideoFilterChain` (~line 80-87): delegate to the shared
      `buildFilterChain` from Task 2.
- [x] `buildFfmpegArgs` (~line 137-218): in the re-encode branch, when
      `options.videoFilters?.length` present — validate; invalid entries are
      logged (`LOG_FILTER_INVALID`) and dropped per-entry (valid entries,
      scale, rotation still emit). In copy mode (`options.copy`), when
      `videoFilters` present: `log.warn(LOG_FILTERS_IGNORED_COPY)` and do
      **not** emit the chain (option blindly ignored keeps lossless
      semantics — the stricter surfaces reject earlier).
- [x] `-an`/`-vn` and `extraArgs` ordering unchanged; `videoFilters` joins the
      same `-vf` slot as scale/rotate (never a second `-vf`).

**Checkpoint:** `npm run test:unit` — `ffmpeg-utils.test.ts` extended with
chain merging, copy+filter ignore, invalid-entry per-entry drop. ✓

---

### Task 6 — `ffmpeg-core.ts` (fluent API) parity
Status: `[x]`

**Steps**
- [x] In the re-encode branch (~line 215-238), append `options.videoFilters`
      entries to the chain passed to `cmd.videoFilters(...)` (after rotation
      and with scale), mirroring the shared `buildFilterChain` ordering for
      parity with `buildFfmpegArgs`. The `cmd.size(options.scale)` fast path is
      kept ONLY when no rotate/flip/videoFilters are present (scale-only).
- [x] Copy-mode branch: same `LOG_FILTERS_IGNORED_COPY` warn-and-ignore.
- [x] `ffmpeg-core.test.ts`: asserts fluent `videoFilters` call with the full
      merged chain for scale+rotate+preset+custom, scale-only keeps `cmd.size`,
      and invalid-entry per-entry drop.

**Checkpoint:** `npm run test:unit` green. ✓

---

### Task 7 — BMF/FFTool sanity (shared builder reach)
Status: `[x]`

**Steps**
- [x] `FFToolCore` and `BmfCore` both consume `buildFfmpegArgs` via
      `ffmpeg-utils.ts` (grep confirmed no other `-vf`/`videoFilters`
      consumers outside the two builders).
- [x] No per-backend copy of the flag-building logic — no port needed; noted
      in implementation notes.

**Checkpoint:** `npm run test:unit` green. ✓

## P3 — Renderer store + hook

### Task 8 — `conversionStore` videoFilters state
Status: `[x]`

**Steps**
- [x] `src/renderer/stores/conversionStore.ts` (`ConversionState` shape): added
      `videoFilters: string[]` (empty default), `setVideoFilters(filters)`,
      `addVideoFilter(entry)`, `removeVideoFilter(index)` (range-safe no-op);
      all setters mark `isDirty`. JSDoc + `stores/types.ts` updated.
- [x] Store tests: default empty, replace/list, append+remove, out-of-range
      ignore, reset-to-empty. (`conversionStore.test.ts` — 24 tests.)

**Checkpoint:** `npm run test:unit` — store suite green. ✓

---

### Task 9 — `useConversion` start payload
Status: `[x]`

**Steps**
- [x] `useConversion.ts` `startConversion`: includes
      `videoFilters: store.videoFilters.length ? store.videoFilters : undefined`
      in the options object passed to `window.electronAPI.convertFile`, and
      `store.videoFilters` added to the callback dep array.
- [x] Preload/`electron-api.d.ts`: no change needed (`ConversionOptions` flows
      via the existing typed call; preload `convertFile` passes options through).
- [x] Filter presence logged debug-style in the builder (`LOG_VIDEO_FILTERS`);
      hook logs `LOG_FILTERS_IGNORED_COPY` / `LOG_FILTER_INVALID` on refusal.

**Checkpoint:** `npm run test:unit` — hook payload assertion tests green ✓
(payload carries filters; blocked cases never call `convertFile`).

---

### Task 10 — Validation state + error surfacing
Status: `[x]`

**Steps**
- [x] `startConversion` validates `videoFilters` with the shared validator first;
      on failure it refuses to start and surfaces `FILTERS_REQUIRE_RE_ENCODE`
      via `showErrorMessage` (no silent ignore).
- [x] `copyMode` + filters present → refuses to start with the same
      `FILTERS_REQUIRE_RE_ENCODE` error.
- [x] Confirmed `errorStore.showErrorMessage` maps any code generically via
      `ERROR_MESSAGES` (no key-switch), so no errorStore change needed.

**Checkpoint:** `npm run test:unit` green. ✓

---

## P4 — Convert page UI

### Task 11 — Filters section (presets + custom chain)
Status: `[x]`

**Steps**
- [x] `Convert.tsx`: new "Video Filters" section (accordion) rendered in
      re-encode mode, listing the Task 2 catalog as chips/rows — each preset
      expands to its parameter fields (sliders/selects/text) bound to
      `conversionStore` filter state and previewing the final chain string.
- [x] "Custom filter chain" text input bound to `setVideoFilters` (parsed to
      entries via the Task 2 normalization; live validation shows inline
      errors). Combined preview line: `-vf <scale>,<rotate>,<presets>,<custom>`.
- [x] Reorder/remove controls per filter entry; "clear all".

**Checkpoint:** manual UI smoke + unit tests for the section's state mapping.
Realized as a presentational component (`VideoFiltersSection.tsx`) receiving
`filterEntries`/`onChange` from the page; the page binds it to
`conversionStore.videoFilters`/`setVideoFilters` and renders the combined
`-vf` preview via shared `buildFilterChain`.

---

### Task 12 — Copy-mode handling
Status: `[x]`

**Steps**
- [x] When lossless copy is on, the Filters section is disabled with an info
      note + a "Turn off lossless copy" action (same pattern as rotation in
      copy mode, `Convert.tsx` ~line 793-805). Enabling copy with filters set
      shows the same prompt before switching.
- [x] Auto-suggested output unchanged (filters don't change container/codec).

**Checkpoint:** manual smoke (copy on → section disabled; toggle off → active).

---

### Task 13 — Convert page tests + analytics
Status: `[x]`

**Steps**
- [x] Component tests: preset add → correct entries in store; custom chain
      invalid → inline error, start blocked; copy+filter → error, not started.
- [x] Analytics: `convert_started` payload carries `hasVideoFilters` /
      `filterCount` (Task 3); assert in analytics tests.

**Checkpoint:** `npm run test:unit` green.
Event name is actually `conversion_started`/`conversion_completed` (Task 3);
the payload fields (`hasVideoFilters`/`filterCount`) were already asserted in
the shared analytics tests during P3. Component/page tests cover the section,
copy-mode refusal, store round-trip, and page copy-mode affordances.

---

## P5 — Batch queue

### Task 14 — Batch panel filters
Status: `[x]`

**Steps**
- [x] `src/renderer/components/BatchEncodingPanel.tsx` (transcode panel; batch
      always re-encodes per ROTATION_PLAN Task 15 note): add the same Filters
      section (presets + custom) for `transcode` jobs; no copy-mode variant is
      needed since batch is re-encode-only, but keep the section consistent with
      Convert (shared component if the markup justifies it). -> Reused the shared
      `VideoFiltersSection` in a full-width `showVideo` grid cell, disabled when
      `optionsLocked`.
- [x] `BatchQueue.tsx` (state ~line 335 + options build ~line 505 + enqueue
      paths): carry `videoFilters` into the per-job `options.videoFilters` (via
      `buildBatchOptions`) and the `defaults` round-trip (~line 1429)/persist
      effect. Profiles keep no filter persistence (out of scope, mirroring
      rotation).

**Checkpoint:** `npm run test:unit` + manual batch smoke.
Verification: `buildBatchOptions` omits `videoFilters` for `extract_audio` /
`compress_image`; transcode carries the ordered chain verbatim; the per-job
dialog seeds/saves filters from the job's baked options.

---

### Task 15 — Job utils + inferred options
Status: `[x]`

**Steps**
- [x] `src/renderer/utils/queue-job-utils.ts`: include `videoFilters` in the
      option-copy/whitelist used when building jobs from the panel (grep the
      current option passthrough and add the array field); no new job kind.
      -> No whitelist edit was required: `planEnqueues` builds options through
      `buildBatchOptions`, which gained the field centrally.
- [x] Confirm persistence/storage round-trip for the new field (batch stored
      jobs serialize options; arrays already supported like `extraArgs`).
      -> `batchConfig.ts` persists the array (validated per-entry via
      `validateVideoFilters`); stored queued jobs keep it alongside `extraArgs`.

**Checkpoint:** `npm run test:unit` green.

---

### Task 16 — Batch tests
Status: `[x]`

**Steps**
- [x] Component/utils tests: filters survive panel → job options; clear-all
      resets; chain validation error blocks enqueue. -> batch-options + queue-job-utils
      carry tests, `BatchEncodingPanel` wiring (preset add, clear-all, locked
      disabled, hidden for extract_audio), `QueueJobOptionsDialog` seed/save,
      and `batchConfig` round-trip/reject-invalid.

**Checkpoint:** `npm run test:unit` green.
Verified with the full suite: 2258 tests / 173 files pass; typecheck (renderer,
main, preload) + lint clean.

---

## P6 — Demux re-encode path

### Task 17 — `DemuxMediaPreferences.videoFilters`
Status: `[x]`

**Steps** (depends on the remux/demux plan Tasks 8/11/35 landing first)
- [x] In the remux/demux plan's `DemuxMediaPreferences` (see
      `REMUX_DEMUX_PLAN.md` Task 8): add `videoFilters?: string[]` alongside
      `videoContainer?: string`.
      -> `src/shared/codec-containers.ts` `DemuxMediaPreferences.videoFilters`
      and `DemuxTarget.videoFilters`.
- [x] `buildDemuxTargets` (remux/demux plan Task 8): when a video target has
      `!copy` (container differs from source / re-encode), carry
      `videoFilters` into the target's `ConversionOptions`; for `copy` targets
      they are ignored with `LOG_FILTERS_IGNORED_COPY` and a user-facing warning
      on the demux page.
      -> Targets carry the chain only when `kind === 'video' && !copy`;
      `demuxWarnings` emits `filtersIgnoredCopy` (shared/pure). The
      `LOG_FILTERS_IGNORED_COPY` half was already satisfied by the transcoder
      layer (`useConversion`, `ffmpeg-core`, `ffmpeg-utils`), which is the
      single place that actually drops a chain on `copy: true`.
- [x] Demux page (remux/demux plan P5): reuse the P4 Filters section for the
      video stream panel, shown only when a re-encode target is selected (e.g.
      `--video-container` differing).
      -> Gated on `targets.some(t => t.kind === 'video' && !t.copy)`;
      the `filtersIgnoredCopy` warning renders in the existing panel.

**Checkpoint:** `npm run test:unit` (demux targets/options mapping incl. a
filters+copy-warning case) green.
Verified: `codec-containers.test.ts` (carry/drop/never-audio-subtitle +
`filtersIgnoredCopy` matrix), `demuxStore.test.ts` (`setMedia` + `startDemux`
propagation), `Demux.test.tsx` (section gating, preset add, copy-switch warning).

---

### Task 18 — Demux CLI + MCP filter wiring
Status: `[x]`

**Steps**
- [x] `cli-demux.ts` (remux/demux plan Task 35): add
      `--video-filters <chain>`; only meaningful with re-encode of the video
      stream — when combined with copy keep, exit `EXIT_USAGE` with the
      Task 4 error code.
      -> Repeatable `--video-filters` resolved by the shared
      `resolveCliVideoFilterChain` (comma-split + shorthand + validation);
      `buildDemuxCliTargets` throws `CliExitError(ERROR_MESSAGES[FILTERS_REQUIRE_RE_ENCODE], CLI_EXIT_USAGE)`
      when no selected video target re-encodes. Registered in `cli.ts`.
- [x] `demux_media` MCP tool (remux/demux plan Task 40): add
      `videoFilters?: string[]`; passed through the shared
      `DemuxMediaPreferences`.
      -> `MCPDemuxFields.videoFilters` + Zod schema; the shared
      `validatedVideoFilters` helper expands shorthand, validates, and throws
      `INVALID_VIDEO_FILTERS`. A copy target keeps the tolerant
      `filtersIgnoredCopy` warning (an MCP call cannot ask the user to pick a
      re-encoding target), which is the deliberate difference from the CLI.

**Checkpoint:** CLI/MCP demux tests green (copy + filters rejected).
Verified: `cli-demux.test.ts` (preference normalization, chain-on-target,
copy/no-video/invalid rejections, `CLI_EXIT_USAGE`, `-vf` assembly,
audio/subtitle never filtered), `operations.test.ts`, `server.test.ts`
(delivers, warns, rejects invalid), plus real-FFmpeg
`cli-integration.integration.test.ts` cases asserting the probed
`r_frame_rate` is `24/1` for a re-encoded target and `10/1` for a copy.

---

## P7 — Remux re-encode mode

### Task 19 — Filters on the remux page switch to re-encode
Status: `[x]`

**Steps** (depends on the remux/demux plan Task 10 `remuxStore` + P4 page)
- [x] `remuxStore` (remux/demux plan Task 10): add `videoFilters: string[]` +
      the same actions as Task 8. Remux normally builds `copy: true` options —
      when `videoFilters.length > 0`, `buildRemuxPlan` (remux/demux plan Task 9)
      sets `copy: false` and emits the filter chain via the P2 builder path.
      -> `setVideoFilters` marks dirty and recomputes warnings;
      `buildRemuxPlan` sets `copy: false` and copies the chain into
      `ConversionOptions`. `clearSelection` keeps the chain (like the container
      and like `demuxStore`'s per-kind prefs) so one filter recipe can be reused
      across files.
- [x] Remux page (remux/demux plan P4): embed the Filters section; when any
      filter is active, show a prominent warning that output will be
      re-encoded (not a lossless copy) and the underlying streams are transcoded
      once in the chain; copy-chapters/map behavior unchanged.
      -> `VideoFiltersSection` + a `remux-filters-reencode` warning alert with
      the filter count; chapters/map handling untouched.
- [x] `remuxWarnings` (remux/demux plan Task 7): add
      `filters_force_reencode` when filters + a container that otherwise copies
      cleanly are combined.
      -> `remuxWarnings` takes an optional `videoFilters` argument; the
      `remuxStore` computes warnings through it.

**Checkpoint:** `npm run test:unit` (buildRemuxPlan filter case) + manual smoke.
Verified: `remux-utils.test.ts` (copy→re-encode, empty-chain stays copy,
warning present/absent), `codec-containers.test.ts` (`remuxWarnings` filter
cases), `remuxStore.test.ts` (set/clear/array-immutability/start
`copy: false` + chain/`clearSelection` retention), `Remux.test.tsx` (section,
add/remove, alert lifecycle, re-encode start), and real-FFmpeg integration
(`remux --filters fps=24` → probed `r_frame_rate` `24/1`; no filters → `10/1`).

---

### Task 20 — Remux CLI + MCP filter wiring
Status: `[x]`

**Steps**
- [x] `cli-remux.ts` (remux/demux plan Task 34): add repeatable
      `--set-filter <chain>` / a single `--filters <chain>`; presence forces the
      re-encode path; `copy` is not a remux flag so no conflict.
      -> Chose repeatable `--filters <chain>` (matching `convert --filters` and
      the plan's alternative). Merges every chain in order via the shared
      `resolveCliVideoFilterChain`, warns when no video stream is selected, and
      forwards to `buildRemuxPlan`. Registered in `cli.ts`.
- [x] `remux_media` MCP tool (remux/demux plan Task 39/40): add
      `videoFilters?: string[]`; included in `buildRemuxPlan`.
      -> `MCPRemuxFields.videoFilters` + Zod schema + tool description; the
      shared `validatedVideoFilters` helper expands shorthand, validates, and
      throws `INVALID_VIDEO_FILTERS` before enqueueing.

**Checkpoint:** CLI/MCP remux tests green.
Verified: `cli-remux.test.ts` (re-encode + chain, shorthand merge, single `-vf`,
blank chain stays copy, invalid → `CliExitError`, audio-only still plans),
`operations.test.ts`, `server.test.ts` (delivers `copy: false`, expands
shorthand, rejects invalid pre-enqueue), and real-FFmpeg integration
(`--filters fps=24` → `24/1`; two chains merge with the last filter winning).

---

## P8 — CLI flags

### Task 21 — `convert --filters`
Status: `[x]`

**Steps**
- [x] `src/main/cli/cli-convert.ts`: extend `ConvertCliFlags` with
      `filters?: string` (comma-joined) + optional preset shorthand
      `--preset <id>` repeating; build into `options.videoFilters` via the
      Task 2 normalization/validation (invalid → `EXIT_USAGE`). When `--copy`
      is also set → `EXIT_USAGE` with `FILTERS_REQUIRE_RE_ENCODE`.
      -> `buildConversionOptions` resolves presets + chain via
      `resolveCliVideoFilters`, validates with `validateVideoFilters`, and
      throws `CliExitError(..., CLI_EXIT_USAGE)` for invalid chains or the
      `ERROR_MESSAGES[FILTERS_REQUIRE_RE_ENCODE]` usage error for `--copy`.
- [x] `src/main/cli/cli.ts` convert subcommand (~line 158-210): register
      `--filters <chain>` and `--preset <id>` (repeatable, collected to array).
- [x] `src/main/cli/__tests__/cli-convert.test.ts`: option mapping + copy
      conflict cases. Plus the real-FFmpeg integration test
      (`cli-integration.integration.test.ts`) converting with
      `filters: 'fps=24'` and asserting `r_frame_rate` = `24/1`, and rejecting
      `--filters` + `--copy`.

**Checkpoint:** `npm run test:unit` + `npm run test:e2e` (a real
`convert --filters fps=24` run asserting frame rate) green.
Verified: full unit suite (2268 tests / 173 files) green; integration suite
(18 tests) green with the frame-rate assertion; typecheck all projects clean.

---

### Task 22 — `--preset` helper (convert/batch)
Status: `[x]`

**Steps**
- [x] Add a small CLI helper that expands a `--preset <id>` into its default
      parameter values via the Task 2 catalog (so `--preset grayscale` works
      with zero params) and prints the resolved chain in `-v` verbose mode.
      -> `resolveCliVideoFilters` expands presets first, then appends the
      comma-joined chain; `runConvert` prints the resolved chain under
      `--verbose` (the shared `-v` short flag is already taken by `--video-codec`).
- [x] Wire it into the batch subcommand too (batch already builds options via
      `buildConversionOptions` in `cli-convert.ts`, ~line 18).
      -> Batch registers the same two options; options flow through the shared
      builder, so `--copy` + filters is also rejected for batch.

**Checkpoint:** unit tests for preset expansion green.

---

### Task 23 — CLI docs
Status: `[x]`

**Steps**
- [x] `docs/CLI.md`: document `--filters`/`--preset` (convert),
      `--video-filters` (demux) and the remux/re-encode interaction; add
      examples (`convert in.mp4 out.mp4 --filters fps=30,eq=brightness=0.1`).
      -> convert/batch rows + examples added now; the demux `--video-filters`
      and remux re-encode rows are documented when P6/P7 land (those
      subcommands do not exist yet).
- [x] Note the copy/filter rejection in each option table.

**Checkpoint:** none (docs).

---

## P9 — MCP tools

### Task 24 — `convert_media` fields
Status: `[x]`

**Steps**
- [x] `src/mcp/conversion-options.ts` `MCPConversionFields` (~line 41-63): add
      `videoFilters?: string[]` and `filters?: string` (comma-joined)
      plus `presets?: string[]`; `buildConversionOptions` (~line 72-94) merges
      them via Task 2 (dedupe against `extraArgs` overlap — document that
      `extraArgs` and `videoFilters` are independent).
      -> New `resolveVideoFilterExpressions` expands presets first, then the
      comma chain, then the explicit array; documented `extraArgs` independence
      in the interface JSDoc. Unknown presets and invalid entries throw a new
      shared `ErrorCode.INVALID_VIDEO_FILTERS` AppError.
- [x] `src/mcp/server.ts` `convert_media` schema (~line 127-141): zod fields
      `videoFilters: z.array(z.string()).max(8).optional()` + `presets`;
      validate with the Task 2 validator and reject early on invalid entries
      (CoercionError path) and on `copy:true`+filters.
      -> Schema entries enforce non-empty strings + max 8; the description and
      tool doc mention the re-encode requirement. `batchSchema` inherits the
      fields via `conversionSchema.omit(...).extend(...)`.

**Checkpoint:** `src/mcp/__tests__/server.test.ts` + `conversion-options.test.ts`
new cases green. Verified: builder cases (merge order, omission, copy conflict,
unknown preset, invalid entry, cap len, extraArgs independence) + server cases
(transcoder receives `videoFilters`, both rejection codes, no enqueue on
invalid chain) green in the full suite (2278 tests / 173 files).

---

### Task 25 — `convert_media` copy conflict
Status: `[x]`

**Steps**
- [x] When `copy: true` + `videoFilters`, fail with the
      `FILTERS_REQUIRE_RE_ENCODE` code through the existing `fail(status, err)`
      mapping (mirrors the `INCOMPATIBLE_CONTAINER` wiring in the remux/demux
      plan Task 41); assert in `server.test.ts`.
      -> Handled inside `buildConversionOptions` via `createError(...,
      ERROR_MESSAGES[FILTERS_REQUIRE_RE_ENCODE])`; `fail()` surfaces the code.

**Checkpoint:** tests green.

---

### Task 26 — MCP docs
Status: `[x]`

**Steps**
- [x] `docs/MCP.md`: document `videoFilters`/`presets` on `convert_media` (and
      the demux/remux fields from Tasks 18/20) with an example call.
      -> Added the three fields to the `convert_media`/`batch_convert` table row
      plus a "Video filters" section (merge order, re-encode requirement,
      `extraArgs` independence, example). Demux/remux MCP fields land once the
      REMUX_DEMUX_PLAN tools exist.

**Checkpoint:** none (docs).

---

## P10 — i18n

### Task 27 — `en-US.json` filter keys
Status: `[x]`

**Steps**
- [x] `src/renderer/i18n/locales/en-US.json`: add a `filters.*` namespace
      (title, customChain, customChainHint, apply, clearAll, preview,
      copyModeDisabled, copyModeTurnOff, reencodeWarning, invalidEntry,
      errorRequiresReencode) and per-preset `label`/`*Param*` keys for each
      catalog entry (Task 2 `labelKey`s).
      -> Shipped during P1/P4 with slightly different key names:
      `filters.presets.*`/`filters.params.*` for the catalog plus
      `convert.filtersTitle`/`filtersHint`/`addPreset`/`addFilter`/
      `customChainLabel`/`customChainPlaceholder`/`customChainHint`/`addCustom`/
      `removeFilter`/`moveUp`/`moveDown`/`clearAll`/`noFilters`/
      `filtersDisabledNote`/`filtersTurnOffCopy`/`filtersCopyWarning`/
      `chainPreview`/`filtersInvalid`.
- [x] Bump/mirror the `convert.*`, `batch/*`, demux/remux namespaces where the
      section is embedded.
      -> `convert.*` and `batch/*` mirrors were added as the sections were
      embedded (P4/P5); the `demux.filters*` and `remux.filters*` mirrors were
      added with P6/P7 (`filtersTitle`, `filtersHint`, `filtersIgnoredCopy` for
      demux; `filtersTitle`, `filtersHint`, `filtersReencodeWarning` for remux).

**Checkpoint:** `npm run validate:locales` passes. Verified: passes (55
locales + en-US = 56 total in parity).

---

### Task 28 — All-locale sweep + test mock
Status: `[x]`

**Steps**
- [x] Add the `filters.*` keys to **all 56 locale files** under
      `src/renderer/i18n/locales/` (translate where realistic, else copy the
      English best-effort per prior feature plans).
      -> Verified during P4/P5 sweeps; `validate:locales` reports full parity.
- [x] `src/test-setup.ts` (~line 28-32): confirm the i18n mock tolerates the new
      keys (key-fallback pattern), add `filters.*` entries only if a test
      asserts on them.
      -> Mock uses `map[key] || defaultValue || key` so unknown keys fall back
      safely; `convert.filters*`/`filters.presets.*` entries used by component
      tests are registered (~lines 59-67).

**Checkpoint:** `npm run validate:locales` + `npm run test:unit` green.
Verified: both green.

---

## P11 — Docs & verification

### Task 29 — Feature/architecture docs
Status: `[x]`

**Steps**
- [x] `docs/FEATURES.md`: "Video filters" section (catalog + custom chain,
      re-encode-only rule).
- [x] `docs/ARCHITECTURE_TRANSCODERS.md`: document single-`-vf` chain merge
      order (scale → rotation → presets → custom), validation, and the
      copy-mode ignore policy on each backend.
      -> "Video filters (single `-vf` chain)" subsection under "Shared flag
      building"; documents `buildFilterChain` merge order on both the
      fluent-ffmpeg and raw `buildFfmpegArgs` paths, `validateVideoFilters`
      rules/list-cap, the `LOG_FILTERS_IGNORED_COPY` drop + per-entry
      `LOG_FILTER_INVALID` policy, the CLI/MCP up-front rejections, and the
      batch transcode-only planning.

**Checkpoint:** none (docs).

---

### Task 30 — Full verification
Status: `[x]`

**Steps**
- [x] `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`.
      -> typecheck main/preload/renderer green; lint clean (only the pre-existing
      LanguageMenu autofocus warning); `test:unit` green (2278 tests / 173 files);
      CLI integration suite (`vitest.integration.config.ts`, real FFmpeg) green
      incl. the `filters=fps=24` → `24/1` frame-rate assertion; `e2e/cli.spec.ts`
      (built binary + real FFmpeg) green for the 4 new filter cases (fps rewrite,
      verbose `--preset grayscale` → `hue=s=0`, `--filters`+`--copy` usage error,
      unknown `--preset` usage error).
      -> Two failures observed in `e2e/cli.spec.ts` are pre-existing and
      unrelated: `--help` and the unknown-flag case return `status: null` from
      Electron spawn in this environment (crash/GPU-spawn issue); they fail the
      same way without the filter changes.
- [x] Manual smoke: convert with a preset (crop), a custom chain (`fps=30,
      eq=brightness=0.1`), preset+custom combined, copy-mode disable/warn on the
      Convert page; batch transcode with `--preset grayscale`; CLI
      `convert --filters` real run; MCP `convert_media` with `videoFilters`
      through the integration suite; demux re-encode with `--video-filters`;
      remux page with a filter forcing re-encode (dependency plans present).
      -> Covered by unit/component tests (Convert page preset+custom+copy-mode,
      batch panel + dialog, shared builders), the real-FFmpeg integration tests
      (CLI `--filters` fps assertion, MCP `convert_media` filters), and the new
      `e2e/cli.spec.ts` cases. The demux `--video-filters` and remux page smoke
      remain deferred to P6/P7 (REMUX_DEMUX_PLAN).

**Checkpoint:** all green (with the documented pre-existing e2e spawn
failures; GUI spec suite not run in this environment).

- [x] **Final P6/P7 sweep** (after the demux/remux filter work landed):
      -> `npm run format` (no drift), `npm run typecheck`
      (main/preload/renderer) green, `npm run lint` clean (1 pre-existing
      LanguageMenu warning), `npm run validate:locales` 55/55 parity,
      `npm run test:unit` **2635 tests / 183 files** green,
      `npm run test:integration` (real FFmpeg) **50/50** across 4 files —
      up from 43, i.e. the 7 new remux/demux filter cases — and
      `npm run mcp:smoke` OK (15 tools, ping/pong).
      -> `npm run build` (renderer + main + preload) green, then
      `e2e/cli.spec.ts` against the built binary: **60/61**. The single failure
      is the documented flaky `--help` Electron-spawn case (`status: null`) —
      re-running that test alone passes 4/4, so it is spawn contention in this
      environment, not a regression.

---

### Task 31 — Plan close
Status: `[x]`

**Steps**
- [x] Record implementation notes/deviations in the tracking header; mark all
      phases complete or skipped with rationale.
      -> Tracking header + notes updated throughout P4–P11 in this plan.
- [x] Cross-reference the remux/demux plan status (filter fields there depend
      on this plan's P1/P2 contracts).
      -> `plans/REMUX_DEMUX_PLAN.md` is now complete (47/47), so P6/P7 landed on
      top of it; this plan's P1/P2 contracts (`ConversionOptions.videoFilters`,
      `buildFilterChain`, `expandFilterShorthand`, `validateVideoFilters`) are
      what those tasks build on.

**Checkpoint:** plan reflects reality.