# Modal/Dialog Unification Plan

Audit of renderer modals/dialogs in EncodeX to support a shared, consistent dialog implementation.

> **Note:** Historical audit snapshot. Dialog implementations and owning stores have changed since this inventory was taken; treat the tables as background, not a description of current code.

## Inventory

| Modal | File(s) | Purpose / owner | API shape | Layout | Size/scroll | Close behavior | A11y | Styling/test hooks |
|---|---|---|---|---|---|---|---|---|
| `ConfirmDialog` (base) | `src/renderer/components/ConfirmDialog.tsx` | Generic destructive/consequential confirm; parent-owned | `{open,title,message,confirmLabel,cancelLabel,confirmColor,onConfirm,onClose}` | `DialogTitle` + `DialogContent(DialogContentText)` + `DialogActions` (Cancel, Confirm contained) | MUI default (not fullWidth) | Backdrop/Escape -> `onClose` | No explicit `aria-labelledby/describedby`; paper `data-testid="confirm-dialog"` | Raw MUI `Dialog` |
| `CloseConfirmDialog` | `src/renderer/components/CloseConfirmDialog.tsx` | Guard app close when tasks/setting require confirm; store-derived (`taskStore`, `settingsStore`) | No props; renders `ConfirmDialog` or `null` | Reuses `ConfirmDialog` | Inherits base | Inherits base; confirm triggers `window.electronAPI.forceCloseWindow()` via bridge | Inherits base | Thin wrapper |
| `ProfileEditorDialog` | `src/renderer/components/ProfileEditorDialog.tsx`, `src/renderer/styles/ProfileEditorDialog.styles.ts` | Create/edit encoding profile; parent-owned + local form state | `{open,profile,defaults,onSave,onClose}` | Custom `EditorDialogTitle` (title + close `IconButton`) + `DialogContent` form (collapsible advanced) + `DialogActions` (Cancel, Save contained primary) | `maxWidth="sm" fullWidth` | Backdrop/Escape/X -> `onClose` (can discard edits) | Title close button has no `aria-label`; no dialog `aria-labelledby`; no testid | Styled title/stack/chevron (`EditorDialogTitle`, `EditorFieldStack`, `ExpandChevron`) |
| `QueueAddReviewDialog` | `src/renderer/components/QueueAddReviewDialog.tsx`, `src/renderer/styles/QueueAddReviewDialog.styles.ts` | Review per-file ops before batch add; parent-controlled state | `{open,files,fileOps,defaultOperation,defaultPreset,outputDirPrefix,editOptionsOnOpen,onFileOpChange,onSaveOptions,onCancel,onConfirm}` | `DialogTitle` + `DialogContent` (intro + switch + per-file select/edit rows) + `DialogActions` (Cancel, Add) | `maxWidth="sm" fullWidth`; file list `maxHeight: 320px` scroll (`ReviewList`) | Backdrop/Escape -> `onCancel` | No explicit aria ids/testid | Mix raw Dialog + styled `ReviewList/Row/FileName/OperationSelect` |
| `QueueJobOptionsDialog` | `src/renderer/components/QueueJobOptionsDialog.tsx` | Edit one queued job’s options; parent-owned + local draft loaded on open | `{open,job,outputPath,presets,onSave,onClose}` | `DialogTitle` (includes filename) + `DialogContent` (`QueueItem`) + `DialogActions` (Cancel, Save contained) | `maxWidth="md" fullWidth` | Backdrop/Escape -> `onClose` | No explicit aria ids/testid | Raw MUI components |
| `ShortcutsHelpDialog` | `src/renderer/components/ShortcutsHelpDialog.tsx`, `src/renderer/styles/ShortcutsHelpDialog.styles.ts` | Read-only shortcuts reference; parent-controlled visibility | `{open,onClose}` | `DialogTitle` + absolutely positioned close `IconButton` + `DialogContent` (sectioned rows) | Styled paper `width: 480px, maxWidth: 90vw`; content `maxHeight: 480px` scroll | Backdrop/Escape/X -> `onClose` | `aria-labelledby="shortcuts-help-title"`, close button `aria-label` + `data-testid="shortcuts-help-close"`, paper `data-testid="shortcuts-help-dialog"` | Fully styled wrapper (`ShortcutsDialog`, content/rows/key chips) |
| `TermsDialog` | `src/renderer/components/TermsDialog.tsx`, `src/renderer/styles/TermsDialog.styles.ts` | Global terms gate/viewer; `useTermsStore` owns open/mode/actions | No props (store-driven) | `DialogTitle` + `DialogContent` (mapped sections + last updated) + `DialogActions` mode-dependent (Accept: Reject error contained + Accept primary contained w/ icons & testids; View: Close) | Styled paper `width: 560px, maxWidth: 92vw`; content `maxHeight: 520px` scroll | Accept mode blocks backdrop/Escape via no-op `onClose`; View mode closable | Paper `data-testid="terms-dialog"`, action testids in accept mode; no explicit title/content ids | Styled dialog/content/typography |
| `UpdateDialog` | `src/renderer/components/UpdateDialog.tsx`, `src/renderer/styles/UpdateDialog.styles.ts` | Global updater state machine UI; `useUpdateStore` owns state/actions | No props (store-driven) | `DialogTitle` + dynamic `DialogContent` (checking/available/progress/downloaded/scheduled/error) + dynamic `DialogActions` with icons | `maxWidth="sm" fullWidth`, content `minWidth: 380px`; release notes `maxHeight: 180px` scroll | `onClose` always closes dialog (does not cancel download; "background" path explicit); status-specific buttons also call store actions | Paper `data-testid="update-dialog"`; no explicit aria ids | Raw `Dialog` + styled content/progress/status pieces |
| Reset conversation dialog (inline) | `src/renderer/components/copilot/ChatInput.tsx` | Confirm destructive reset (optionally save+reset); local component state | Internal (composer props: `showReset`, `onResetConversation`, `onSaveAndResetConversation`) | `DialogTitle` + `DialogContent(DialogContentText)` + `DialogActions` (Cancel, optional Save & Reset, Reset error contained w/ ref focus) | MUI default | Backdrop/Escape -> close local dialog only | `aria-labelledby` + `aria-describedby`; focus moved to confirm via effect | Raw inline `Dialog` (no testid) |
| Open saved chat confirm (inline) | `src/renderer/pages/Copilot.tsx` | Resolve conflict when opening saved chat over active unsaved transcript; page-local `pendingChat` | Internal (`pendingChat` state/handlers) | `DialogTitle` + `DialogContent(DialogContentText)` + `DialogActions` (Cancel, Discard error, Save & open contained) | MUI default | Backdrop/Escape -> cancel (keeps current chat) | `aria-labelledby`; `data-testid="open-chat-confirm"` and action testids | Raw inline `Dialog` |

