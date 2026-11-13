# Desktop (Taskbar/OS) Notifications � Implementation Plan

> **Status:** Implemented (v1 core) � 2026-11-13  
> **Progress legend:** `[x]` done � `[~]` partial/deferred � `[ ]` not started

## Implementation progress (summary)
- [x] Shared setting/storage key and IPC channels (`src/shared/constants.ts`, `src/shared/ipc-channels.ts`)
- [x] Main notifier service with support check, focus policy, dedupe, click-to-focus (`src/main/notifications/notifier.ts`)
- [x] Windows AUMID set early in main (`src/main/index.ts`)
- [x] Main IPC handlers for get/set settings + registration (`src/main/ipc/notifications.ts`, `src/main/ipc/handlers.ts`)
- [x] Notifier initialized with main window getter in GUI bootstrap (`src/main/index.ts`)
- [x] Batch queue integration: per-job DONE/ERROR notifications + drained summary (`src/main/ipc/queue.ts`)
- [x] Mux queue integration: per-job DONE/ERROR notifications + drained summary (`src/main/ipc/mux-queue.ts`)
- [x] Preload bridge + renderer typings (`src/preload/index.ts`, `src/renderer/electron-api.d.ts`)
- [x] Renderer settings store: persisted flag, setter, startup sync to main (`src/renderer/stores/settingsStore.ts`, `src/renderer/stores/types.ts`)
- [x] Settings UI toggle (`src/renderer/pages/Settings.tsx`)
- [x] i18n: settings keys added to `en-US` and synced to all locales (`npm run sync:locales`, `validate:locales` pass)
- [~] Notification message localization in main � v1 uses English strings in main process (no main-side i18n resolver yet); `notifications.*` locale keys not added
- [~] Click-to-navigate to queue on notification click � not implemented (focus/restore only)
- [ ] Dedicated unit/integration tests for notifier and queue notification triggers
- [ ] README/wiki/features/changelog documentation updates
- [ ] Manual cross-platform QA (Windows/macOS/Linux packaged builds)

## 1. Summary

