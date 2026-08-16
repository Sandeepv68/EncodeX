# Keyboard Shortcuts Plan

Adds a fast keyboard layer over every interactive feature in the app. The app currently
has no shortcut infrastructure: `Menu.setApplicationMenu(null)` disables the native menu,
no hotkey library is installed, and the only key handling is `Escape` in `LanguageMenu`
(and MUI's built-in dialog handling). This plan adds a small, dependency-free renderer-side
hotkey system plus a discoverable shortcut map for every page.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] S0. Create this plan document.
- [x] S1. Core hook `src/renderer/hooks/useHotkeys.ts`: a `keydown` listener with
      modifier matching (`Ctrl`/`Cmd` via `metaKey` on macOS), optional `preventDefault`,
      an `enabled` flag, editable-target guard, and proper add/remove on mount/unmount.
- [x] S2. Registry `src/renderer/constants/shortcuts.ts`: single source of truth mapping
      every shortcut id → `{ keys, labelKey, scope }` so wiring, tooltips, and the help
      dialog all read from one place.
- [x] S3. Platform formatter `src/renderer/utils/shortcutHint.ts`: turns a key spec into a
      localized display string (`Ctrl+Enter` vs `⌘↵` / `⌘Enter`) for tooltips and the dialog.
- [x] S4. Global wiring in `App.tsx` (`AppLayout`): navigation `Alt+1..9`, theme toggle
      `Ctrl+Alt+T`, shortcuts help `Ctrl+/`, plus the always-mounted `ShortcutsHelpDialog`.
- [x] S5. `ShortcutsHelpDialog` component + styles: modal overlay listing every shortcut
      grouped by page, built from the registry, opened/closed via the global toggle, closed
      with `Escape`.
- [x] S6. Page wiring: `useHotkeys` calls in Convert, MediaInfo, ImageCompress, AudioExtract,
      VideoCut, BatchQueue, Logs, Settings, Dashboard (see tables below). Actions call the
      same handlers the buttons use; buttons with existing `disabled` logic keep it.
- [x] S7. MediaPlayer keyboard: `Space` play/pause, `M` mute, `←`/`→` seek −5s/+5s inside
      `MediaPlayer` (used by Convert preview and VideoCut preview), guarded by editable-target
      and enabled only while a file is loaded.
- [x] S8. Discoverability: append ` (Ctrl+Enter)`-style hints to `Tooltip` titles of the
      primary action buttons via `shortcutHint`, and add a footer hint row on the Dashboard.
- [x] S9. i18n: add a top-level `shortcuts` section (group titles, action labels) to all 56
      locale files via the scripted insert used by `CLOSE_CONFIRMATION_PLAN`, then run
      `npm run validate:locales`.
- [x] S10. Tests: unit tests for `useHotkeys` (matching, guards, cleanup, modifiers); tests
      for `ShortcutsHelpDialog`; extend the existing page tests (`Convert`, `AudioExtract`,
      `VideoCut`, `ImageCompress`, `BatchQueue`, `Logs`, `Settings`) with `user.keyboard`
      assertions.
- [x] S11. Verify: `npm run prettier --check`, `npm run typecheck`, `npm run lint`,
      `npm test`.

## Design principles

1. **Additive, never replacing.** Tab/Enter/Space keyboard navigation already works on every
   control; shortcuts are a speed layer on top. Nothing that is keyboard-accessible today
   becomes inaccessible.
2. **Registry-driven.** Every shortcut lives in `shortcuts.ts` once; the hook wiring, the
   help dialog, and tooltip hints all consume the same record, so shortcuts cannot drift
   apart across files.
3. **Modifier conventions.**
   - `Ctrl`/`Cmd` + a key → application action (file pickers, primary actions, job control).
   - `Alt` + a key → navigation.
   - Bare letter / arrow keys → page toggles and playback, only when the user is *not*
     typing in a field.
   - `Esc` → close dialogs (MUI native) and the shortcuts help overlay.
4. **Page-scoped reuse is intentional.** `Ctrl+O`, `Ctrl+Enter`, `Ctrl+Shift+P` etc. mean the
   same thing on every page that has them, but listeners are only active while that route is
   mounted, so there is no cross-page conflict.
5. **Never capture while typing.** Any shortcut without a `Ctrl`/`Alt`/`Cmd` modifier is
   ignored when the event target is an `input`, `textarea`, `select`, or `contenteditable`.
