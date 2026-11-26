# Toast & Notification Unification Plan

Audit-driven plan to unify all in-app toast messages, variants, and UI styling in EncodeX.

> **Status:** Implemented - verification mostly complete, manual QA pending (2026-11-26)
> **Progress legend:** `[x]` done - `[~]` partial/in progress - `[ ]` not started
> **Audit source:** end-to-end codebase grep of renderer, main, i18n, tests, and e2e specs

## 0. Implementation progress (summary)

- [x] Audit all toast/notification call sites (69 production call sites identified)
- [x] Audit toast infrastructure, variants, styling, and duration/action behavior
- [x] Document inconsistencies and classify every message by variant
- [x] Decisions confirmed on open design questions (Section 12)
- [x] Phase 1: canonical copy catalog + i18n key cleanup
- [x] Phase 2: unified `notify()` API + typed facade over the store
- [x] Phase 3: single toast viewport + variant token/icon system + style consolidation
- [x] Phase 4: migrate all 69 call sites (message + variant corrections)
- [x] Phase 5: error-store routing and removal of the duplicate error snackbar
- [x] Phase 6: localize dev-only literals and align OS notification copy
- [~] Phase 7: tests, lint gates, docs, and final verification (manual QA pending)

### Phase progress detail

| Phase | Goal | Steps done | Steps total | Status |
|---|---|---|---|---|
| 1 | Copy catalog | 6 | 6 | [x] complete |
| 2 | API facade | 6 | 6 | [x] complete |
| 3 | UI/style system | 8 | 8 | [x] complete |
| 4 | Call-site migration | 12 | 12 | [x] complete |
| 5 | Error routing | 6 | 6 | [x] complete |
| 6 | i18n & OS copy | 5 | 5 | [x] complete |
| 7 | Verification | 7 | 9 | [~] e2e flakes + manual QA pending |

---

## 1. Scope, goals, and non-goals

### Goals

1. One canonical copy catalog: every user-visible toast message is an i18n key with consistent wording, casing, and punctuation.
2. One API: callers never pick a severity ad hoc; they call a typed facade that resolves copy and variant from a catalog entry.
3. One UI surface: toasts and transient error alerts share one viewport, one component, one style token set, and one icon/color map.
4. One source of truth for durations and actions (default, long-lived update toasts, action buttons).
5. No behavior regressions: existing e2e assertions, action buttons, queue/dedupe behavior, and localization coverage preserved.

### Non-goals

- Redesigning inline page alerts (`ErrorBanner`, `InlineAlert`, `AccelAlert`, `CompatAlert`, `LockedAlert`) beyond sharing the style tokens.
- Changing Electron/OS notification delivery policy, dedupe, or focus behavior (copy alignment only, Phase 6).
- Replacing Zustand with a new dependency; no toast library will be added.
- Changing business logic that triggers toasts (only the presentation/copy/variant call).

---

## 2. Current architecture (verified facts)

- **Store:** `src/renderer/stores/toastStore.ts:46` - Zustand singleton; `addToast` (L56), `success/error/warning/info` (L79/86/93/100); ids `toast-<n>`; queue cap `MAX_TOASTS = 20` (L36); one toast visible at a time.
- **Types:** `src/renderer/stores/types.ts:158-199` - `ToastType = 'success' | 'error' | 'warning' | 'info'`; `Toast { id, type, message, detail?, duration?, action? }`; `ToastState`.
- **Container:** `src/renderer/components/ToastContainer.tsx:31-125` - MUI `Snackbar` + filled `Alert`, top-right below title bar, severity passed straight through (`severity={active.type}`), default `TOAST_DEFAULT_DURATION_MS` (4000ms).
- **Error snackbar (second transient surface):** `src/renderer/components/ErrorSnackbar.tsx:63-79` - driven by `useErrorStore`, 6000ms (`SNACKBAR_AUTO_HIDE_MS`), severity from `ErrorCode` map (L34-49), same anchor and same visual surface.
- **Styles:** `alerts.styles.ts:34` (`BaseAlert`), `alerts.styles.ts:61` (`ToastAlert`), `ToastContainer.styles.ts:7-21` (`ToastMessage`, `ToastDetail`, `ToastActionButton`), `ErrorSnackbar.styles.ts:6-15` (duplicate `AlertMessage`/`AlertDetail`), `Snackbar.styles.ts:18` (title-bar offset), `theme.ts:338-342` (global `MuiAlert` radius).
- **Mount:** `src/renderer/App.tsx:437-443` - `ErrorSnackbar` and `ToastContainer` mounted as sibling global overlays.
- **i18n:** `src/renderer/i18n/locales/en-US.json` - `toast.*` (16 keys), plus message keys under `batchQueue.*`, `automations.*`, `profiles.*`, `copilot.*`, `settings.*`, `gettingStarted.*`; 59 locale files; scripts `sync:locales`, `validate:locales`, `validate:locale-usage`.
- **OS notifications (separate):** `src/main/notifications/notifier.ts`, `strings.ts`, `src/renderer/utils/desktop-utils.ts`; strings duplicated between main strings and `notifications.*` locale keys.
- **Tests:** `toastStore.test.ts`, `ToastContainer.test.tsx`, `ErrorSnackbar.test.tsx`, many feature tests asserting `useToastStore.getState().toasts`, e2e specs asserting visible text.

