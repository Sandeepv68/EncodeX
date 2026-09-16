# Terms and Conditions Implementation Plan

Adds a versioned Terms & Conditions agreement to EncodeX. On first run (or when the
terms are updated), a blocking modal shows the terms and asks the user to **Accept** to
proceed into the app or **Reject**, which quits the application completely. The same
terms can be re-read from the About page at any time in a read-only viewer.

## Motivation

There is currently no terms-of-use step in the app. This plan gates first-run access on
explicit consent, persists that consent across app restarts, re-prompts whenever the
terms change (by design via a version bump), and surfaces the full text from the About
page so users can revisit it.

## Design overview

- Terms content is **versioned, structured data** in `src/shared/terms.ts`
  (`TERMS_VERSION` date-based string + `TERMS_SECTIONS` array). Bumping `TERMS_VERSION`
  after any edit re-triggers the acceptance gate on the next launch.
- A **Zustand store** (`src/renderer/stores/termsStore.ts`) persists the accepted terms
  version to localStorage under `encodex-terms-accepted` (object `{ version, acceptedAt }`),
  following the manual read/write + validation pattern of `profileStore.ts`.
- The acceptance key is added to the **session-cleanup preference whitelist**
  (`src/renderer/sessionCleanup.ts`) so it survives an app close. Without this, the
  transient-storage wipe on `beforeunload` would clear the consent every launch and the
  modal would reappear forever.
- The gate dialog (`TermsDialog`) is mounted globally in `AppLayout`, initialized open
  when acceptance is required. In "accept" mode it is blocking: Escape + backdrop click
  are disabled; the only exits are Accept (persist + proceed) and Reject (quit).
- **Reject quits deterministically** via a new IPC channel `terms-reject`. The preload
  exposes `rejectTerms()`, and the main process handles it with `app.quit()`, bypassing
  the close-guard round-trip in `src/main/ipc/window.ts` so quitting never depends on
  renderer state.
- The About page opens the same dialog in read-only "view" mode (Close button only; no
  Accept/Reject). Re-acceptance on update is handled exclusively by the startup gate.

## Decisions (confirmed)

- Plan file lives in `plans/TERMS_AND_CONDITIONS_PLAN.md`.
- i18n: the `terms.*` dialog chrome keys are synced across **all 56 locale files**
  (English values, matching the repo convention). The legal body stays English in
  `terms.ts` as structured data — it is not a per-locale key (same approach as the
  existing MIT license text on the About page).
- About viewer is read-only: only a Close action; Reject/quitting belongs to the
  first-run gate.

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] P0. Create this plan document.
- [x] P1. Terms content + storage key.
      - `src/shared/terms.ts`: `TERMS_VERSION`, `TermsSection`, `TERMS_SECTIONS`.
      - `src/shared/constants.ts`: `TERMS_ACCEPTED_STORAGE_KEY = 'encodex-terms-accepted'`.
- [x] P2. `sessionCleanup.ts`: add the key to `PREFERENCE_STORAGE_KEYS`; update doc comment.
- [x] P3. `stores/termsStore.ts`: accepted state, `requiresAcceptance`, `accept`,
      `rejectTerms`, `openViewer`, `closeDialog`; `dialogOpen` initialized from
      acceptance state so the gate shows on first render (no effect-based prompt).
- [x] P4. IPC reject-to-quit:
      - `shared/ipc-channels.ts`: `TERMS_REJECT: 'terms-reject'`.
      - `shared/log-constants.ts`: `LOG_IPC_TERMS_REJECT`.
      - `preload/index.ts`: `rejectTerms()` -> `ipcRenderer.send(IPC.TERMS_REJECT)`.
      - `main/ipc/window.ts`: `ipcMain.on(IPC.TERMS_REJECT)` -> `app.quit()`.
