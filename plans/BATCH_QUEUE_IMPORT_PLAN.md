# Batch Queue Import Plan — Multi-file + whole-folder batch import

Tracking document for adding multi-file and whole-folder import to the Batch
Queue page. Each task lists the files touched, the concrete steps, a
verification checkpoint, and its status. Status legend: `[ ]` not started,
`[~]` in progress, `[x]` done, `[-]` skipped.

**Decisions (confirmed with user):**
- Folder import **recurses into subfolders**.
- UI is a **merged picker**: one button opens a menu with "Add Files" and
  "Add Folder".
- Dragging a **folder** onto the page also imports its media files.

**Context:** `select-files` (`openFile` + `multiSelections`) already exists and
the BatchQueue "Add Files" button already multi-selects; the gap is whole-folder
import (the only `openDirectory` dialog today is for the *output* folder) and
folder drag-drop. Electron forbids combining `openFile` and `openDirectory` in
one dialog, so folder import is its own `openDirectory` flow.

---

## Task 1 — IPC channels
Status: `[x]` — done

**Problem:** No renderer→main channel exists for picking a source folder and
returning its media files, nor for expanding a mixed file/directory path list.

**Steps**
- [x] `src/shared/ipc-channels.ts`: add `SELECT_FOLDER_FILES: 'select-folder-files'`
      and `EXPAND_PATHS: 'expand-paths'` to the `IPC` const (near `SELECT_FILES`).
- [x] `src/shared/log-constants.ts`:
  - IPC side (near line 407): `LOG_IPC_SELECT_FOLDER_FILES_CALLED` /
    `LOG_IPC_SELECT_FOLDER_FILES_RESULT` / `LOG_IPC_EXPAND_PATHS_CALLED` /
    `LOG_IPC_EXPAND_PATHS_RESULT`.
  - Preload side (near line 630): `LOG_SELECT_FOLDER_FILES_CALLED` /
    `LOG_EXPAND_PATHS_CALLED`.

**Checkpoint:** `npx tsc -p tsconfig.shared.json --noEmit` green. (Passed via
`npm run typecheck:main`/renderer in final verification.)

---

## Task 2 — Recursive media collector in main
Status: `[x]` — done

**Problem:** CLI's `expandInputs` directory branch
(`src/main/cli/cli-util.ts:73-89`) is non-recursive and CLI-scoped; batch import
needs a recursive, media-only scan of an arbitrary directory.

**Steps**
- [x] New helpers in `src/main/media-files.ts`:
  - `collectMediaFiles(root): string[]` — depth-first walk, skips symlinks and
    unreadable entries, keeps files whose extension is in
    `FILE_EXTENSIONS.MEDIA_INPUT`, returns normalized/sorted/unique absolute paths.
  - `expandMediaPaths(paths): string[]` — walks directories via `collectMediaFiles`
    and passes through media files directly.
  - `isDirectory(candidate): boolean` — stat-based directory check.
- [x] 5 unit tests in `src/main/__tests__/media-files.test.ts` (basic walk,
      symlink handling, extension filtering, unreadable entries tolerated,
      expand paths).

**Checkpoint:** All 5 helper tests green.

---

## Task 3 — IPC handlers
Status: `[x]` — done

**Problem:** No handlers bridge the new channels to the native folder dialog and
the collector.

**Steps**
- [x] `src/main/ipc/dialogs.ts`:
  - register `IPC.SELECT_FOLDER_FILES`: `dialog.showOpenDialog(win, {
    properties: ['openDirectory'] })` → on selection return
    `collectMediaFiles(dir)`; cancelled → `[]`.
  - register `IPC.EXPAND_PATHS`: accepts `string[]` paths; for each path
    `fs.statSync` — directories → `collectMediaFiles`, files → keep if the
    extension is a media input extension; return deduped sort.
  - log calls/results with the new constants; honor `realTierPreset`
    (`E2E_REAL_INPUT_FILE`) for the folder flow like the other handlers.