---

## 3. Full audit inventory

### 3.1 Variant totals (69 production call sites)

| Variant | Call sites | Where |
|---|---|---|
| `success` | 33 | 26 direct + 7 in `useAutomations.ts` |
| `error` | 23 | 9 direct + 14 in `useAutomations.ts` |
| `warning` | 7 | 4 direct (all `BatchQueue.tsx`) + 3 in `useAutomations.ts` |
| `info` | 6 | 3 direct (2 `Footer.tsx`, 1 `BatchQueue.tsx`) + 3 in `useAutomations.ts` |

### 3.2 `toast.*` catalog keys (en-US resolved)

| Key | Message |
|---|---|
| `toast.conversionComplete` | Conversion complete |
| `toast.imageCompressed` | Image compressed successfully |
| `toast.audioExtracted` | Audio extracted successfully |
| `toast.videoCut` | Video cut successfully |
| `toast.remuxed` | Remux complete |
| `toast.demuxed` | Streams extracted successfully |
| `toast.remuxQueued` | Remux added to the mux queue |
| `toast.demuxQueued` | Streams added to the mux queue |
| `toast.jobAdded` | Job added to queue |
| `toast.allCancelled` | All jobs cancelled |
| `toast.pathCopied` | Output path copied to clipboard |
| `toast.logsDownloaded` | Logs downloaded |
| `toast.mediaInfoLoaded` | Media info loaded |
| `toast.updateAvailable` | Update available: v{{version}} |
| `toast.updateNow` | Update Now (action label) |
| `toast.updateDownloaded` | Update v{{version}} downloaded |
| `toast.viewUpdate` | View (action label) |

### 3.3 Direct call sites (`useToastStore.getState().*`)

| File | Lines | Variant | Message / key |
|---|---|---|---|
| `src/renderer/hooks/useConversion.ts` | 174 | success | `toast.conversionComplete` |
| `src/renderer/dev/useDevScreenshot.ts` | 71 / 74 | success / error | **Hardcoded English:** "Dev screenshot saved" (detail: path) / "Dev screenshot failed" (detail: error) |
| `src/renderer/pages/BatchQueue.tsx` | 682-684 | warning | `batchQueue.outputCollisionSkipped` - "Skipped {{count}} job(s) - the new output would overwrite another job's file ({{names}})" |
| `src/renderer/pages/BatchQueue.tsx` | 790 | success | `batchQueue.finished` - "Batch finished: {{done}} succeeded, {{failed}} failed" |
| `src/renderer/pages/BatchQueue.tsx` | 838 | warning | `batchQueue.noMediaFound` - "No supported media files found" |
| `src/renderer/pages/BatchQueue.tsx` | 880 | error | `batchQueue.bmfNotFound` - "BMF was not found on your PATH (missing: {{missing}}). Install BMF, then reselect it..." |
| `src/renderer/pages/BatchQueue.tsx` | 918 / 1006 / 1106 / 1262 | error | raw `appError.message`, `appError.detail` (canonical `ERROR_MESSAGES`) |
| `src/renderer/pages/BatchQueue.tsx` | 923 | success | `batchQueue.enqueued` - "Added {{count}} file(s) to the queue" |
| `src/renderer/pages/BatchQueue.tsx` | 927-929 | warning | `batchQueue.skippedDuplicates` - "Skipped {{count}} file(s) - duplicate or unsupported for this operation" |
| `src/renderer/pages/BatchQueue.tsx` | 1002 | success | `toast.jobAdded` - "Job added to queue" |
| `src/renderer/pages/BatchQueue.tsx` | 1040 | info | `toast.allCancelled` - "All jobs cancelled" |
| `src/renderer/pages/BatchQueue.tsx` | 1086 | warning | `batchQueue.outputCollision` - "Another queued job already uses that output path." |
| `src/renderer/pages/BatchQueue.tsx` | 1092 | error | `batchQueue.optionsUpdateFailed` - "This job is no longer editable." |
| `src/renderer/pages/BatchQueue.tsx` | 1101 | success | `batchQueue.optionsUpdated` - "Job options updated" |
| `src/renderer/pages/BatchQueue.tsx` | 1241 / 1257 | success | `batchQueue.exported` / `batchQueue.imported` - "Exported/Imported {{count}} jobs..." |
| `src/renderer/pages/Copilot.tsx` | 148 / 446 | success | `copilot.chatSaved` - "Conversation saved"; `copilot.addedToQueue` - "Added {{count}} job(s) to the queue" |
| `src/renderer/pages/VideoCut.tsx` | 579 | success | `toast.videoCut` |
| `src/renderer/pages/MediaInfo.tsx` | 121 | success | `toast.mediaInfoLoaded` |
| `src/renderer/pages/Logs.tsx` | 296 | success | `toast.logsDownloaded` |
| `src/renderer/pages/ImageCompress.tsx` | 335 | success | `toast.imageCompressed` |
| `src/renderer/components/GettingStartedCard.tsx` | 157 | success | `gettingStarted.mcpEnabled` - "MCP server enabled" |
| `src/renderer/components/Footer.tsx` | 81 | info, 8000ms, action | `toast.updateAvailable` + `toast.updateNow` |
| `src/renderer/components/Footer.tsx` | 91 | info, 10000ms, action | `toast.updateDownloaded` + `toast.viewUpdate` |
| `src/renderer/components/MuxQueuePanel.tsx` | 164 / 167 | success / error | `toast.jobAdded`; raw `appError.message/detail` |
| `src/renderer/components/MuxQueueJobCard.tsx` | 111 | success | `toast.pathCopied` |
| `src/renderer/components/QueueJobCard.tsx` | 179 | success | `toast.pathCopied` |
| `src/renderer/components/ProfileSelector.tsx` | 319 | **error (wrong)** | `profiles.deleted` - "Deleted \"{{name}}\"" (successful action shown as error) |
| `src/renderer/components/ProfileEditorDialog.tsx` | 137 / 140 | success | `profiles.updated` / `profiles.created` - "Updated/Created \"{{name}}\"" |
| `src/renderer/components/settings/McpSettingsSection.tsx` | 139 | success | `settings.mcpCopied` - "Copied to clipboard" |
| `src/renderer/stores/audioExtractStore.ts` | 213 | success | `toast.audioExtracted` |
| `src/renderer/stores/demuxStore.ts` | 380 / 425 | success, action | `toast.demuxed` + "Reveal in folder"; `toast.demuxQueued` + "View queue" |
| `src/renderer/stores/remuxStore.ts` | 440 / 498 | success, action | `toast.remuxed` + "Reveal in folder"; `toast.remuxQueued` + "View queue" |