- [x] P5. `components/TermsDialog.tsx` + `styles/TermsDialog.styles.ts`:
      MUI Dialog; scrollable content; accept mode (blocking — Escape and backdrop
      dismissal suppressed by no-opping `onClose`, MUI v9 dropped
      `disableEscapeKeyDown`; Accept + Reject) and view mode (Close only);
      `data-testid="terms-dialog"`.
- [x] P6. `App.tsx`: mount `<TermsDialog />` in `AppLayout` beside the other global dialogs.
- [x] P7. `pages/About.tsx` + `styles/About.styles.ts`: "Terms & Conditions" row near the
      license section; opens the viewer via `openViewer()`.
- [x] P8. i18n: `terms` namespace + `about.terms`/`about.readTerms` in `en-US.json`; sync
      all 56 locale files; `src/test-setup.ts` gains `rejectTerms: vi.fn()` on the
      electronAPI stub.
- [x] P9. Tests: `stores/__tests__/termsStore.test.ts`,
      `components/__tests__/TermsDialog.test.tsx`, `pages/__tests__/About.test.tsx`,
      plus `rejectTerms` coverage in `preload/__tests__/index.test.ts`,
      `main/ipc/__tests__/window.test.ts`, and `shared/__tests__/ipc-channels.test.ts`.
- [x] P10. Verify (automated): `npm run typecheck`, `npm run lint`, `npm test`
      (1879 passed), `npm run validate:locales` (55 locales match); touched files run
      through `prettier`. The remaining `format:check` warnings are pre-existing files
      untouched by this work. Manual smoke remains for QA: fresh profile -> modal; Accept
      persists across restarts; `TERMS_VERSION` bump re-prompts; About opens read-only;
      Reject quits the app.

## Semantics

| Concern | Behavior |
| --- | --- |
| First run (no stored consent) | Gate shows in accept mode; app is usable only after Accept |
| Normal subsequent runs | Store version == `TERMS_VERSION` -> gate is closed at init |
| Terms updated (`TERMS_VERSION` bumped) | Stored version != current -> gate shows again on next launch |
| Accept | Persists `{ version: TERMS_VERSION, acceptedAt }`, closes the dialog |
| Reject | Sends `terms-reject` to main -> `app.quit()` (no close-guard round-trip) |
| About page | Opens dialog in view mode (Close only); no consent mutation |
| Window X while gate open | Existing close-guard runs (no pending work on fresh run -> immediate close) |

## Files touched

| Area | File |
| --- | --- |
| New | `plans/TERMS_AND_CONDITIONS_PLAN.md`, `src/shared/terms.ts`, `src/renderer/stores/termsStore.ts`, `src/renderer/components/TermsDialog.tsx`, `src/renderer/styles/TermsDialog.styles.ts` |
| Shared constants | `src/shared/constants.ts`, `src/shared/ipc-channels.ts`, `src/shared/log-constants.ts` |
| Main / preload | `src/main/ipc/window.ts`, `src/preload/index.ts` |
| Renderer | `src/renderer/App.tsx`, `src/renderer/sessionCleanup.ts`, `src/renderer/pages/About.tsx`, `src/renderer/styles/About.styles.ts` |
| i18n | `src/renderer/i18n/locales/*.json` (56 files), `src/test-setup.ts` |
| Tests | `src/renderer/stores/__tests__/termsStore.test.ts`, `src/renderer/components/__tests__/TermsDialog.test.tsx`, `src/renderer/pages/__tests__/About.test.tsx` |

## Edge cases

- **Session cleanup**: the consent key MUST be in `PREFERENCE_STORAGE_KEYS` or the gate
  reappears every launch.
- **No effect-based prompt**: `dialogOpen` is seeded at store-creation from localStorage,
  so React StrictMode double-mounting cannot double-prompt.
- **Reject path is renderer-state-independent**: handled by `app.quit()` in main.
- **CLI mode**: never mounts React, so no gate renders — by design.

## Verification

- `npx prettier --check "src/**/*.{ts,tsx}" "plans/*.md"`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run validate:locales`