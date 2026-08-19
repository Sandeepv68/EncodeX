# UI Polish Plan — Form Inputs & Styles

Goal: modernize the look of every form input across all pages, extend the palette with
derived input tokens (keeping all 8 themes), unify shared form primitives, and complete a
full form-UX pass (validation, accessibility, responsive layout).

## Decisions (locked)

- **Visual direction:** modern custom look (rounded controls, tinted surfaces, focus rings) — beyond stock MUI, but each of the 8 themes stays recognizable.
- **Refactor scope:** shared form primitives (`FormField`, shared `FieldLabel`/`ToggleRow`/`SectionCard`), plus global MUI `theme.ts` overrides.
- **Palette:** extend `colors.ts`/`types.ts` with derived tokens (input surface/border/focus ring, menu surface) computed per theme; no theme identity change.
- **UX scope:** full pass — required markers, label↔input association (`htmlFor`/`id`), error focus, responsive layout, section headers on long forms.

## Test safety

- Preserve component public props, `data-testid` attributes, and error/helper-text rendering.
- Required markers rendered as separate `<span aria-hidden>` so exact `getByText('Label')`
  assertions keep working; update only the handful of assertions that are affected.
- Batch `BatchControls` fields are intentionally uncontrolled refs — the responsive-grid
  refactor must preserve that contract.

---

## Phase 1 — Design tokens (`colors.ts`, `types.ts`)

Extend `ThemeDefinition` with derived tokens per theme:
`input.surface`, `input.surfaceHover`, `input.border`, `input.borderFocus`,
`focusRing` (primary @ ~18%), `surfaceSubtle`, `menu.surface`, `menu.shadow`.

- [x] colors.ts: add tokens to all 8 themes + helpers
- [x] types.ts note: `ThemeDefinition` lives in `colors.ts` (not `types.ts`) — extended there instead; `types.ts` unchanged
- [x] Standalone `tsc --noEmit` on colors.ts passes

## Phase 2 — Global component overrides (`theme.ts`)

Add MUI styleOverrides so every control gets the modern look:

- `MuiOutlinedInput` / `MuiInputBase`: taller (~44px), radius 10–12px, surface background,
  divider border, hover border = `input.borderFocus`, focus border 2px primary + `focusRing` shadow.
- `MuiInputLabel`, `MuiFormHelperText`, `MuiMenuItem` (hover = primary tint), `MuiMenu`
  paper (rounded, shadow), `MuiSwitch`, `MuiCheckbox`, `MuiChip`, `MuiTooltip`, `MuiAlert`,
  `MuiButton` (radius 10px, hover elevation).
- Hide native `input[type=number]` spinners.

## Phase 3 — Shared form primitives

- New `FormField` component: label (+ InfoTooltip, required marker, `htmlFor`) + control + helper text, `useId()` association.
- New `styles/form.styles.ts`: single `FieldLabel`, `FieldBox`, `ToggleRow`, `SectionCard`, `SectionTitle`, `SectionHint`.
- Migrate Convert / TimeField / ImageCompress / AudioExtract / VideoCut / BatchEncodingPanel off duplicated definitions.
- Refactor `FilePathField` + `TimeField` onto `FormField` (props/`data-testid`/error behavior unchanged).

## Phase 4 — Per-page layout & sectioning

- Convert: group into "Source files" / "Encoding" / "Advanced" `SectionCard`s.
- ImageCompress / AudioExtract: unify `PreviewBox`, align labels/buttons.
- VideoCut: `TimeField` monospace + clock adornment; consistent section headers.
- BatchQueue: `BatchControls` → responsive grid; `BatchEncodingPanel` equal field widths.
- Settings: `ModeSelect` full width on mobile; shared `ToggleRow`.

## Phase 5 — Input-level polish

- [x] qscale/quality number fields: `/31` end adornment, range helper caption, clean number styling.
- [x] TimeField: `HH:MM:SS` monospace + clock icon + format hint.
- [x] FilePathField: browse button aligned to input height; stacked full-width on `xs`.
- [x] FileDropZone: hover lift + shadow, primary-tinted icon on hover/drag, secondary hint line.
- [x] GroupedSelect: rounded menu paper + group headers.

## Phase 6 — Validation & accessibility

- [x] Required markers (`*`) on output/input labels via `FormField.required`; `aria-required`/`aria-invalid`.
- [x] Focus the first errored field on failed submit.
- [x] RTL: replace hardcoded `left`/`right` where feasible with `inset-inline-*`.