Add opt-in, cross-platform desktop notifications (Windows toast/Action Center, macOS Notification Center, Linux desktop notifications) for EncodeX using Electron�s main-process [`Notification`](https://www.electronjs.org/docs/latest/api/notification) API.

**v1 goals**
- Notify users about **batch queue** and **mux queue** terminal outcomes when work completes in background.
- Integrate with existing **settings persistence + IPC** patterns.
- Be **safe, non-blocking, deduped**, and fully **i18n-ready**.
- No new runtime dependencies.

**Non-goals (v1)**
- CLI/MCP notifications.
- Per-event granular matrix beyond a single enable toggle (can be phase 2).
- Custom sounds/actions/buttons, progress notifications, tray icon features.
- Replacing existing in-app toast/snackbar system (notifications complement it).

---

## 2. Current architecture facts (must understand before coding)

- **Electron app:** `package.json` (`main: dist/main/index.js`, electron-builder `appId: com.encodex.app`).
- **Main bootstrap:** `src/main/index.ts` creates windows, registers IPC via `registerIpcHandlers(win, send)` (`src/main/ipc/handlers.ts`), boots monitoring/analytics/MCP settings.
- **IPC constants/types:** `src/shared/ipc-channels.ts`, guards/types in `src/shared/*` and preload.
- **Preload bridge:** `src/preload/index.ts` exposes `window.electronAPI` with invoke/send + `ipcRenderer.on` subscriptions; types mirrored in renderer electron-api typings (locate `electron-api.d.ts` / `src/renderer` types and keep in sync).
- **Batch queue:** `src/main/ipc/queue.ts` creates `JobQueue`, handles `IPC.QUEUE_*`, forwards events via `send(...)`: `QUEUE_ADDED/REMOVED/STATUS_CHANGE/PROGRESS/CANCELLED/MOVED`. Has `whenDone` config, `drained`/cancel semantics, `registerQueueSnapshotClear`, and module-level when-done state.
- **Mux queue:** `src/main/ipc/mux-queue.ts` similar with `MUX_QUEUE_*`.
- **Queue models:** `src/main/queue/job-queue.ts`, `src/main/queue/mux-queue.ts`, `src/main/queue/persistence.ts`, shared types in `src/shared/types.ts`.
- **Settings (renderer):** `src/renderer/stores/settingsStore.ts` persists flags to localStorage (e.g. always-on-top, launch-at-login, queue concurrency, MCP) and syncs to main via `window.electronAPI.*` / `fireAndForgetBridge` / `bridgePromise`.
- **Settings UI:** `src/renderer/pages/Settings.tsx` (note: not `SettingsPage.tsx`).
- **Locales:** `src/renderer/i18n/locales/*.json` (56 locales) + validation/sync scripts in `package.json` (`sync:locales`, `validate:locales`, `validate:locale-usage`).
- **Main logging:** `Logger` from `src/shared/logger` and log constants in `src/shared/log-constants.ts`.
- **No existing OS notifications:** no `new Notification`, `Electron.Notification`, or notifier deps currently.

**Important:** Notifications must be created/shown from the **main process** (reliable across platforms and when renderer state varies). Renderer may only toggle settings/request behavior via IPC.

---

## 3. UX and behavior specification (v1)

### 3.1 Setting
- [x] Add **�Desktop notifications�** toggle in Settings (System/Behavior area).
- [x] **Default:** `false` (opt-in). Persisted and applied immediately.
- [x] Description shown in UI; notes OS permissions/DND are OS-controlled.

### 3.2 Trigger policy
- [x] **Only when enabled** in settings.
- [x] Notify when `!mainWindow.isFocused() || mainWindow.isMinimized()` (best-effort policy in notifier).
- [x] **Never throw** to caller paths; failures are caught.

### 3.3 Events to notify (v1)

#### Batch queue (`JobQueue` / `src/main/ipc/queue.ts`)
- [x] **Job terminal:** notify on transitions to `DONE` or `ERROR` (not cancelled) with file basename and dedupe key per job/status.
- [x] **Queue drained summary:** one summary notification on natural drain with succeeded/failed counts when `succeeded + failed > 0`.
- [x] No per-progress notifications.

#### Mux queue (`MuxQueue` / `src/main/ipc/mux-queue.ts`)
- [x] Job `done/error` terminal notifications with input basename.
- [x] Drained summary notification with succeeded/failed counts.

### 3.4 Notification content
- [x] **Title/body:** concise localized strings resolved in main via `tNotification` with locale JSON lookup and English fallbacks (app name + event text with basename/counts).
- [x] **Localized content:** settings labels/hints and `notifications.*` content keys localized and synced across locales.
- [x] **Click:** focus/show/restore main window.
- [x] Navigate to Batch Queue on click via `NOTIFICATIONS_CLICKED` payload and renderer handler.

### 3.5 Platform notes
- [x] **Windows:** `app.setAppUserModelId('com.encodex.app')` set early (win32).
- [x] **macOS/Linux:** best-effort via `Notification.isSupported()` guard and try/catch.

---

## 4. Data & settings design

- [x] `desktopNotificationsEnabled` default `false` in renderer store; persisted to localStorage key `encodex-desktop-notifications`.
- [x] Main receives enabled state via IPC and holds runtime state in notifier; renderer syncs stored value to main on startup.
- [x] IPC channels: `NOTIFICATIONS_GET_SETTINGS`, `NOTIFICATIONS_SET_ENABLED` returning `{ enabled, supported }`.
- [x] Preload methods and renderer `electron-api` typings added.
- [x] Settings store read/persist helpers, state, setter, and startup sync implemented.
- [x] Settings UI toggle added in `src/renderer/pages/Settings.tsx`.

---

## 5. Main-process implementation

- [x] `src/main/notifications/notifier.ts`: `initNotifier/getNotifier`, support check, enabled state, focus policy, dedupe TTL, notify + click focus.
- [x] `src/main/ipc/notifications.ts`: get/set handlers registered in `registerIpcHandlers`.
- [x] `src/main/index.ts`: notifier initialized with `getMainWindow`.
- [x] Batch and mux queue status/drain hooks wired to notifier.
- [x] i18n in main: `src/main/notifications/strings.ts` resolves `notifications.*` strings from locale files with `app.getLocale()` fallback and English defaults.

---

## 6. Localization keys

- [x] Added to `en-US.json`: `settings.desktopNotifications`, `settings.desktopNotificationsHint`, and `notifications.*`.
- [x] Synced to all locale files via `npm run sync:locales`; `npm run validate:locales` passes.
- [x] `notifications.*` keys (titles/bodies/summaries) used by main-resolved localized messages.

---

## 7. Logging and error handling

- [x] Notifier paths wrapped in try/catch; queue flow unaffected.
- [x] Dedicated notification-specific log constants added (`src/shared/log-constants.ts`) and used in settings store, preload, and notification IPC.

---

## 8. Testing plan

- [x] Unit tests for notifier behavior (`src/main/notifications/notifier.test.ts`).
- [x] Dedicated renderer settings-store/preload notification unit tests added (`src/renderer/stores/__tests__/settingsStore.test.ts`, `src/preload/__tests__/index.test.ts`).
- [x] Queue/mux notification wiring tests asserting notify on terminal transitions/drain (`src/main/ipc/__tests__/queue-notifications.test.ts`, `src/main/ipc/__tests__/mux-queue-notifications.test.ts`).
- [ ] Manual QA on Windows/macOS/Linux (dev + packaged) - not run in this environment.

**Validation run (automated):**
- [x] `npm run typecheck:main`
- [x] `npm run typecheck:preload`
- [x] `npm run typecheck:renderer`
- [x] `npm run lint`
- [x] `npm run validate:locales`
- [x] `npm run test:unit -- src/main/notifications/notifier.test.ts src/main/ipc/__tests__/queue-notifications.test.ts src/main/ipc/__tests__/mux-queue-notifications.test.ts`

---

## 9. Documentation updates

- [x] `README.md` feature mention added.
- [x] `docs/FEATURES.md`, `wiki/Features.md` updated (other docs/localized mirrors reconciled via doc-drift markers as applicable).
- [x] `CHANGELOG.md` unreleased entry added.
- [x] Core docs updated and doc-drift markers aligned across tracked doc trees.

---

## 10. File-by-file implementation checklist

- [x] `src/shared/constants.ts` - storage key.
- [x] `src/shared/ipc-channels.ts` - channels + usage.
- [x] `src/shared/log-constants.ts` - notification-specific log constants added.
- [x] `src/shared/types.ts` - shared notification payload/settings types added (`DesktopNotificationsSettings`, `NotificationClickPayload`).
- [x] `src/main/notifications/notifier.ts` (new).
- [x] `src/main/notifications/strings.ts` (new, main-side localized string resolution).
- [x] `src/main/ipc/notifications.ts` (new).
- [x] `src/main/ipc/handlers.ts` - registration.
- [x] `src/main/index.ts` - AUMID + notifier init.
- [x] `src/main/ipc/queue.ts` - terminal/drain notifications.
- [x] `src/main/ipc/mux-queue.ts` - terminal/drain notifications.
- [x] `src/preload/index.ts` - bridge methods including click subscription (typed, logged).
- [x] `src/renderer/electron-api.d.ts` - typings using shared notification types.
- [x] `src/renderer/stores/types.ts` & `src/renderer/stores/settingsStore.ts` - state/persistence/sync with log constants.
- [x] `src/renderer/pages/Settings.tsx` - UI toggle.
- [x] `src/renderer/App.tsx` - notification click navigation.
- [x] `src/renderer/i18n/locales/en-US.json` + all locales synced/validated.
- [x] Tests for notifier, queue/mux wiring, and renderer settings-store/preload notification APIs.
- [x] Docs: README/features/wiki/changelog + drift markers.

---

## 11. Risks and mitigations

| Risk | Mitigation | Status |
|------|------------|--------|
| Notification spam (per-job + summary + retries) | Dedupe keys + summary key per drain event | [x] implemented |
| Breaking queue flow on notifier error | try/catch + no rethrow in notifier/handlers | [x] |
| Main doesn't know setting at startup | Renderer syncs stored value to main on startup; default off | [x] |
| Locale mismatch / missing main i18n | Main resolves `notifications.*` from locale files with English fallbacks | [x] |
| Windows toast not attributed correctly | AppUserModelId set to `com.encodex.app` | [x] |
| Linux unsupported environments | `isSupported()` + graceful no-op | [x] |
| Duplicate notifications across window re-create | singleton notifier with window getter | [x] |

---

## 12. Acceptance criteria

1. [x] With toggle **off**: notifier returns early; no OS notifications shown.
2. [~] With toggle **on**: batch and mux terminal/drain events trigger OS notifications with dedupe (automated wiring covered; manual packaged QA pending).
3. [x] Clicking a notification focuses/restores the app window and navigates to Batch Queue.
4. [x] Setting persists across restart and syncs renderer->main on startup/change.
5. [x] Core checks pass: typecheck (main/preload/renderer), lint, locale validation, doc drift, targeted tests.
6. [~] Automated regression coverage added for notifier/queue wiring; full manual cross-platform QA pending.

---

## 13. Suggested PR breakdown

1. [x] **Core:** shared constants/channels + main notifier + Windows AUMID + IPC + preload + settings store + UI + locale settings keys.
2. [x] **Integration:** batch queue + mux queue terminal/drain wiring and dedupe.
3. [x] **i18n & docs:** locale settings/notification keys synced, main-side resolver, docs/changelog/README/wiki + drift updates.
4. [~] **Tests & polish:** notifier, queue/mux wiring, and settings-store/preload notification unit tests added; manual packaged QA remains.

## Follow-ups (recommended)
- Manual QA on packaged Windows/macOS/Linux (toast delivery, focus/background behavior, click navigation, permissions/DND behavior).
- Consider optional "only when unfocused" and per-event/category toggles in a future iteration.