6. **Suspend while a modal is open.** When a `ConfirmDialog`, review/options dialog, the
   help overlay, or the language menu is open, page-level shortcuts are disabled (the modal
   owns the keyboard; `Esc`/`Enter` are already native). Implemented by each dialog toggling
   an `enabled` flag, or by `ShortcutScopeContext` (see Architecture).
7. **No conflicts with OS/browser defaults.** Avoid `Ctrl+W`, `Ctrl+R`, `Ctrl+Shift+I`,
   `Ctrl+P` (print), `Alt+F4`. `preventDefault()` on handled combos (e.g. `Ctrl+O`) stops
   Chromium's own handling.
8. **Platform-correct display.** macOS shows `⌘` instead of `Ctrl` via `shortcutHint`.
9. **Global vs page scope.** `AppLayout` owns global shortcuts. Each page owns its own
   shortcuts and unregisters on unmount (route change), which is exactly what React Router
   already does with page state.

## Guard rules (implementation)

- `isEditableTarget(event)` → true for `INPUT`/`TEXTAREA`/`SELECT`/`[contenteditable]`.
- A binding runs only if:
  - it is a modifier combo (`Ctrl|Alt|Cmd` present), **or** the target is not editable, **and**
  - `enabled !== false` (modal-open flag), **and**
  - `event.repeat` is false for one-shot actions (start, cancel, extract, cut).
- Handled combos call `event.preventDefault()`.

## Shortcut map

### Global (AppLayout) — active on every route

| Shortcut | Action | i18n key |
| --- | --- | --- |
| `Ctrl+/` | Toggle shortcuts help dialog | `shortcuts.help` |
| `Alt+1` … `Alt+9` | Navigate to Dashboard…Settings (`NAV_ITEMS` order) | `shortcuts.nav` |
| `Ctrl+Alt+T` | Toggle light/dark theme (`useColorMode`) | `shortcuts.theme` |
| `Ctrl+W` | Close window (`windowClose()`) — optional, mirrors title-bar X | `shortcuts.closeWindow` |

### Convert (`/convert`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Choose input file | `selectInput` |
| `Ctrl+Shift+S` | Choose output file | `selectOutput` |
| `Ctrl+Enter` | Start conversion | `handleStartConversion` |
| `Ctrl+Shift+P` | Pause / resume | `pauseConversion` / `resumeConversion` |
| `Ctrl+Shift+C` | Cancel conversion (confirm dialog) | `handleCancelClick` |
| `Ctrl+Shift+X` | Clear / cancel job (dirty form) | `() => setJobCancelOpen(true)` |
| `L` | Toggle lossless copy | `setCopyMode` |
| `P` | Show / hide preview panel | `setPreviewOpen` |

### Media Info (`/media-info`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Choose a file to inspect | `FileDropZone` picker / `handleFile` |

### Image Compress (`/image-compress`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Choose input image | `handleFileSelect` |
| `Ctrl+Shift+S` | Choose output file | `onBrowse` → `selectOutput` |
| `Ctrl+Enter` | Compress | `handleConvert` |
| `K` | Toggle keep-aspect-ratio | `setKeepAspectRatio` |

### Audio Extract (`/audio-extract`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Choose input video | `handleFileSelect` |
| `Ctrl+Shift+S` | Choose output file | `onBrowse` → `selectOutput` |
| `Ctrl+Enter` | Extract audio | `handleExtract` |
| `Ctrl+Shift+P` | Pause / resume | `pauseExtract` / `resumeExtract` |
| `Ctrl+Shift+C` | Cancel extraction (confirm) | `() => setCancelConfirmOpen(true)` |

### Video Cut (`/video-cut`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Choose / change video | `handleBrowseVideo` |
| `Ctrl+Shift+S` | Choose output file | `onBrowse` → `selectOutput` |
| `Ctrl+Enter` | Cut | `handleCut` |
| `Ctrl+Shift+P` | Pause / resume cut | `pauseCut` / `resumeCut` |
| `Ctrl+Shift+C` | Cancel cut (confirm) | `() => setCancelConfirmOpen(true)` |
| `Ctrl+Shift+X` | Clear form | `() => setJobCancelOpen(true)` |
| `U` | Toggle use-duration mode | `setUseDuration` |
| `A` | Toggle include audio | `setIncludeAudio` |
| `Space` | Play / pause preview | `MediaPlayer` (S7) |
| `M` | Mute / unmute preview | `MediaPlayer` (S7) |
| `←` / `→` | Seek preview −5s / +5s | `MediaPlayer` (S7) |

