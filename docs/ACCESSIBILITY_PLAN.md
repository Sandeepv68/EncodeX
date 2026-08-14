# Accessibility Remediation Plan

**Status:** All 25 checkpoints implemented (CP1–CP25 ✅). Automated gate green: `npm test`, `npm run build`, `npm run lint`, plus the `convert.spec.ts` e2e keyboard test. Remaining human step: NVDA/VoiceOver screen-reader walkthrough (cannot be automated in CI).
**Scope:** All WCAG A/AA gaps found in the audit (findings codes C1–C5, H1–H7, M1–M6 refer to `docs/ACCESSIBILITY_PLAN.md` → audit findings in the conversation).
**Audit method:** Manual code inspection (no runtime scanner installed at audit time). No CRITICAL regressions expected since all edits are renderer-only.

## Current State (from audit)

| Code | Finding | Severity |
| --- | --- | --- |
| C1 | `FileDropZone` is a mouse-only `<div>` (no role/tabIndex/keyboard) — blocks file selection for keyboard/SR users on Convert, AudioExtract, MediaInfo, VideoCut | CRITICAL |
| C2 | Unlabeled comboboxes: `GroupedSelect`, `CodecSelect`, Convert/ImageCompress/AudioExtract/Settings selects, Logs filter, BatchQueue search (placeholder-only), Convert `:436` Switch | CRITICAL |
| C3 | `FieldLabel` (`form.styles.ts:15`) is a real `<label>` but never wired to controls via `htmlFor`/`id` (BatchEncodingPanel, Convert, ImageCompress, AudioExtract, Settings) | CRITICAL |
| C4 | `MediaPlayer` icon buttons and seek slider have no accessible names / `role="slider"` / value announcement | CRITICAL |
| C5 | Hover-only tooltips: `InfoTooltip`, `EllipsisTooltip` not focus-reachable | CRITICAL |
| H1 | No `h1`; pages start at `h4`/`h5`; `<title>` not localized | HIGH |
| H2 | `Settings` ThemeCard: `onClick` + `aria-pressed` on non-focusable element | HIGH |
| H3 | `Logs` clear/download IconButtons have no `aria-label` | HIGH |
| H4 | `ProgressBar` has no `role="progressbar"` / `aria-valuenow` / live region | HIGH |
| H5 | Queue job operation select lacks accessible label; grip drag-handle has no keyboard reorder | HIGH |
| H6 | `BatchQueue` FilterChips clickable but no keyboard/radio semantics | HIGH |
| H7 | Log levels / status conveyed by color only | HIGH |
| M1 | `MediaPreview` remove button is 24px and partially outside the thumbnail | MEDIUM |
| M2 | Focus ring alpha too low on light themes (`theme.ts:91`) | MEDIUM |
| M3 | Selected `MenuItem` text uses low-contrast primary color (`theme.ts:202-204`) | MEDIUM |
| M4 | Histogram SVGs have `role="img"` but no accessible name | MEDIUM |
| M5 | In-page progress/status changes not announced (Snackbar is fine) | MEDIUM |
| M6 | Drawer focus return (verify manually) | MEDIUM |

**Already good (protect in tests):** `FormField` → `FilePathField` label wiring; `BatchControls` `slotProps.input` labels; labeled switches/icon buttons in Convert/VideoCut/ImageCompress/Settings/BatchControls/AppDrawer; MUI `Dialog`/`Snackbar`/`Alert` semantics; `CardActionArea` dashboard cards; `lang="en"`; no global `outline: none`; focus ring exists; `prefers-reduced-motion` honored.

## Cross-cutting Conventions

- **Verification gate:** `npm test` + `npm run build` after every checkpoint. `npm run format:check` is NOT a gate (repo-wide red at HEAD, pre-existing). Match the surrounding file style.
- **Test compatibility:** unit tests use exact-text queries (`getByText`) and `data-testid`. Add accessible names via `aria-label`/`aria-labelledby` (or `id`/`htmlFor`) rather than changing visible text, so existing queries keep working.
- **Shared components first:** fix a shared component once (e.g. `GroupedSelect`, `CodecSelect`, `FieldLabel`) and let all pages inherit the fix; add per-page wiring only where the shared component can't carry it.
- **i18n:** reuse existing keys where possible; add new keys to `en-US.json` and mirror to the other locale files (test setup falls back to the key, so tests are unaffected).
- **No behavior changes:** these are a11y-only edits. Don't change click flows, defaults, or layout beyond hit-area/size fixes.