**Other dialog/modal-related usages (not primary app dialogs):** `NavJobPopover`/`AppDrawer` contain `.MuiModal-root`-related focus/z-index handling; not candidates for dialog unification.

## Key differences

- **Ownership:** global stores (`TermsDialog`, `UpdateDialog`), store-derived conditional render (`CloseConfirmDialog`), parent-controlled forms/state (`ProfileEditorDialog`, `QueueAddReviewDialog`, `QueueJobOptionsDialog`), parent-controlled stateless (`ShortcutsHelpDialog`), component/page-local inline confirms (`ChatInput`, `Copilot`).
- **API consistency:** only `ConfirmDialog` is reusable; others are bespoke props or store-coupled; inline dialogs lack a component boundary/API.
- **Sizing/scroll:** ad hoc per dialog (`sm/md` + `fullWidth`, custom paper widths 480/560, various `maxHeight` scroll regions, `UpdateDialog` content `minWidth: 380`).
- **Close semantics:** normal dismiss (`onClose`), explicit cancel callbacks, and special blocking/background behaviors (`TermsDialog` accept-mode no-op, `UpdateDialog` close backgrounds download) implemented differently.
- **Structure/actions:** some have title close-X (`ProfileEditorDialog`, `ShortcutsHelpDialog`) others do not; action order/variants/icons/colors vary (e.g. destructive contained, split behaviors in `UpdateDialog`, save+reset only in ChatInput).
- **Accessibility/testability:** inconsistent `aria-labelledby`/`aria-describedby`, missing close-button label (`ProfileEditorDialog`), uneven `data-testid`/paper slot usage.
- **Styling:** mix of raw MUI and styled wrappers; shared patterns (scrolling body, titled header with close affordance, confirm layout) are reimplemented.

