# Navigation Blip Hover Popover Plan

Adds a hover popover to the animated activity "blips" on the navigation drawer rows
(Convert, Audio Extract, Video Cut) and to the Batch Queue count badge. Hovering (or
focusing) a blip shows a compact popover describing the in-progress job on that page,
with the source file name, status, and a live progress bar.

## Current state

- `AppDrawer.tsx:116-131` renders three `NavBlip` dots (`data-testid="nav-convert-blip"`,
  `nav-audio-extract-blip`, `nav-video-cut-blip`) while the respective job runs, plus a
  `NavCountBadge` on the Batch Queue row showing the job count (`nav-batch-blip`).
- Blips are `aria-hidden`, decorative spans with a blink + ripple animation
  (`AppDrawer.styles.ts:109-167`); no hover/focus interaction today.
- Data availability per blip:
  - **Convert** — `useConversionStore`: `inputFile`, `outputFile`, `progress`
    (`ProgressData`), `isConverting`, `isPaused`. All already stored.
  - **Audio Extract** — `useAudioExtractStore`: `input`, `output`, `progress`
    (`TaskProgress`), `isConverting`, `isPaused`. All already stored.
  - **Video Cut** — `useVideoCutStore`: `input`, `output`, `isCutting`; **no progress
    field**. Progress lives page-locally in `useMediaTask` (VideoCut.tsx:320), so it must
    be lifted into the store (see C2).
  - **Batch Queue** — `useQueueStore`: `jobs` (`QueueJob[]`) and
    `progress: Record<id, ConversionProgress>`. Count badge exists; popover needs a
    running-job summary.
- Existing `ProgressBar` component (`components/ProgressBar.tsx`) renders the determinate
  track + `% / time / speed / eta` captions and clamps `percent` to 0-100 — reuse it
  unchanged in the popover.
- i18n already has `progress.time/speed/eta` keys (test-setup map too).

## Design decisions

1. **Popover trigger = the nav row, not a nested button.** `NavItemButton` is an MUI
   `ListItemButton` (a `<button>`); nesting another focusable button inside it would be
   invalid a11y. The blips are visually inside the row, so opening the popover on the
   row's hover/focus satisfies "hover on the blip" while staying keyboard-accessible
   (focus opens, blur/Escape closes). Blips stay `aria-hidden`; the popover itself
   carries the accessible description.
2. **One shared popover, not four.** A single MUI `Popover` whose content and anchor are
   driven by state `active: null | 'convert' | 'audio' | 'cut' | 'batch'` + `anchorEl`.
   Simpler cleanup, one close path, and no per-blip mount cost.
3. **Reuse MUI `Popover`** (not `Tooltip`) because content is rich (file + status +
   progress bar) and `Tooltip`'s delayed show/hide fights live progress updates.
   Configure `anchorOrigin`/`transformOrigin` to adapt to expanded vs condensed drawer
   (expanded: right of row label, at the blip; condensed: corner badge of the icon).
4. **Lift Video Cut progress into `videoCutStore`** so the drawer can read it without
   living on the page (mirrors how Audio Extract already stores progress). The page keeps
   its `useMediaTask` local state for rendering; progress writes go to both.
5. **Popover content** (all localized):
   - Title: the page label (`nav.convert` / `nav.audio` / `nav.cut` / `nav.batchQueue`).
   - Status line: `Converting…` / `Extracting audio…` / `Cutting…` / `N of M jobs` —
     with a `Paused` tag when `isPaused`.
   - Source file basename (truncated, `title` tooltip with full path).
   - `ProgressBar` (percent/time/speed/eta). When `progress` is null (job just started),
     render the track at 0% with the localized "starting" caption.
   - Batch: show the top active (RUNNING) job's progress bar plus "x queued / y running /
     z done" summary line.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. i18n keys (en-US first, then all locales + `validate:locales`):
  `nav.blip.converting`, `nav.blip.extracting`, `nav.blip.cutting`,
  `nav.blip.paused`, `nav.blip.starting`, `batchQueue.blipSummary`
  (`{{queued}} queued, {{running}} running, {{done}} done`).
- [x] C2. `videoCutStore` + `stores/types.ts` (`VideoCutState`): add
  `progress: TaskProgress | null` and `setProgress` (mirrors `audioExtractStore`).
  Clear progress when `setIsCutting(false)` / on cancel.
- [x] C3. `VideoCut.tsx`: write live progress into `useVideoCutStore.setProgress` from
  the page's `onConversionProgress` subscription; clear it in `handleCut` finally/cancel.
- [x] C4. New component `components/NavJobPopover.tsx`:
  - Props: `active`, `anchorEl`, `onClose`, plus resolved content pieces (title, status,
    fileName, progress, paused, condensed, and optional batch summary).
  - MUI `Popover`, hover-open + focus-open, `onMouseLeave` close with a small
    leave-delay to avoid flicker, Escape closes.
  - Renders `ProgressBar` (reused) in a fixed-width card; basename via a small
    `path.basename`-equivalent helper (no node import in renderer — split on `/` and `\`).
- [x] C5. `AppDrawer.tsx`:
  - Subscribe to the extra slices (convert progress/isPaused/inputFile, audio
    input/progress/isPaused, cut input/progress, queue jobs/progress).
  - Add `active` + `anchorEl` state; `mouseEnter`/`focus` on a row with a live blip sets
    it, `mouseLeave`/`blur`/Escape clears it.
  - Render one `<NavJobPopover>` inside the drawer root, fed from the active blip.
- [x] C6. Styles (`AppDrawer.styles.ts`): small popover card styles (width ~280px,
  padding, file-name truncation) or inline `sx`; keep theme-driven.
- [x] C7. Tests:
  - `AppDrawer.test.tsx`: set store progress on the convert/audio/cut stores, hover the
    blip row, assert popover shows file basename, status, and `x.x%`; batch badge shows
    summary + running job progress; close on leave/Escape.
  - `VideoCut.test.tsx`: assert `useVideoCutStore` receives progress while cutting.
  - `NavJobPopover.test.tsx` (if kept standalone): renders each variant + null-progress.
  - Keep existing blip show/hide tests green (blips remain `aria-hidden`).
- [x] C8. Verify: `npx vitest run` (AppDrawer, VideoCut, NavJobPopover + full suite),
  `npm run validate:locales`, `npx prettier --check`, `npm run lint`,
  `npm run typecheck:main`, `npm run typecheck:renderer`.

## Edge cases

- **Progress null on a just-started job** → 0% track + `nav.blip.starting` caption.
- **Blip disappears mid-hover** (job finishes) → popover closes via the row's
  unmount/blur; `onClose` also clears `active` when anchor unmounts.
- **Condensed drawer** → popover anchors to the icon corner badge; content unchanged.
- **Multiple queue jobs** → summary counts + top running job's bar (job with
  `status === RUNNING` first, else first QUEUED).
- **Reduced motion** → respect existing `prefers-reduced-motion` media queries; the
  popover itself is static.

## Out of scope

- Clicking the popover to navigate to the page (future enhancement).
- Pause/resume/cancel controls inside the popover.
- Showing the destination file name (only source shown for brevity).