### Batch Queue (`/batch`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+O` | Add files (review dialog) | `handleAddFiles` |
| `Ctrl+Enter` | Start batch | `handleStart` |
| `Ctrl+Shift+P` | Pause / resume queue | `handlePause` / `handleResume` |
| `Ctrl+Shift+C` | Cancel all (confirm) | `handleCancelAll` |
| `Ctrl+Shift+X` | Clear completed | `handleClearCompleted` |
| `Ctrl+E` | Export queue | `handleExport` |
| `Ctrl+I` | Import queue | `handleImport` |
| `C` | Toggle condense / expand | `setCondensed` |
| `F` | Focus the search field | `SearchField` ref focus |
| `1` … `5` | Filter all / queued / running / done / failed | `setFilter` |

### Logs (`/logs`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `Ctrl+L` | Clear logs | `clear` |
| `Ctrl+Shift+D` | Download logs | `downloadLogs` |

### Settings (`/settings`)

Settings rows are switches and selects that are already fully keyboard-operable (Tab +
Space/arrows). Only the global shortcuts apply here; optionally add `Ctrl+Shift+D`
(download logs is elsewhere) — no page-local keys are required.

### Dashboard (`/`)

| Shortcut | Action | Existing handler |
| --- | --- | --- |
| `1` … `6` | Open a tool card (optional) | `navigate(item.to)` |

> Note: Batch-queue drag-and-drop reordering is already keyboard-accessible via the
> `KeyboardSensor` wired in `BatchQueue.tsx`; no work needed there.

## Architecture

- **`src/renderer/hooks/useHotkeys.ts`** (new)
  API sketch:

  ```ts
  type HotkeySpec = { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean };
  function useHotkeys(
    bindings: Record<string, (e: KeyboardEvent) => void>, // id -> handler
    opts?: { enabled?: boolean; preventDefault?: boolean; allowInInput?: boolean },
  ): void;
  ```

  Internally it parses the registry ids, matches `KeyboardEvent.key` against the spec
  (using `event.metaKey` when `navigator.platform` is macOS, else `ctrlKey`), applies the
  editable-target guard, and installs/removes one `keydown` listener. It reads the spec
  from `shortcuts.ts`, so call sites pass ids only.

- **`src/renderer/constants/shortcuts.ts`** (new)
  `export const SHORTCUTS = { global: {...}, convert: {...}, ... }` where each entry is
  `{ keys: HotkeySpec, labelKey: string }`. `labelKey` points at `shortcuts.<section>.<key>`
  in the locale files.

- **`src/renderer/components/ShortcutsHelpDialog.tsx`** + styles (new)
  A MUI `Dialog` rendering the registry grouped by scope (Global, Convert, Media Info, …).
  Each row shows the formatted key combo (`shortcutHint`) and the translated label. Toggle
  state lives in `AppLayout` (`useState`); `Escape` closes via the dialog's `onClose`.

- **`ShortcutScopeContext`** (new, optional if per-dialog `enabled` flags suffice)
  `src/renderer/context/ShortcutScopeContext.tsx` exposes `setShortcutsEnabled(false)` so any
  open modal can suspend page shortcuts. Simpler alternative: pass `enabled` through each
  dialog component's open state; the plan defaults to per-page `enabled` flags wired from the
  page's own dialog states, which need no new context.

- **`src/renderer/utils/shortcutHint.ts`** (new)
  `formatShortcut(keys: HotkeySpec): string` → `"Ctrl+Enter"` / `"⌘Enter"`, and
  `shortcutHint(labelKey, keys)` returning `t(labelKey) + " (" + formatShortcut(keys) + ")"`
  for tooltips.

- **Wiring by page** (S6)
  Each page imports `SHORTCUTS.<section>` and `useHotkeys`, and passes handlers that reuse
  the functions already defined in the component (e.g. `handleStartConversion`). Where a
  button is `disabled`, the handler is a no-op or guarded the same way the button's
  `disabled` condition does, so `Ctrl+Enter` with no input file still does nothing.