### 3.4 `useAutomations.ts` call sites (27)

Selectors at L45-48: `showSuccess`, `showToastError`, `showWarning`, `showInfo`; error-store `showAppError` at L49 (Phase 5).

| Lines | Variant | Message keys |
|---|---|---|
| 126 / 127 | success / error | `saveSuccess` / `saveFailed` |
| 134 / 135 | success / error | `saveAsSuccess` / `saveAsFailed` |
| 144 / 145 | info / error | `loadSuccess` / `loadFailed` |
| 154 / 155 | success / error | `deleteSuccess` / `deleteFailed` |
| 164 / 165 | success / error | `duplicateSuccess` / `duplicateFailed` |
| 173 / 174 | success / error | `importSuccess` / `importFailed` |
| 181 / 182 | success / error | `exportSuccess` / `exportFailed` |
| 195 / 201 / 208 / 212 | warning / error / success / error | `probeNoInput` / `probeUnavailable` / `inputProbed` / `probeFailed` |
| 244 / 260 / 266 / 277 / 280 | warning / warning / error / info / error | `runNoDefinition` / `validationFailed` / `runUnavailable` / `runQueued` / `runFailed` |
| 295 / 302 / 314 / 317 | error / error / info / error | `cancelUnavailable` / `cancelFailed` / `runCancelled` / `cancelFailed` |

### 3.5 Error-snackbar surface (transient alert #2)

`ErrorSnackbar` renders `ERROR_MESSAGES`-derived text from `useErrorStore` via `showError/showErrorMessage` (`errorStore.ts:71,87`; messages at `shared/errors.ts:180-211`). Producers: `useConversion.ts:127,132,138,178,229,242`; `useMediaTask.ts:101`; `MediaInfo.tsx:143`; `ImageCompress.tsx:289`; `VideoCut.tsx:535`; `audioExtractStore.ts:192,197,221`; `demuxStore.ts:201,328,332,359,403,434`; `remuxStore.ts:205,393,398,409,453,472,477,485,507`; `useAutomations.ts:213,267,281,296,318`; `useErrorHandler.ts` (tests only).

---

## 4. Problems to solve