## Progress Tracker

| # | Checkpoint | Phase | Status |
| --- | --- | --- | --- |
| 1 | FileDropZone keyboard accessibility | 1 | ✅ |
| 2 | ProgressBar ARIA (progressbar, valuenow, live) | 1 | ✅ |
| 3 | MediaPlayer control labels + slider ARIA | 1 | ✅ |
| 4 | InfoTooltip focusable trigger | 1 | ✅ |
| 5 | EllipsisTooltip focus-visible trigger | 1 | ✅ |
| 6 | Logs IconButton aria-labels | 1 | ✅ |
| 7 | Settings ThemeCard keyboard activation | 1 | ✅ |
| 8 | FieldLabel `htmlFor` wiring (shared pattern) | 2 | ✅ |
| 9 | GroupedSelect + CodecSelect accessible names | 2 | ✅ |
| 10 | Convert page field labels + switch label | 2 | ✅ |
| 11 | ImageCompress page field labels | 2 | ✅ |
| 12 | AudioExtract page field labels | 2 | ✅ |
| 13 | BatchEncodingPanel field labels | 2 | ✅ |
| 14 | BatchQueue search + FilterChip semantics | 2 | ✅ |
| 15 | Queue job operation select label + keyboard reorder | 2 | ✅ |
| 16 | Logs filter select label | 2 | ✅ |
| 17 | Heading hierarchy (h1 per route) + localized title | 3 | ✅ |
| 18 | Histogram SVG accessible names | 3 | ✅ |
| 19 | Log level text prefix (color-independent) | 3 | ✅ |
| 20 | MediaPreview close-button hit area | 4 | ✅ |
| 21 | Focus ring contrast | 4 | ✅ |
| 22 | Selected menu-item text contrast | 4 | ✅ |
| 23 | axe-core + jest-axe regression tests | 5 | ✅ |
| 24 | ESLint jsx-a11y (optional) | 5 | ☐ |
| 24 | ESLint jsx-a11y (optional) | 5 | ✅ |
| 25 | Manual checklist + e2e spot checks | 5 | ✅ |

---

## Phase 1 — Core Interactive Components

### Checkpoint 1 — FileDropZone keyboard accessibility (C1)

**Goal:** file selection reachable and activatable via keyboard and announced to screen readers.

**Files:**
- `src/renderer/components/FileDropZone.tsx` — replace `onClick` on `DropZoneRoot` with a real `<button>`-based root (or add `role="button"`, `tabIndex={0}`, Enter/Space handling on the current div). Keep drag/drop handlers and `data-testid="file-drop-zone"` so existing tests and page behavior are unchanged.
- `src/renderer/styles/FileDropZone.styles.ts` — add `:focus-visible` styles that reuse the existing `$dragging` visual (border highlight + tint), and a default focus ring; ensure `cursor: pointer`.
- Tests: `FileDropZone.test.tsx` — add keyboard-activation tests (`userEvent.tab` → focus → Enter/Space triggers `selectFile`).

**Accept:** keyboard-only user can focus the zone, press Enter/Space, and open the file dialog; SR announces it as a button with a label.

### Checkpoint 2 — ProgressBar ARIA (H4)

**Files:**
- `src/renderer/components/ProgressBar.tsx` — add `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow` (rounded), `aria-label` (localized), and an `aria-live="polite"` region announcing completion; keep visible progress text and existing `data-testid`s.

### Checkpoint 3 — MediaPlayer control labels + slider ARIA (C4)

**Files:**
- `src/renderer/components/MediaPlayer.tsx` — add `aria-label`s to all icon buttons (play/pause, seek back/forward, mute, fullscreen, etc.); add `role="slider"` semantics to the seek control with `aria-valuemin/max/now` and a keyboard-accessible interaction (MUI Slider already provides this — prefer MUI `Slider` if a plain input is used today); wrap the time readout in an `aria-live` region.

### Checkpoint 4 — InfoTooltip focusable trigger (C5)

