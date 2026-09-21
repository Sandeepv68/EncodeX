# EncodeX — Background Update Experience Plan

**Author:** Update UX review (Sep 2026) · **Status:** In progress · **Tracking doc:** this file
**Scope:** `src/main/updater.ts`, `src/main/ipc/updater.ts`, `src/main/index.ts`, `src/shared/types.ts`, `src/shared/ipc-channels.ts`, `src/shared/log-constants.ts`, `src/preload/index.ts`, `src/renderer/electron-api.d.ts`, `e2e/mocks/preload.js`, `src/renderer/stores/updateStore.ts`, `src/renderer/components/Footer.tsx`, `src/renderer/components/UpdateDialog.tsx`, `src/renderer/styles/Footer.styles.ts`, `src/renderer/i18n/locales/*.json`, tests.

---

## 1. Background / current state

| # | Finding | Impact |
|---|---------|--------|
| 1 | `UpdateDialog.handleClose` refuses to close while `status === 'downloading'`; the MUI `Dialog` is modal | User is pinned for the whole download |
| 2 | Footer only shows a spinner (checking) or a link (available); no progress / downloaded state | No feedback while working |
| 3 | After download there is a single "Install & Restart" path (`installUpdate`) | No "apply on next restart" option |
| 4 | Download runs in main and already pushes `update-progress`; UI is the gap | Heavy lifting already exists |

## 2. Target UX

1. User clicks **Download** (dialog, toast, or footer).
2. Once download starts, the dialog gains a **"Continue in background"** action; closing it no longer cancels.
3. The **footer shows a compact, always-visible download widget**: thin progress bar, `v{{version}} — 34%`, a cancel button; clicking it reopens the dialog.
4. On completion, feedback is shown (footer banner + toast) with two choices: **"Install & Restart"** (apply now) or **"Install on Next Restart"** (schedule) plus **"Later"** (keep banner).
5. On "on next restart", main persists a marker; the footer shows "will install on next restart" with a **Cancel** action. On the next launch, main auto-runs the installer and quits before the window opens.

## 3. State machine

Extend `UpdateStatus` with `restart-scheduled`. New store fields: `restartScheduled: boolean`, `backgrounded: boolean`.

```
available ──download──▶ downloading ──complete──▶ downloaded
                     ▲                              │
                     │ cancel                        ├─▶ restart-scheduled ──install/cancel──▶ (installer runs / available)
                     └───────────────────────────────┘
downloaded ──later/else──▶ (stays downloaded, banner remains)
```

Transitions:
- `available → downloading`: dialog may be dismissed freely; download keeps running (background).
- `downloading → downloaded`: footer switches to action banner; one-time completion toast.
- `downloaded → restart-scheduled`: marker persisted in main.
- `downloaded`/`restart-scheduled → available`: download cancelled / scheduled install cancelled.
- Store mount: hydrate via `getPendingInstall()` so a scheduled install that survived a failed auto-run reappears in the footer.

## 4. Detailed changes

### CP1 — shared contracts
- `src/shared/types.ts`: add `PendingInstall { installerPath: string; version: string }`.
- `src/shared/ipc-channels.ts`: add `SCHEDULE_RESTART_INSTALL`, `CANCEL_RESTART_INSTALL`, `GET_PENDING_INSTALL`.
- `src/shared/log-constants.ts`: add updater log constants (schedule, cancel, pending read, auto-install).

### CP2 — main process
- `src/main/updater.ts`:
  - `scheduleInstallOnRestart(installerPath, version)` → persists `userData/pending-install.json` (JSON pattern mirrors `src/main/monitoring/consent.ts`).
  - `cancelRestartInstall()` → removes marker.
  - `readPendingInstall()` → tolerant read (missing/corrupt file ⇒ null).
  - `autoInstallPendingUpdate()` → when marker valid (file exists, version ≠ current), `shell.openPath` + `app.quit`; always clears the marker (single fire).
  - `installUpdate()` clears the marker before launching (apply-now).
- `src/main/ipc/updater.ts`: register the three new handlers.
- `src/main/index.ts`: GUI-mode `whenReady()` calls `autoInstallPendingUpdate()` before creating windows. CLI/MCP modes skip it.