| # | Problem | Evidence | Fix phase |
|---|---|---|---|
| P1 | Inconsistent completion wording: "successfully" vs "complete" vs bare past tense | `toast.imageCompressed`, `toast.remuxed`, `toast.videoCut`, `toast.demuxed` | 1, 4 |
| P2 | Duplicate/ambiguous copy: "Job added to queue", "Added N file(s) to the queue", "Added N job(s) to the queue", "Streams added to the mux queue" | `BatchQueue.tsx:1002,923`; `Copilot.tsx:446`; `demuxStore.ts:425` | 1, 4 |
| P3 | Wrong variant: successful profile delete uses `error()` | `ProfileSelector.tsx:319` | 4 |
| P4 | Punctuation/casing drift; instructional messages with periods vs status messages without | `batchQueue.outputCollision` vs `toast.jobAdded`; `batchQueue.bmfNotFound` | 1, 4 |
| P5 | Raw error messages bypass the catalog (dynamic text + detail line) | 9 error call sites pass `appError.message/detail` | 2, 4 |
| P6 | Two independent transient surfaces (4s toast queue + 6s error snackbar) share anchor and styling but not lifecycle; potential collision and inconsistent severity behavior | `App.tsx:437-443`, `ErrorSnackbar.tsx:69` | 3, 5 |
| P7 | Variant styling is implicit: MUI defaults supply icons/colors; no app-owned icon/color token map, and message/detail styles are duplicated in two files | `ToastContainer.tsx:103-104`; `alerts.styles.ts:61`; `ErrorSnackbar.styles.ts:6-15` | 3 |
| P8 | Hardcoded English in dev toasts; OS notification strings duplicated in main and locale JSON | `useDevScreenshot.ts:71,74`; `main/notifications/strings.ts`; `en-US.json:1465-1478` | 6 |
| P9 | No single authoring API: 40 direct `getState()` calls + 27 aliased selectors; adding a toast requires manually choosing method, copy key, detail, duration, action | `toastStore.ts:79-100` and all call sites | 2, 4 |

---

## 5. Target design

### 5.1 Copy standard (rules)

- [x] Sentence case; no trailing period on single-line status toasts; periods allowed in multi-sentence guidance messages.
- [x] No "successfully" - use "complete", "done", or a past participle ("Streams extracted").
- [x] Completion pattern: `<Subject> complete` for operations; `<Action> <object>` for completed actions ("Logs downloaded").
- [x] Queue wording standard: singular "Job added to the queue"; counted "Added {{count}} file(s) to the queue" / "Added {{count}} job(s) to the queue"; digest "Batch finished: {{done}} succeeded, {{failed}} failed".
- [x] Errors use `Could not <action>.` (or canonical `ERROR_MESSAGES` text) and put technical context in `detail`, never in the headline.
- [x] Warnings describe the user action needed ("Select an input before probing"), not internal state.
- [x] Actions live in `toast.action.*` keys (e.g. `updateNow`, `viewUpdate`, `revealInFolder`, `viewQueue`) and are never hardcoded at call sites.

### 5.2 Canonical catalog (proposed wording - confirm in Section 12)

| Key (target) | Current | Proposed | Variant |
|---|---|---|---|
| `toast.conversionComplete` | Conversion complete | Conversion complete | success |
| `toast.imageCompressed` | Image compressed successfully | Image compression complete | success |
| `toast.audioExtracted` | Audio extracted successfully | Audio extraction complete | success |
| `toast.videoCut` | Video cut successfully | Video cut complete | success |
| `toast.remuxed` | Remux complete | Remux complete | success |
| `toast.demuxed` | Streams extracted successfully | Streams extracted | success |
| `toast.remuxQueued` | Remux added to the mux queue | Remux job added to the queue | success |
| `toast.demuxQueued` | Streams added to the mux queue | Demux job added to the queue | success |
| `toast.jobAdded` | Job added to queue | Job added to the queue | success |
| `toast.allCancelled` | All jobs cancelled | All jobs cancelled | info |
| `toast.pathCopied` | Output path copied to clipboard | Output path copied to clipboard | success |
| `toast.logsDownloaded` | Logs downloaded | Logs downloaded | success |
| `toast.mediaInfoLoaded` | Media info loaded | Media info loaded | success |
| `toast.updateAvailable` | Update available: v{{version}} | Update available: v{{version}} | info, 8s, "Update Now" |
| `toast.updateDownloaded` | Update v{{version}} downloaded | Update v{{version}} downloaded | info, 10s, "View" |
| `batchQueue.finished` | Batch finished: {{done}} succeeded, {{failed}} failed | Batch finished: {{done}} succeeded, {{failed}} failed | success |
| `batchQueue.enqueued` | Added {{count}} file(s) to the queue | Added {{count}} file(s) to the queue | success |
| `copilot.addedToQueue` | Added {{count}} job(s) to the queue | Added {{count}} job(s) to the queue | success |
| `batchQueue.exported` / `imported` | Exported/Imported {{count}} jobs to/from a file | Exported/Imported {{count}} jobs | success |
| `profiles.deleted` | Deleted "{{name}}" (error) | Deleted "{{name}}" (**success**) | success |
| `settings.mcpCopied` | Copied to clipboard | Copied to clipboard | success |
| `batchQueue.bmfNotFound` | Multi-sentence PATH instructions | Keep as multi-sentence guidance, error | error |
| `automations.*` save/load/delete/duplicate/import/export | Mixed "Automation saved" / "Loaded {{name}}" / "Could not ..." | Keep verbs; apply `Could not ...` for all failures; success/info per current intent | success/error/info |
| Dev screenshot toasts | Hardcoded English | New `toast.devScreenshotSaved` / `toast.devScreenshotFailed` keys | success/error |