**Files:**
- `src/renderer/components/InfoTooltip.tsx` — make the wrapper a focusable element (`tabIndex={0}`) that opens the tooltip on focus/blur (MUI `Tooltip` has `enterTouchDelay`/focus handling; wrap in a `span tabIndex={0}` with `onFocus/onBlur`), keep `data-testid="info-tooltip"`.

### Checkpoint 5 — EllipsisTooltip focusable trigger (C5)

**Files:**
- `src/renderer/components/EllipsisTooltip.tsx` — open the tooltip on focus as well as mouse-enter (add `onFocus` to the wrapper that also runs the overflow check), close on blur; this makes truncated file paths/EXIF values readable by keyboard users.

### Checkpoint 6 — Logs IconButton labels (H3)

**Files:**
- `src/renderer/pages/Logs.tsx:137-144` — add `aria-label` to the clear (`logs-clear`) and download (`logs-download`) IconButtons (Tooltip text doubles as the label).

### Checkpoint 7 — Settings ThemeCard keyboard activation (H2)

**Files:**
- `src/renderer/pages/Settings.tsx:146-155` — add `role="button"`, `tabIndex={0}` (or better, use `ButtonBase`/`CardActionArea`), Enter/Space activation, and keep `aria-pressed` + `data-testid`s. The `:focus-visible` style already exists in `Settings.styles.ts:76`.

---

## Phase 2 — Form Control Labeling

### Checkpoint 8 — FieldLabel `htmlFor` wiring (C3, shared pattern)

**Files:**
- `src/renderer/styles/form.styles.ts` — keep `FieldLabel` as a real `<label>`; add `htmlFor` passthrough (it already accepts standard props).
- Introduce a tiny shared helper (e.g. in `form.styles.ts` or a `useFieldId` util) so each `FieldBox` can mint an `id` and pass `htmlFor={id}` + `id` to the control. Prefer converting to the `FormField` render-prop pattern where the control is already a `TextField`.

### Checkpoint 9 — GroupedSelect + CodecSelect accessible names (C2)

**Files:**
- `src/renderer/components/GroupedSelect.tsx` — accept an optional `label`/`ariaLabel` prop (default `undefined` to keep existing call sites working until wired) and pass it through to the `TextField` `slotProps.htmlInput['aria-label']`; same for `src/renderer/components/CodecSelect.tsx`.
- Update call sites in Phase 2 checkpoints to supply labels.

### Checkpoint 10 — Convert page labels (C2/C3)

**Files:**
- `src/renderer/pages/Convert.tsx` — wire `id`/`htmlFor` for container-format select (:366-369), `CodecSelect` (:448-452), scale select (:472-476); label the qscale TextField; add `aria-label` to the unlabeled Switch at :436.

### Checkpoint 11 — ImageCompress labels (C2/C3)

**Files:** `src/renderer/pages/ImageCompress.tsx:388-453` — wire labels for format/scale selects and qscale field.

### Checkpoint 12 — AudioExtract labels (C2/C3)

**Files:** `src/renderer/pages/AudioExtract.tsx` — wire labels for bitrate select and `CodecSelect`.

### Checkpoint 13 — BatchEncodingPanel labels (C2/C3)

**Files:** `src/renderer/components/BatchEncodingPanel.tsx` — wire `id`/`htmlFor` across all `FieldBox`/`FieldLabel` fields (~lines 108-268).

### Checkpoint 14 — BatchQueue search + FilterChip (C2/H6)

**Files:**
- `src/renderer/pages/BatchQueue.tsx:1025` — add a real label (`aria-label`/`aria-labelledby`) to the search field.
- `src/renderer/pages/BatchQueue.tsx:1021` + `styles/BatchQueue.styles.ts:33` FilterChip — make chips keyboard-accessible radios (`role="radio"`, `aria-checked`, MUI `Chip` `clickable` semantics) or plain buttons with `aria-pressed`.

### Checkpoint 15 — Queue job operation label + keyboard reorder (H5)

**Files:**
- `src/renderer/components/QueueJobCard.tsx` / `QueueAddReviewDialog.tsx` — give the per-job operation select a visible/accessible label; keep the drag grip but add a keyboard-accessible move control (or rely on the list-level dnd `KeyboardSensor` already present in `BatchQueue.tsx`).