## Phase 7 — Verification

- [x] `npm run test:unit` green
- [x] `npm run format:check`
- [x] `npm run build:renderer`, `npm run build:main`
- [ ] Spot-check dark theme + RTL (`ar-SA`) — manual visual check

---

## Progress Log

### 2026-08-11 — Session start

- Plan file created.
- **Phase 1 COMPLETE** — `colors.ts`: `ThemeDefinition.input`/`focusRing`/`surfaceSubtle`/`menu`
  tokens added to all 8 themes; interface + JSDoc updated; typechecks. Type was extended in
  `colors.ts` because that is where the interface is defined.
- **Phase 2 COMPLETE** — `theme.ts`: global MUI overrides for the modern look —
  `MuiOutlinedInput`/`MuiInputBase` (tinted surface, 10px radius, hover/focus borders,
  focus ring, 44px/36px heights, hidden number spinners), `MuiInputLabel`,
  `MuiFormHelperText`, `MuiButton` (10px radius, hover elevation via `SHADOWS`, 40/48px
  heights, icon inherit), `MuiMenu`/`MuiMenuItem` (rounded surface + shadow + primary
  tint hover/selected), `MuiSwitch`, `MuiCheckbox`, `MuiChip`, `MuiTooltip`, `MuiAlert`,
  plus existing `MuiDrawer`/`MuiPaper`. No new type errors (e2e failures are pre-existing).
- **Phase 3a COMPLETE** — new `components/FormField.tsx` (label + InfoTooltip + required
  marker + `htmlFor`/`useId` association + helper/error line via render-prop control id)
  and `styles/form.styles.ts` (`FieldBox`, `FieldLabel` as a real `<label>`,
  `RequiredMarker`, `ToggleRow`, `SectionCard`, `SectionTitle`, `SectionHint`).
  `FormFieldProps` added to `components/types.ts`. Deleted unused `TimeField.styles.ts`.
- **Phase 3b COMPLETE** — Convert / TimeField / FilePathField / ImageCompress / AudioExtract /
  VideoCut now consume `FieldBox`/`FieldLabel`/`ToggleRow` from `form.styles.ts` (duplicated
  definitions removed from their styles files); `FilePathField` + `TimeField` refactored onto
  `FormField`. `BatchEncodingPanel` keeps its local column-flex `FieldBox`/`FieldLabel`
  (different layout, uses `sx={{ width }}`) to avoid visual regressions. 115 targeted tests green.
- **Phase 4a COMPLETE** — Convert grouped into three `SectionCard`s: "Source Files"
  (FilePathField input + preview button + output field + CompatAlert), "Encoding"
  (lossless-copy `ToggleRow` + codec fields, always visible so the toggle stays reachable in
  copyMode), "Advanced" (transcoder core). Added `convert.sourceFiles` / `convert.encoding` /
  `convert.advanced` keys to en-US.json only (fallback covers the rest).
- **Phase 4b COMPLETE** — new shared `MediaPreview` component + `MediaPreview.styles.ts`
  (`PreviewBox`/`PreviewImageBox`/`PreviewInfo`/`PreviewImage` with `variant` `square`
  96×96 vs `wide` 160×90, `PreviewCloseButton`); `MediaPreviewProps` added to
  `components/types.ts`. AudioExtract and ImageCompress both render through it (all
  `data-testid`s preserved). Deleted `AudioExtract.styles.ts`; trimmed
  `ImageCompress.styles.ts` to `ToggleSpacer` only.
- **Phase 4c COMPLETE** — `TimeField` gained a `faClock` start adornment and monospace
  `htmlInput` (via `slotProps.input`/`slotProps.htmlInput`, MUI v9 dropped `InputProps`).
  VideoCut uses shared `SectionCard` + `SectionTitle`; `VideoCut.styles.ts` trimmed.
- **Phase 4d COMPLETE** — `BatchControls` layout is now a responsive MUI Grid v2 (`size={{ xs, sm, md, lg }}`)
  instead of a wrapping `Stack`: operation/transcoder/suffix/concurrency on one row
  (`xs 12 / sm 6 / md 4 / lg 3`), output-dir + browse + overwrite on the next (`xs 12 / sm 9+3 / md 10+2`),
  action icon buttons on their own wrapped row. The uncontrolled-ref contract
  (`operationRef`/`transcoderRef`/`suffixRef`) is unchanged. `BatchEncodingPanel` switched from
  hardcoded `sx={{ width }}` boxes to an equal-width responsive grid (`xs 12 / sm 6 / lg 4`);
  its local `FieldBox`/`FieldLabel` retained. Removed now-unused `ControlsStack`/`EncodingStack`.