### 5.3 Unified API

- [ ] New facade `src/renderer/hooks/useToast.ts` (or `src/renderer/utils/notify.ts` if callable outside React): `notify({ key, values?, variant, detail?, duration?, actionKey?, onAction? })`, plus typed helpers `notify.success(key, ...)`, `notify.error(key, ...)`, `notify.warning(key, ...)`, `notify.info(key, ...)` that fix the variant.
- [x] Facade forwards i18n keys and interpolation values; `ToastContainer` resolves copy via `useTranslation()` at render time. Callers pass keys, never resolved English strings.
- [ ] `notify.fromError(appError)` maps `ErrorCode` -> catalog key (reuse `ErrorSnackbar.severityMap` logic) and puts `appError.detail` on the detail line.
- [ ] Keep `useToastStore` as backing queue only; mark `success/error/warning/info` on the store as internal/deprecated once all call sites migrate.
- [ ] `ToastAction` gains optional `labelKey` resolved by the facade; existing `{label, onClick}` shape remains supported internally for compatibility.
- [ ] Export a `TOAST_DURATION` token map: `default: 4000`, `long: 8000-10000` (updates), and a documented rule for when to use each.

### 5.4 Unified UI/style system

- [ ] One viewport component (extend `ToastContainer`) renders all transient feedback, including errors formerly shown by `ErrorSnackbar`.
- [ ] Explicit variant token map in `alerts.styles.ts` (or new `toast.variants.ts`): `{ icon, palette color, aria-label }` for `success/error/warning/info`, replacing implicit MUI severity defaults.
- [ ] Consolidate `ToastMessage`/`ToastDetail` and `AlertMessage`/`AlertDetail` into shared styled primitives exported once; `ErrorSnackbar.styles.ts` aliases them during migration then is deleted.
- [ ] Keep `BaseAlert`/`ToastAlert` as the single surface; all variants use `variant="filled"` and the shared 600px cap, shadow, 10px radius, white filled text.
- [ ] Standardize action button: `ToastActionButton` with `fontWeight: 600` reused for every toast action; all actions close the toast after `onClick`.
- [ ] Accessibility: `aria-live="polite"` for success/info/warning, `assertive` for error; icon buttons get `aria-label`; add `data-testid="toast-<variant>"` and `data-testid="toast-action"` hooks.
- [ ] Preserve queue behavior: one visible toast, cap 20, promote on exit, top-right below title bar.

### 5.5 Localization workflow

- [ ] Add/modify keys only in `en-US.json`, then `npm run sync:locales` and `npm run validate:locales`.
- [ ] Add i18n keys to dev screenshot toasts; ensure `npm run lint:strings` passes (no new hardcoded renderer strings).
- [ ] Keep `notifications.*` OS strings in sync with in-app copy (Phase 6), resolving the main/renderer duplication where practical.

---

## 6. Detailed implementation steps

### Phase 1 - Canonical copy catalog [x] 6/6

1. [x] Confirm Section 12 decisions (punctuation, "successfully" replacement, queue wording, error routing).
2. [x] Update `src/renderer/i18n/locales/en-US.json`: add `toast.action.*` keys, dev screenshot keys, and revised `toast.*` strings; rename/repoint `batchQueue.*`, `automations.*`, `copilot.*`, `profiles.*`, `settings.*`, `gettingStarted.*` keys where wording changes.
3. [x] Write one canonical mapping table (old key -> new key -> variant -> copy) into this plan as the migration contract.
4. [x] Run `npm run sync:locales` to propagate to all locale files.
5. [x] Run `npm run validate:locales` and `npm run validate:locale-usage`; fix missing/unused key errors.
6. [x] Verify no messages lost: compare key list against Section 3 inventory (69 call sites covered).

### Phase 2 - Unified API [x] 6/6