### Checkpoint 16 — Logs filter select (C2)

**Files:** `src/renderer/pages/Logs.tsx:129` — label the `FilterSelect` (shared with Checkpoint 9 pattern).

---

## Phase 3 — Semantics & Hierarchy

### Checkpoint 17 — Heading hierarchy + localized title (H1) ✅

**Done:** All page titles now render as a single `<h1>` (kept their existing visual `variant` via MUI `component="h1"`): `PageContainer` (Convert/ImageCompress/AudioExtract/VideoCut/MediaInfo via `PageTitle`), `Logs`/`BatchQueue` `PageTitle`, `Settings` `SettingsTitle`, `Dashboard` `WelcomeTitle`. Section headings were promoted to `component="h2"` (visual size unchanged): `SectionTitle` (Convert/VideoCut), `InfoTitle`/`ExifTitle`/`StreamTitle`, Dashboard `CardTitleText`. Outline is now `h1` → `h2`. Localized `<title>`: `src/renderer/i18n/config.ts` sets `document.title = t('app.name')` in the init callback and on `languageChanged`. Added heading-hierarchy test in `Convert.test.tsx` (single h1 + h2 sections).

**Files:**
- `src/renderer/index.html` — static `<title>EncodeX</title>` kept as fallback; runtime title set in `src/renderer/i18n/config.ts`.
- Each page — single `h1` page title via `component="h1"` (visual variant unchanged); sections demoted to `h2` via `component="h2"`.

### Checkpoint 18 — Histogram SVG names (M4) ✅

**Done:** `HistogramChart` in `ExifSection.tsx` gained an `aria-label` prop (Red/Green/Blue/Luma) on the `role="img"` SVG; test added asserting `getByRole('img', { name })`.

**Files:** `src/renderer/components/ExifSection.tsx:65` — add an accessible name per channel (`aria-label` or `<title>` with Red/Green/Blue/Luma).

### Checkpoint 19 — Color-independent log levels (H7) ✅

**Done:** Already satisfied — `Logs.tsx:161` renders `[{entry.level}]` as a text prefix in addition to color, and the exported log file includes `[<level>]` per line (`Logs.tsx:94`). Added regression test asserting `[WARN]` text is present.

**Files:** Log level entries render a text prefix (`DEBUG`/`INFO`/`WARN`/`ERROR`) in addition to color.

---

## Phase 4 — Visual & Contrast Polish

### Checkpoint 20 — MediaPreview close-button hit area (M1) ✅

**Done:** `PreviewCloseButton` enlarged from 24px to 36px and moved fully inside the thumbnail (`top: 0`, `insetInlineEnd: 0`). New `MediaPreview.test.tsx` asserts the hit area ≥ 36px and in-bounds offsets.

### Checkpoint 21 — Focus ring contrast (M2) ✅

**Done:** All seven light-theme `focusRing` values in `colors.ts` raised from `rgba(<primary>,0.18)` to `rgba(<primary>,0.4)` (dark theme unchanged). New `src/renderer/__tests__/colors.test.ts` guards alpha ≥ 0.35.

### Checkpoint 22 — Selected menu-item text contrast (M3) ✅

**Done:** `theme.ts` `.Mui-selected` now uses `color: themeDef.text.primary` on `tint.primary25` (checkmark stays primary). `colors.test.ts` asserts ≥ 4.5:1 contrast of `text.primary` against the composited `primary25`-over-`menu.surface` background for every theme.

---

## Phase 5 — Automation & Verification

### Checkpoint 23 — axe-core + jest-axe (regression tests) ✅

**Done:** Added `axe-core@4.13.0` (devDependency) and a small runner helper `src/test-utils/axe.ts` — `assertNoAxeViolations(container)` runs `axe.run` and fails on violations. Document-level rules (`bypass`, `document-title`, `html-has-lang`, landmarks, `region`, `page-has-heading-one`) are disabled because tests render component subtrees without a page scaffold, and `color-contrast`/`scrollable-region-focusable` are disabled because jsdom can't compute paint/scroll metrics (contrast is covered by `colors.test.ts`). axe assertions added to FileDropZone, ProgressBar, BatchControls, MediaPlayer, Logs, Settings, Convert tests. **Axe caught a real leftover from C2:** Settings `hwaccelMode`/`encoderType` `TextField select`s had unnamed comboboxes — fixed with `slotProps.htmlInput['aria-label']` in `Settings.tsx` + assertions.