- **Phase 4e COMPLETE** — Settings switch rows now use the shared `ToggleRow` (Switch +
  `SettingLabel` + tooltip) inside each `SettingsSection`; the hwaccel-mode / encoder-type rows
  use a new responsive `ModeSettingsSection` that stacks to a column on `xs` with `ModeSelect`
  full-width (`minWidth` cleared on mobile).
- **Phase 4 VERIFICATION COMPLETE** — full `npm run test:unit` 1286/1286 green, `tsc --noEmit`
  clean (only pre-existing e2e errors), `npm run format:check` clean.
- **Phase 5 COMPLETE** — input-level polish:
  - qscale/quality fields (Convert `convert-qscale`, ImageCompress `image-compress-quality`,
    BatchEncodingPanel): `/ 31` `InputAdornment` end adornment + range helper caption
    (`errors.x || t('...RangeCaption')`), `min`/`max` on `slotProps.htmlInput`.
  - `TimeField` gained a `formatHint` prop (rendered as helper text, `' '` fallback keeps height);
    VideoCut passes `videoCut.timeFormatHint` to its start/duration/end TimeFields.
  - `FilePathField`: new `BrowseButton` pinned to the 36px input height (`flexShrink: 0`);
    `FieldStack` stacks to a column on `xs` (`direction={{ xs: 'column', sm: 'row' }}`,
    `alignItems: stretch` on xs); unused `Button` import removed.
  - `FileDropZone`: hover lift (`translateY(-2px)`) + `SHADOWS.SOFT_HOVER_*`, primary-tinted
    `svg` on hover/drag, secondary `dropHint` caption line.
  - `GroupedSelect`: group headers pin `backgroundColor`/`color` on `:hover`/`.Mui-selected`
    (suppresses the global MuiMenuItem hover tint); rounded menu paper already global.
  - en-US.json only new keys: `convert.qscaleRangeCaption`, `imageCompress.qualityRangeCaption`,
    `videoCut.timeFormatHint`, `fileDropZone.dropHint`.
- **Phase 6 COMPLETE** — validation & accessibility:
  - Required markers: `FormField.required` renders an aria-hidden `*`; `FilePathField`/`TimeField`
    forward `required` and set `aria-required="true"` via `slotProps.htmlInput` (`aria-invalid`
    comes from MUI `error`). Marked on Convert input+output, AudioExtract output,
    ImageCompress output, VideoCut output. New `FormField.test.tsx` (6 tests) proves the marker
    keeps exact `getByText('Label')` queries working (testing-library reads only direct text nodes).
  - Focus first errored field: new `utils/focusFirstError.ts` (fieldOrder + testId map → focuses
    the field's `input`); wired into Convert (qscale), ImageCompress (output, quality),
    AudioExtract (output), VideoCut (output, startTime, duration, endTime). BatchQueue has no
    submit error map so it is intentionally not wired.
  - RTL: replaced hardcoded `left`/`right` with logical properties where feasible —
    `paddingInline`/`marginInline` (AppDrawer, Footer, LanguageMenu, MediaPlayer, StreamDetails,
    Convert `PreviewDivider`), `marginInlineStart`/`marginInlineEnd` (RequiredMarker,
    InfoTooltip, TitleBar, TimeText, LanguageMenu flag, PageContainer icon, BatchQueue ETA,
    MuiFormHelperText), `insetInlineEnd` (MediaPreview close button, MuiDrawer paper border),
    `textAlign: 'start'` (Dashboard card title), `insetInlineStart` (ProgressBar stripes),
    `insetInline` (QueueDropArea indicator). The VideoTimeline's absolute coordinate math
    (`left: value * zoom`, `scrollLeft`) is intentionally left as-is (LTR coordinate system).
- **Phase 7 VERIFICATION COMPLETE** — full `npm run test:unit` 1292/1292 green (108 files),
  `npm run format:check` clean (5 files prettier-fixed), `tsc --noEmit` clean (only pre-existing
  e2e errors), `build:renderer` + `build:main` + `build:preload` all pass. Remaining unchecked
  item is the manual visual spot-check of dark theme + RTL (`ar-SA`).