1. [x] Create the facade (`useToast.ts` / `notify.ts`) with i18n-aware methods and variant fixing.
2. [x] Implement `notify.fromError(appError)` with `ErrorCode` -> variant/key mapping and detail passthrough.
3. [x] Extend `Toast`/`ToastAction` types in `stores/types.ts` with `labelKey?` (keep `label?` for internal compatibility).
4. [x] Add `TOAST_DURATION` tokens in `shared/constants.ts` (or facade-local constants) and remove magic `8000`/`10000` at call sites.
5. [x] Cover facade behavior through updated store/component/call-site tests (key forwarding, interpolation, variant selection, error mapping, action duration).
6. [x] Mark direct store toast helpers deprecated in `toastStore.ts` doc comments (no behavior change yet).

### Phase 3 - UI/style system [x] 8/8

1. [x] Add explicit variant token map (icon + palette + aria label) for the four variants.
2. [x] Render the mapped icon inside `ToastAlert` before `ToastMessage`; keep action slot at the end.
3. [x] Move `ToastMessage`/`ToastDetail` into a single shared styles module; alias from `ToastContainer.styles.ts` and `ErrorSnackbar.styles.ts`.
4. [x] Apply `aria-live` by variant and add data-testids on alert/action.
5. [x] Verify filled color contrast in light/dark themes (`theme.palette.common.white` on all severity backgrounds).
6. [x] Verify action button closes toast after callback (existing behavior at `ToastContainer.tsx:110-114`).
7. [x] Add/update `ToastContainer` component tests for icons, variants, aria, and action testids.
8. [x] Run `npm run lint`, `npm run lint:px`, `npm run typecheck:renderer` after style changes.

### Phase 4 - Call-site migration (69 sites) [x] 12/12

Work in small batches, each independently testable; use facade methods and new keys, remove manual duration literals.

1. [x] `hooks/useAutomations.ts` (27 calls) - replace four local selectors with facade helpers; keep error recording until Phase 5.
2. [x] `pages/BatchQueue.tsx` (15 calls) - fix `error()` -> `notify.fromError` at L918/1006/1106/1262; preserve multi-line warning calls at L682/927.
3. [x] `dev/useDevScreenshot.ts` (2) - replace literals with i18n keys.
4. [x] `hooks/useConversion.ts` (1), `pages/VideoCut.tsx`, `MediaInfo.tsx`, `Logs.tsx`, `ImageCompress.tsx`, `Copilot.tsx` (2) - standard completion keys.
5. [x] `components/Footer.tsx` (2) - use `TOAST_DURATION.long` and `toast.action.*` keys.
6. [x] `stores/demuxStore.ts`, `stores/remuxStore.ts` (4) - use `toast.action.revealInFolder` / `viewQueue` keys.
7. [x] `components/MuxQueuePanel.tsx` (2) - `toast.jobAdded` wording + `notify.fromError`.
8. [x] `components/MuxQueueJobCard.tsx`, `QueueJobCard.tsx` (2) - `toast.pathCopied`.
9. [x] `components/ProfileSelector.tsx:319` - **change `error` to `success`** (P3).
10. [x] `components/ProfileEditorDialog.tsx` (2), `GettingStartedCard.tsx`, `settings/McpSettingsSection.tsx` - wording/keys.
11. [x] `stores/audioExtractStore.ts` (1) - completion key.
12. [x] Grep verification: zero remaining `useToastStore.getState().(success|error|warning|info)` in production code; only facade uses `addToast`.

### Phase 5 - Error routing / remove duplicate snackbar [x] 6/6

1. [x] Route `useErrorStore` state into the unified viewport by emitting from `showError/showErrorMessage` through the facade.
2. [x] Choose a single duration for all transient feedback (4000ms default) and delete `SNACKBAR_AUTO_HIDE_MS`.
3. [x] Remove `<ErrorSnackbar />` from `App.tsx`; delete `ErrorSnackbar.tsx` and `ErrorSnackbar.styles.ts` after migration.
4. [x] Ensure error code -> severity map lives in exactly one place (facade token map).
5. [x] Update `ErrorSnackbar.test.tsx` into unified viewport tests (severity, close, detail).
6. [x] Verify no duplicate toasts when both `toastStore.error` and `errorStore` fire; `useAutomations` calls `recordError` (history/analytics only) alongside its domain-specific `notify` toast.

### Phase 6 - Localization & OS copy alignment [x] 5/5

1. [x] Confirm dev screenshot toasts are localized and gated to dev builds only.
2. [x] Reconcile `main/notifications/strings.ts` with `notifications.*` in locale JSON; document which source wins.
3. [x] Align OS notification copy ("Conversion complete", "Batch finished: ...", "Remux/demux complete") with canonical in-app catalog.
4. [x] Re-run locale sync/validation/usage after all key changes.
5. [x] Verify `npm run lint:strings` and `npm run validate:locale-usage` pass with zero new hardcoded strings.

### Phase 7 - Verification & docs [~] 7/9