### CP3 — preload / bridge
- `src/preload/index.ts`: expose `scheduleInstallOnRestart(installerPath)`, `cancelRestartInstall()`, `getPendingInstall()` (invoke-based).
- `src/renderer/electron-api.d.ts`: mirror the three signatures.
- `e2e/mocks/preload.js`: stub the three methods + `__test.setPendingInstall` for specs.

### CP4 — renderer store
- `src/renderer/stores/updateStore.ts`:
  - Fields `restartScheduled`, `backgrounded`.
  - Actions `installOnRestart()`, `cancelRestartInstall()`, `backgroundDownload()`, mount-time `getPendingInstall()` hydration.
  - `UPDATE_DOWNLOADED` sets `status: 'downloaded'`; Footer consumes one-time completion signal for the toast.

### CP5 — footer widget
- `src/renderer/components/Footer.tsx`:
  - `downloading`: thin determinate `LinearProgress` + `v{{version}} — {{percent}}%` + cancel icon; click opens dialog.
  - `downloaded`: "v{{version}} ready" + **Install & Restart** + **On Next Restart** buttons.
  - `restart-scheduled`: "will install on next restart" + **Cancel**.
  - Keep existing available link + checking spinner. Fire completion toast on `downloaded`.
- `src/renderer/styles/Footer.styles.ts`: `UpdateWidget`, `UpdateProgressBar`, `UpdateActionButton` (compact, footer-height aware).

### CP6 — update dialog
- `src/renderer/components/UpdateDialog.tsx`:
  - `handleClose` no longer guards `downloading`; button becomes **Continue in background** + **Cancel Download**.
  - `downloaded`: **Install & Restart** (primary) + **Install on Next Restart** + **Later**.
  - `restart-scheduled`: confirmation copy + **Cancel** / **Install Now**.

### CP7 — i18n
- `src/renderer/i18n/locales/en-US.json`: add `footer.*`/`update.*`/`toast.*` keys listed above.
- Run `npm run validate:locales` (other locales fall back to the key; follow-on translation is out of scope).

## 5. Edge cases / failure handling

| Case | Handling |
|------|----------|
| App quits mid-download | Temp file overwritten on re-download (`createWriteStream` truncates); acceptable |
| Installer missing at restart | `autoInstallPendingUpdate()` clears marker silently; footer only re-offers on a new check |
| Cancel during background download | Existing `cancelDownload()` path; store → `available`, widget hidden |
| Marker for already-installed version | Version check skips auto-run |
| Repeated launch loop | Marker is single-fire (cleared before `openPath`) |
| Download error in background | Store → `error`; footer warning opens dialog (retry) |

## 6. Testing

- Unit: `src/main/__tests__/updater.test.ts` (new persistence + auto-install cases), `src/renderer/stores/__tests__/updateStore.test.ts`, `src/renderer/components/__tests__/Footer.test.tsx`, `src/renderer/components/__tests__/UpdateDialog.test.tsx`.
- e2e via mock preload: drive `update-progress` / `update-downloaded`; click "Install on Next Restart".
- Checks: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run validate:locales`, `npm run format:check`.

## 7. Out of scope (optional follow-ups)

- Resumable downloads (`Range` + `ETag`) so a background download survives an app quit.
- Cross-launch notification of auto-install result (main quits before a renderer exists).

## 8. Checkpoint tracker

| CP | Checkpoint | Status | Verified by |
|----|-----------|--------|-------------|
| 1 | Shared contracts (types, IPC channels, log constants) | pending | typecheck green |
| 2 | Main process (updater + IPC + index hookup) | pending | unit tests + typecheck |
| 3 | Preload bridge + e2e mock | pending | preload typecheck |
| 4 | Renderer store | pending | updateStore tests |
| 5 | Footer widget + styles | pending | Footer tests |
| 6 | Update dialog actions | pending | UpdateDialog tests |
| 7 | i18n keys + locale validation | pending | validate:locales green |
| 8 | Full verification suite | pending | test/typecheck/lint/format green |

Legend: `done` / `in-progress` / `pending` / `blocked` / `cancelled`