## Unification recommendations

### 1. Shared dialog shell
Introduce an `AppDialog`/`DialogShell` (`Dialog` + paper/title/content/actions slots) with props such as:
- `open`, `onClose`, `title`, `description?`
- `titleId` / `descriptionId` (auto-generated defaults)
- `size` preset (`sm|md|lg` or app tokens) + `fullWidth`/`maxWidth`
- `scroll`, `disableDismiss` or explicit dismiss policy/reason handling
- `showCloseButton` (+ `closeButtonLabel`), `paperTestId`, action slot/test hooks

Centralize MUI slot wiring, sizing, title/close layout, and default a11y attributes.

### 2. Standardized confirm dialog
Extend or layer on `ConfirmDialog` to cover inline confirms:
- optional description id, icon/startIcon, configurable actions (`cancel`, optional secondary, primary/destructive)
- loading/busy/disabled states
- extract `ChatInput` reset-confirm and `Copilot` open-chat confirm into reusable confirm variants

### 3. Explicit behavior contracts
- Encode **blocking** dialogs (Terms accept) and **close-but-continue** flows (Update download) in the shell/API instead of custom no-op/overloaded handlers.
- Document discard-risk closes for editable dialogs (`ProfileEditorDialog`, `QueueJobOptionsDialog`, review flows) and make cancel vs dismiss behavior consistent.

### 4. Accessibility and test parity
- Always wire `aria-labelledby`/`aria-describedby`.
- Require `aria-label` for icon-only close buttons.
- Standardize `data-testid` on paper and key actions where tests depend on them; preserve existing ids (`confirm-dialog`, `terms-*`, `update-dialog`, `shortcuts-help-*`, `open-chat-*`, etc.).

### 5. Consolidated styling
- Move repeated scroll/body sizing and action patterns into shell/style primitives.
- Keep domain-specific content (`Terms` sections, `Update` state UI, queue editors, shortcuts list) as children.

## Proposed dialog layout

Standardize all dialogs on a consistent three-section layout:

- **Header row:** modal title with an appropriate leading icon and a trailing close button.
- **Body/content row:** modal body content (scrollable as needed).
- **Footer row:** action buttons.

Each section is separated by a horizontal rule (`Divider`).

### Shell/API implications

- **Header:** `title`, `icon` (or a resolved per-dialog icon), `showCloseButton`/`onClose`, and `closeButtonLabel` (for accessible icon-only close).
- **Body:** `children`/content slot for dialog-specific content.
- **Footer:** `actions` slot/props for action buttons with consistent alignment and ordering.
- **Structure:** the shared shell renders header, body, and footer with `Divider` separators by default so domain dialogs supply icon, content, and actions without reimplementing layout/chrome.

## Migration plan (suggested order)

1. **Extract inline dialogs (low risk):** `Copilot` open-chat confirm and `ChatInput` reset dialog -> shared confirm(s) with parity tests.
2. **Unify base confirm:** adopt improved `ConfirmDialog`/shell in `CloseConfirmDialog` and any other simple confirms.
3. **Simple/structured dialogs:** migrate `ShortcutsHelpDialog`, `ProfileEditorDialog`, `QueueAddReviewDialog`, `QueueJobOptionsDialog` to shell while preserving behavior and existing test hooks.
4. **Store-driven/special-behavior dialogs:** migrate `TermsDialog` and `UpdateDialog` last, encoding blocking and close-but-continue semantics explicitly; verify with existing dialog tests.
5. **Cleanup:** remove duplicate dialog styles/patterns, align action ordering/colors, and document dialog usage guidelines for future additions.