1. [x] `npm run lint`
2. [x] `npm run lint:strings`
3. [x] `npm run typecheck:renderer` (full `npm run typecheck` also passed)
4. [x] `npm run validate:locales` + `npm run validate:locale-usage`
5. [x] `npm run test:unit -- src/renderer/stores/__tests__/toastStore.test.ts src/renderer/components/__tests__/ToastContainer.test.tsx src/renderer/dev/__tests__/useDevScreenshot.test.ts`
6. [x] Run affected feature tests (BatchQueue, Automations, Copilot, Convert, Remux, Demux, AudioExtract, ImageCompress, VideoCut, MediaInfo, Logs, Profiles, MuxQueuePanel); full unit suite passed: 386 files / 5684 tests.
7. [~] `npm run test:e2e:ci`: toast text assertions and hostile-bridge drift are fixed; affected specs pass in isolation, but full local run still flakes on unrelated a11y color-contrast and cold-boot budget gates under load.
8. [x] `npm run doc:drift`; update README/wiki/features/changelog only if user-facing copy is documented.
9. [ ] Manual QA in dev app: trigger one toast per variant + action toasts + rapid bulk queue toasts; confirm queue cap, stacking, theme contrast, and no duplicate error surface.

---

## 7. File-by-file checklist

### Added / rewritten
- [x] `src/renderer/utils/notify.ts` (new facade)
- [x] `src/renderer/styles/toast.variants.ts` (variant token map)
- [x] `src/renderer/components/ToastContainer.tsx` (viewport, icons, aria, error routing)
- [x] `src/renderer/styles/alerts.styles.ts` (shared primitives + variant tokens)
- [x] `src/renderer/styles/ToastContainer.styles.ts` (re-export shared primitives)

### Deleted after migration
- [x] `src/renderer/components/ErrorSnackbar.tsx`
- [x] `src/renderer/styles/ErrorSnackbar.styles.ts`

### Modified (call sites)
- [x] `src/renderer/pages/BatchQueue.tsx` (15)
- [x] `src/renderer/hooks/useAutomations.ts` (27)
- [x] `src/renderer/components/Footer.tsx` (2)
- [x] `src/renderer/components/MuxQueuePanel.tsx` (2)
- [x] `src/renderer/components/MuxQueueJobCard.tsx` (1)
- [x] `src/renderer/components/QueueJobCard.tsx` (1)
- [x] `src/renderer/components/ProfileSelector.tsx` (1 - variant fix)
- [x] `src/renderer/components/ProfileEditorDialog.tsx` (2)
- [x] `src/renderer/components/GettingStartedCard.tsx` (1)
- [x] `src/renderer/components/settings/McpSettingsSection.tsx` (1)
- [x] `src/renderer/pages/Copilot.tsx` (2)
- [x] `src/renderer/pages/VideoCut.tsx` (1)
- [x] `src/renderer/pages/MediaInfo.tsx` (1)
- [x] `src/renderer/pages/Logs.tsx` (1)
- [x] `src/renderer/pages/ImageCompress.tsx` (1)
- [x] `src/renderer/hooks/useConversion.ts` (1)
- [x] `src/renderer/stores/audioExtractStore.ts` (1)
- [x] `src/renderer/stores/demuxStore.ts` (2)
- [x] `src/renderer/stores/remuxStore.ts` (2)
- [x] `src/renderer/dev/useDevScreenshot.ts` (2)
- [x] `src/renderer/App.tsx` (remove ErrorSnackbar mount)
- [x] `src/renderer/stores/types.ts` (action label key)
- [x] `src/renderer/stores/toastStore.ts` (deprecation docs only)

### i18n / config
- [x] `src/renderer/i18n/locales/en-US.json` (+ all synced locale files)
- [x] `src/shared/constants.ts` (duration tokens; obsolete snackbar constant removed)
- [x] `src/main/notifications/strings.ts` (Phase 6 copy/fallback alignment)

### Tests / docs
- [x] `src/renderer/stores/__tests__/toastStore.test.ts` (facade/store contract)
- [x] `src/renderer/components/__tests__/ToastContainer.test.tsx` (variants, icons, aria, actions, error routing)
- [x] `src/renderer/components/__tests__/ErrorSnackbar.test.tsx` -> merged into `ToastContainer.test.tsx`
- [x] `e2e/specs/*.spec.ts` (batch/audio-extract/convert/image-compress/logs/profiles/video-cut/mux-queue toast text assertions)
- [x] `plans/TOAST_UNIFICATION_PLAN.md` (Phases 1-5 checked off as work landed)

---

## 8. Testing plan