**Files:**
- `package.json` — add `axe-core` (and `jest-axe` if compatible with Vitest/jsdom; otherwise a small `axe` runner helper using `@testing-library/dom` + `axe.run`).
- `src/test-setup.ts` or a new `src/test-utils/axe.ts` — export `assertNoViolations(container)` helper.
- Add axe assertions to a representative subset of component/page tests (FileDropZone, Settings, Logs, Convert, MediaPlayer, ProgressBar, BatchControls).

### Checkpoint 24 — ESLint jsx-a11y (optional) ✅

**Done:** Added `eslint` 9, `eslint-plugin-jsx-a11y`, `typescript-eslint` (devDeps) and `eslint.config.mjs` (flat config) scoped to `src/renderer` only. Every jsx-a11y recommended rule is set to `warn` (options preserved) so it never blocks. New `npm run lint` script. Current result: 0 errors, 1 pre-existing warning (`LanguageMenu.tsx:147` `autoFocus`).

**Files:** add `eslint-plugin-jsx-a11y` config; scope it to the renderer so it can be enabled without blocking `main`/`preload`. Only if the repo is ready to adopt ESLint (no ESLint config exists today).

### Checkpoint 25 — Manual checklist + e2e spot checks ✅ (automated parts)

**Done:** Added an e2e keyboard test to `e2e/specs/convert.spec.ts` — focuses the FileDropZone (`[data-testid="file-drop-zone"]`) and activates it with Enter, asserting the input file is selected (real Electron + mock preload; 10/10 pass). Final gate green: `npm test` (111 files / 1372 tests), `npm run build`, `npm run lint` (0 errors, 1 pre-existing warning). Remaining human steps (below) require a real screen reader.

- Keyboard walkthrough of every page (Tab order, Enter/Space, Esc, focus visibility).
- Screen-reader spot check (NVDA/VoiceOver) on FileDropZone, Convert, Settings, MediaPlayer.
- Extend one e2e spec (`e2e/`) to assert the FileDropZone is focusable/activatable via keyboard if the harness supports it. ✅ (added to convert.spec.ts)
- Final `npm test` + `npm run build` + review diff. ✅

---

## Verification Summary

- After each checkpoint: run the focused test file first (`npx vitest run <file>`), then `npm test`, then `npm run build`.
- The full gate (`npm test` + `npm run build`) must pass at the end of every phase.
- Note: `fireEvent.keyDown/keyUp` does not synthesize native `<button>` Enter/Space activation in jsdom — use `userEvent.setup()` (`focus()` + `user.keyboard(' ')`) for keyboard-activation assertions.
- CP7 (ThemeCard) required no code change: `ThemeCard` was already `styled('button')` with `:focus-visible` and `aria-pressed`; added a keyboard-activation test as regression coverage.
- MUI `TextField select`: `htmlFor`/`id` does NOT name the combobox (the input is a hidden, non-labellable element). Verified empirically that MUI forwards `slotProps.htmlInput['aria-label']` onto the combobox — use `aria-label` (queryable via `getByRole('combobox', { name })`) for MUI selects, and reserve `htmlFor`/`id` for genuinely labelable inputs (text/number). New `useFieldId` hook in `src/renderer/hooks/useFieldId.ts`; `GroupedSelect`/`CodecSelect` now accept `id`/`ariaLabel` props.
- Headings (CP17): page titles render as a single `<h1>` and sections as `<h2>` by passing MUI's `component` prop while keeping the visual `variant` (e.g. `variant="h5" component="h1"`) — no visual change, clean outline. Localized `<title>` set dynamically in `src/renderer/i18n/config.ts` (`document.title = t('app.name')`).
- axe (CP23): `src/test-utils/axe.ts` disables `color-contrast`/`scrollable-region-focusable` (jsdom can't compute paint/scroll) and document-level rules (`region`, `bypass`, landmarks, `page-has-heading-one`, `html-has-lang`, `document-title`). jsdom axe gotcha: `axe.run(undefined, ...)` throws "axe.run arguments are invalid" — always pass a real rendered container.