- **Tooltip hints** (S8)
  For primary buttons (Convert start, Extract, Cut, Compress, Add Files, Clear logs), change
  `Tooltip title={t('...')}` to `title={shortcutHint('shortcuts.convert.start', SHORTCUTS.convert.start.keys)}`.
  Buttons already wrapped in `Tooltip` keep their wrapping; buttons without one get one only
  where it adds value (avoid noise).

## Files touched

| Area | File |
| --- | --- |
| New hook | `src/renderer/hooks/useHotkeys.ts` |
| New registry | `src/renderer/constants/shortcuts.ts` |
| New utils | `src/renderer/utils/shortcutHint.ts` |
| New component + styles | `src/renderer/components/ShortcutsHelpDialog.tsx`, `src/renderer/styles/ShortcutsHelpDialog.styles.ts` |
| Global wiring | `src/renderer/App.tsx` |
| Pages | `src/renderer/pages/Dashboard.tsx`, `Convert.tsx`, `MediaInfo.tsx`, `ImageCompress.tsx`, `AudioExtract.tsx`, `VideoCut.tsx`, `BatchQueue.tsx`, `Logs.tsx`, `Settings.tsx` |
| Player | `src/renderer/components/MediaPlayer.tsx` |
| i18n | `src/renderer/i18n/locales/*.json` (56 files) |
| Tests | `src/renderer/hooks/__tests__/useHotkeys.test.ts` (new), `src/renderer/components/__tests__/ShortcutsHelpDialog.test.tsx` (new), updates to `pages/__tests__/*.test.tsx` |
| Docs | `docs/KEYBOARD_SHORTCUTS_PLAN.md` |

## i18n keys

New top-level section `shortcuts` (inserted before the `convert` section in every locale,
UTF-8, scripted, then `validate:locales`). Structure:

- `shortcuts.help` — "Show shortcuts"
- `shortcuts.helpTitle` — "Keyboard Shortcuts"
- `shortcuts.nav` — "Go to {page}"
- `shortcuts.theme` — "Toggle theme"
- `shortcuts.groups.global` / `.convert` / `.mediaInfo` / `.image` / `.audio` / `.cut` /
  `.batch` / `.logs` / `.settings` / `.dashboard` — group headings
- `shortcuts.convert.openInput`, `.chooseOutput`, `.start`, `.pauseResume`, `.cancel`,
  `.cancelJob`, `.lossless`, `.preview`
- `shortcuts.mediaInfo.open`
- `shortcuts.image.openInput`, `.chooseOutput`, `.compress`, `.aspect`
- `shortcuts.audio.openInput`, `.chooseOutput`, `.extract`, `.pauseResume`, `.cancel`
- `shortcuts.cut.openInput`, `.chooseOutput`, `.cut`, `.pauseResume`, `.cancel`, `.cancelJob`,
  `.useDuration`, `.includeAudio`, `.play`, `.mute`, `.seekBack`, `.seekForward`
- `shortcuts.batch.add`, `.start`, `.pauseResume`, `.cancelAll`, `.clearCompleted`, `.export`,
  `.import`, `.condense`, `.search`, `.filterN`
- `shortcuts.logs.clear`, `.download`
- `shortcuts.dashboard.openN`

## Edge cases

- **Typing in a field:** bare keys (`L`, `P`, `U`, `A`, `K`, `C`, `F`, `1..6`, `Space`, arrows)
  are suppressed; modifier combos still run. `Ctrl+Enter` in a textarea is safe (native Enter
  still inserts a newline).
- **Modal open:** page shortcuts suspended; `Esc` closes the modal (MUI native) instead of
  triggering anything else.
- **Route change mid-job:** the page unmounts and its listeners are removed; the job keeps
  running in the store/main process exactly as it does today for button-driven jobs.
- **macOS:** `metaKey` used in place of `ctrlKey`; display shows `⌘`.
- **Accessibility:** shortcuts never remove focusability; the help dialog and tooltip hints
  make them discoverable without a manual. The batch reorder stays on its existing
  `KeyboardSensor`.
- **Repeated keys:** `event.repeat` guards one-shot actions so holding `Ctrl+Enter` does not
  stack conversions.
- **Localized apps:** shortcut *labels* are translated; the *combos* are language-independent.

## Verification

- `npx prettier --check "src/**/*.{ts,tsx,json}"`
- `npm run typecheck`
- `npm run lint`
- `npm run validate:locales`
- `npm test` (full suite incl. new hook/dialog tests and updated page tests)