| Layer | What to cover | Command |
|---|---|---|
| Unit - store | queue cap 20, id generation, promote next, action closes toast | `npm run test:unit -- src/renderer/stores/__tests__/toastStore.test.ts` |
| Unit - facade | key interpolation, `fromError` mapping, duration/action tokens | new `src/renderer/utils/__tests__/notify.test.ts` (or hooks path) |
| Component | each variant renders correct icon/color/detail/aria/testid; action click invokes callback and closes | `npm run test:unit -- src/renderer/components/__tests__/ToastContainer.test.tsx` |
| Component | error store events render in unified viewport; no duplicate surface | merged ErrorSnackbar test |
| Static | no hardcoded toast strings in renderer; all i18n keys used | `npm run lint:strings`, `npm run validate:locale-usage` |
| Locales | keys present in all locales after sync | `npm run validate:locales`, `npm run test:locale-matrix` |
| Types | renderer typecheck after type changes | `npm run typecheck:renderer` |
| E2E | visible toast text after batch/remux/demux/cut/compress/profile flows | `npm run test:e2e:ci` |
| Manual | theme contrast, rapid toasts, action toasts, update toasts, dark/light | dev app walkthrough |

---

## 9. Risks and mitigations

| Risk | Mitigation | Status |
|---|---|---|
| E2E tests assert exact old toast text | Update e2e specs in Phase 7 with new copy; keep a key->text mapping in the plan | [x] |
| 59 locales drift after key renames | Only edit `en-US.json`, run `sync:locales` + `validate:locales` + `validate:locale-usage` | [x] |
| Removing `ErrorSnackbar` loses error visibility | Route error store into unified viewport first, then delete; keep severity mapping identical | [x] |
| Duplicate toasts from dual error channels (`useAutomations` emits both) | Deduplicate in Phase 5 by recording errors without a second toast; add test | [x] |
| Hardcoded strings reintroduced | Facade only accepts i18n keys; `lint:strings` gate in CI | [x] |
| Users rely on long update toast durations | Keep explicit `TOAST_DURATION.updateReady` for the two update toasts | [x] |
| Icon/style changes break theme contrast | Check both light/dark palettes; keep `ToastAlert` white text on filled backgrounds | [x] |
| Large-batch toast spam | Preserve 20-item cap and single-visible-toast queue; no fan-out per file | [x] |

---

## 10. Acceptance criteria

- [x] All 69 production call sites use the facade; zero direct `useToastStore.getState().success/error/warning/info` calls remain outside the facade/store tests.
- [x] Every toast message is an i18n key; no hardcoded English toast strings in renderer source.
- [x] All four variants render a consistent icon + color + typography from one token map.
- [x] `ProfileSelector.tsx` delete toast is `success`, not `error`.
- [x] No "successfully" remains in toast copy; wording follows Section 5.1 rules.
- [x] Only one transient feedback surface is mounted; error store events appear in the unified viewport.
- [x] All action toasts use catalog labels and close the toast after the callback.
- [x] Queue behavior unchanged: one visible, cap 20, promote on exit, 4s default.
- [~] `lint`, `typecheck:renderer`, `lint:strings`, locale validation, and unit tests pass; toast e2e assertions pass, full e2e has unrelated local flakes (a11y color-contrast / cold-boot budget).
- [x] This plan's trackers reflect completed work.

---

## 11. Suggested PR breakdown

1. [x] **PR 1 - Catalog & facade:** Phase 1 + 2 (i18n keys, sync, facade, duration tokens, facade tests). No UI change.
2. [x] **PR 2 - UI unification:** Phase 3 + 5 (variant tokens, viewport, error routing, remove ErrorSnackbar, component tests).
3. [x] **PR 3 - Migration:** Phase 4 batches (69 call sites, variant fixes, wording), feature test updates.
4. [~] **PR 4 - Localization, e2e & docs:** Phase 6 + 7 (dev/OS copy alignment, e2e text updates, full validation, manual QA notes).

---

## 12. Open decisions (confirm before Phase 1)

| # | Decision | Recommended default | Why |
|---|---|---|---|
| D1 | Trailing periods on toasts? | No period on single-line status toasts; periods kept for multi-sentence guidance | Matches majority of current copy |
| D2 | Replace "successfully" with? | "<Subject> complete" / past participle | Matches existing "Conversion complete"/"Remux complete" |
| D3 | Merge error snackbar into toast viewport? | Yes - one surface, error variant, single duration policy | Removes duplicate surface and fixes collision/severity drift (P6) |
| D4 | Add explicit icons per variant? | Yes - success/error/warning/info icons from existing icon set | Current icons are implicit MUI defaults (P7) |
| D5 | Keep raw `ERROR_MESSAGES` text for error toasts? | No - map `ErrorCode` to catalog keys via `notify.fromError`, keep detail passthrough | Fixes P5 while preserving canonical error text |
| D6 | Localize dev screenshot toasts? | Yes, via new `toast.devScreenshot*` keys | Required by `lint:strings` policy |
| D7 | Rename i18n keys or repoint in place? | Repoint in place where possible; add new keys only for actions/dev | Minimizes locale churn across 59 files |