- [x] Wire registration in `src/main/ipc/handlers.ts`.

**Checkpoint:** `npx tsc -p tsconfig.main.json --noEmit` green.

---

## Task 4 — Preload bridge + API types
Status: `[x]` — done

**Problem:** The renderer has no typed access to the new channels.

**Steps**
- [x] `src/preload/index.ts`:
  - `selectFolderFiles(): Promise<string[]>` → `invoke(IPC.SELECT_FOLDER_FILES)`;
  - `expandPaths(paths: string[]): Promise<string[]>` → `invoke(IPC.EXPAND_PATHS, paths)`;
  - log with the new preload constants.
- [x] `src/renderer/electron-api.d.ts`: declare both methods with JSDoc, near
      `selectFiles`/`selectDirectory`.

**Checkpoint:** `npx tsc -p tsconfig.renderer.json --noEmit` green.

---

## Task 5 — Merged picker UI in the toolbar
Status: `[x]` — done

**Problem:** The single "+ Add Files" icon button has no way to pick a folder.

**Steps**
- [x] `src/renderer/components/types.ts`: add `onAddFolder: () => void` to
      `BatchControlsProps`.
- [x] `src/renderer/components/BatchControls.tsx`: replaced the
      lone `OutlinedIconButton` with a merged-picker group:
  - `OutlinedIconButton` as menu anchor (plus icon + `DropdownChevron`), opening an MUI `Menu`;
  - `MenuItem` "Add Files" (`onAddFiles`) and
    `MenuItem` "Add Folder" (`onAddFolder`);
  - `aria-haspopup`, `aria-expanded` set on the anchor for accessibility.
- [x] `src/renderer/styles/BatchControls.styles.ts`: added `DropdownChevron` styled component.
- [x] Updated BatchControls tests — 31 tests pass.

**Checkpoint:** `npm run lint` and typecheck green; 31 BatchControls unit tests pass.

---

## Task 6 — BatchQueue wiring + folder-aware drag-drop
Status: `[x]` — done

**Problem:** The page never calls the new folder API and dropped folders are
treated as invalid files.

**Steps**
- [x] `src/renderer/pages/BatchQueue.tsx`:
  - `handleAddFolder()`: `const files = await window.electronAPI.selectFolderFiles();
    if (files && files.length) setReviewFiles(files);` — reuses the existing
    review dialog + `enqueueSelections` unchanged.
  - pass `onAddFolder={handleAddFolder}` to `<BatchControls>`.
  - `handleDrop`: collects dropped paths via `getPathForFile`,
    then `const mediaFiles = await window.electronAPI.expandPaths(paths)` and
    enqueues the expanded media list; warns via toast when a drop yields zero
    media files.
- [x] `Ctrl+O` shortcut unchanged ("Add Files" only).

**Checkpoint:** `npm run lint` + typecheck green; 81 BatchQueue unit tests pass.

---

## Task 7 — i18n
Status: `[x]` — done

**Problem:** "Add Folder" menu item has no localized label.

**Steps**
- [x] `src/renderer/i18n/locales/en-US.json` (`batchQueue` block):
      added `"addFolder": "Add Folder"` and `"noMediaFound": "No media files found"` next to `addFiles`. Other locales fall
      back to en-US.
- [x] No `NO_HARDCODED_STRINGS` lint rule trips on the new UI string.

**Checkpoint:** `npm run lint` green.

---

## Task 8 — Verdict + full verification
Status: `[x]` — done

**Steps**
- [x] Updated this doc's statuses and added result notes per task.
- [x] `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
- [x] `npx tsc -p tsconfig.renderer.json --noEmit`, `-p tsconfig.main.json`,
      `-p tsconfig.preload.json` all green.
- [x] All unit suites pass: BatchQueue (81/81), BatchControls (31/31),
      media-files helper (5/5).
- [ ] Manual smoke (not automated): pick folder via menu → files staged in
      review dialog; drag a folder → jobs appear; drag files only → unchanged.