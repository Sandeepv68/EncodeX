# Close-Confirmation Plan

Guards the application window so that clicking the close button (custom title-bar X,
Alt+F4, taskbar close) first checks every page for jobs in progress. If any job is
active (Convert, Image Compress, Audio Extract, Video Cut, or the Batch Queue), the app
shows a confirmation dialog instead of closing immediately.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. Channels + log constants: add `WINDOW_CLOSE_REQUESTED ('window-close-requested')`
      (main → renderer) and `WINDOW_CONFIRM_CLOSE ('window-confirm-close')`
      (renderer → main) plus log constants.
- [x] C2. Main `window.ts`: intercept the BrowserWindow `close` event. Unless close was
      already confirmed, `preventDefault()` and push `WINDOW_CLOSE_REQUESTED` to the
      renderer (skip when webContents is destroyed/crashed so a dead renderer can never
      trap the window). Handle `WINDOW_CONFIRM_CLOSE` by marking close confirmed and
      re-invoking `win.close()`.
- [x] C3. Preload: expose `windowCloseConfirmed()` (`ipcRenderer.send`) and
      `onWindowCloseRequested(cb)` (subscribe → unsubscribe).
- [x] C4. Renderer types: declare both methods on `ElectronAPI` in
      `src/renderer/electron-api.d.ts`.
- [x] C5. Global task store: new `src/renderer/stores/taskStore.ts` mirroring
      `useMediaTask`'s `isConverting` flag so non-store pages (Image Compress, Video Cut)
      are visible to the close check.
- [x] C6. `useMediaTask`: sync its converting flag into the task store on every
      `runTask` start/finally.
- [x] C7. New `CloseConfirmDialog` component mounted in `AppLayout`. On
      `onWindowCloseRequested`: evaluate all stores; if none are active, immediately
      `windowCloseConfirmed()`; otherwise open the MUI `ConfirmDialog` (localized). Confirm
      → `windowCloseConfirmed()`; cancel/backdrop/Escape → stay open.
- [x] C8. i18n: add a `closeConfirm` section (title, message, confirmLabel, cancelLabel)
      to all 56 locale files (UTF-8, scripted insert, valid-JSON check).
- [x] C9. Tests: extend `main/ipc/__tests__/window.test.ts`, `preload/__tests__/index.test.ts`,
      `shared/__tests__/ipc-channels.test.ts`, `src/test-setup.ts`; add
      `CloseConfirmDialog.test.tsx` and `taskStore.test.ts`; update `useMediaTask` test.
- [x] C10. Verify: `npx prettier --check`, `npx tsc --noEmit -p tsconfig.json`,
      `npx vitest run`.

## Semantics: which jobs count as "in progress"

The close check queries the renderer stores that are the single source of truth for each
page's running job:

| Page | State checked |
| --- | --- |
| Convert | `useConversionStore.getState().isConverting` |
| Image Compress | `useTaskStore.getState().isConverting` (mirrored by `useMediaTask`) |
| Audio Extract | `useAudioExtractStore.getState().isConverting` |
| Video Cut | `useTaskStore.getState().isConverting` (mirrored by `useMediaTask`) + `useVideoCutStore.getState().isCutting` |
| Batch Queue | `useQueueStore.getState().jobs.some(j => j.status === 'queued' \|\| j.status === 'running')` |

Queue jobs with status `QUEUED` or `RUNNING` count because closing would cancel pending and
active work. Paused conversions still count (they are recoverable only while the app stays
open).

## Close lifecycle

1. Any close path (title-bar X → `WINDOW_CLOSE` → `win.close()`, Alt+F4, taskbar) fires the
   BrowserWindow `close` event.
2. Main `close` handler: `preventDefault()`, then push `WINDOW_CLOSE_REQUESTED`.
3. Renderer `CloseConfirmDialog` checks the stores:
   - No active jobs → `windowCloseConfirmed()` immediately (window closes, no dialog).
   - Active jobs → show `ConfirmDialog` with localized copy.
4. User confirms → renderer sends `WINDOW_CONFIRM_CLOSE` → main sets `closeConfirmed = true`
   and calls `win.close()`; the re-entered `close` event is allowed through.
5. User cancels → dialog closes; window and all jobs keep running.

Edge cases:
- Renderer crashed/destroyed: main skips the round-trip and lets the window close so a dead
  renderer can never block quitting.
- Repeated close clicks while the dialog is open: renderer just keeps the dialog open
  (idempotent).
- macOS Cmd+Q / `app.quit()`: routes through the same `close` event, so the guard applies.
- `beforeunload` (sessionCleanup) still runs normally once the window actually closes.

## Files touched

| Area | File |
| --- | --- |
| Channels/logs | `src/shared/ipc-channels.ts`, `src/shared/log-constants.ts` |
| Main | `src/main/ipc/window.ts` |
| Preload | `src/preload/index.ts` |
| Renderer types | `src/renderer/electron-api.d.ts` |
| Store | `src/renderer/stores/taskStore.ts` (new), `src/renderer/hooks/useMediaTask.ts` |
| Component | `src/renderer/components/CloseConfirmDialog.tsx` (new), `src/renderer/App.tsx` |
| i18n | `src/renderer/i18n/locales/*.json` (56 files) |
| Tests | `src/main/ipc/__tests__/window.test.ts`, `src/preload/__tests__/index.test.ts`, `src/shared/__tests__/ipc-channels.test.ts`, `src/test-setup.ts`, `src/renderer/hooks/__tests__/useMediaTask.test.ts`, `src/renderer/components/__tests__/CloseConfirmDialog.test.tsx` (new), `src/renderer/stores/__tests__/taskStore.test.ts` (new) |
| Docs | `docs/CLOSE_CONFIRMATION_PLAN.md` |

## i18n keys

New top-level section `closeConfirm` (inserted before the `convert` section in every locale):

- `closeConfirm.title` — "Close EncodeX?"
- `closeConfirm.message` — "One or more jobs are still in progress. Closing now will cancel them."
- `closeConfirm.confirmLabel` — "Close Anyway"
- `closeConfirm.cancelLabel` — "Cancel"

## Verification

- `npx prettier --check "src/**/*.{ts,tsx,json}"`
- `npx tsc --noEmit -p tsconfig.json`
- `npx vitest run` (full suite)
