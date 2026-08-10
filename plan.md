# E2E Test Plan (Vitest + Playwright _electron, mock preload)

## Objective
Write and stabilize E2E specs for the EncodeX renderer against a mocked main-process IPC
(preload `__test` API) so the suite runs headless, fast, and deterministically on CI.

## Status (as of 2026-08-11)

- [x] **Phase 1 — Infra**: `e2e/vitest.e2e.config.ts`, `e2e/fixtures/app.ts` (launchApp/closeApp),
      `e2e/mocks/main-store.js` (mock IPC with `__test` getters/setters, `emit`), mock preload
      via `env.E2E_MOCK_PRELOAD`.
- [x] **Phase 2 — Suites 1-5** (all green, 80/80 in one full run):
      - `shell.spec.ts` — window title, tabs, initial state
      - `convert.spec.ts` — input/output select, Save As, codec/copy-mode presets, live progress,
        cancel, convert behavior
      - `media-info.spec.ts` — file drop → FFprobe metadata, stream details, image EXIF
      - `image-compress.spec.ts` — preview + info load, output fields, compress, error toast
      - `audio-extract.spec.ts` — preview + info, output path, codec, extract, error
- [x] **Phase 3 — Remaining suites** (all green, **109/109 across 10 files**):
      - `video-cut.spec.ts` — 7 tests: start disabled, select video/timeline/output enables cut,
        use-duration toggle, cut success toast, live progress + cancel via confirm dialog,
        cancel-job clears form, timeline drag + scrub
      - `batch.spec.ts` — 9 tests: empty state, add files via review dialog, queue-added event
        seeding, live progress + finished toast, cancel all via confirm dialog, status filter,
        single-job remove, keyboard drag-handle reorder, close-with-active-jobs confirm/cancel
      - `logs.spec.ts` — 4 tests: emitted + startup entries, level filter, clear, download toast
      - `settings.spec.ts` — 6 tests: theme cards + default state, theme switching,
        always-on-top (windowCalls), launch-at-login (loginCalls), hwaccel mode/encoder persist
        to localStorage, hide/restore on toggle
      - Extensions in earlier suites: convert pixel format (`convert-pixel-format`),
        image-compress quality + scale, audio-extract bitrate (`audio-extract-bitrate`)
- [x] **Phase 4 — testid hardening**: `data-testid` added to `VideoCut`, `Logs`, `Settings`
      (switches/selects/theme cards), `ConfirmDialog` paper, `TimeField`/`FilterSelect` via a
      `testId` prop; selectors must append ` input` for MUI TextField roots.
- [x] **Phase 5 — real convert + CI**: `real-convert.spec.ts` (1 test, ~3.5s) drives a real
      preload + real ffmpeg conversion of a generated 1s testsrc clip via inert `E2E_REAL_*`
      dialog presets in `src/main/ipc/dialogs.ts`; `.github/workflows/e2e.yml` wires
      unit → integration → Tier A → Tier B on `windows-latest`; full suite verified green.
- **Known gaps**: none — all Phase 3 sub-items are covered (mocked 109/109 + real 1/1, 0 orphans).

## Key invariants (established during stabilization)

- Mock `reset()` must run **before** `page.reload()` in `beforeEach`; reset clears IPC listeners,
  so ordering (reset → reload → navigate) is required or progress/events never arrive.
- Use `expect.poll(...)` / `page.waitForFunction` for async renderer state; never rely on
  renderer-triggered matchers that race React state updates.
- Target toasts via `getByRole('alert').filter({ hasText })` to avoid strict-mode collisions with
  the "Hardware acceleration" info banner.
- `closeApp` force-kills the full process tree on Windows (`taskkill /T`) — plain `process.kill`
  orphaned renderer/GPU children, which flaked the pre-existing `cli.spec.ts`.
- `HWACCEL_DEFAULTS.ENABLED` is `true`, so the mode/encoder selects are visible on a fresh
  Settings page; `localStorage` (e.g. `encodex-hwaccel`) survives `reload()` and is NOT cleared by
  mock `reset()`.
- Assert main-process calls via `mockApi.get(page)` snapshots (`windowCalls`, `loginCalls`);
  App mounts already record `always-on-top:false` / `loginCalls: [false]`.
- Tier B uses a **standalone** `e2e/vitest.e2e.real.config.ts` (not `mergeConfig`) — merging did
  not replace `include`, so the default config ran all 11 spec files; the standalone config only
  includes `real-convert.spec.ts` and runs without `ENCODEX_TEST_MODE`.
- `E2E_REAL === 'true'` presets in `src/main/ipc/dialogs.ts` are inert in production (gated on the
  env var); the real tier has no `__test` surface in the preload.
- Timeline drag/scrub pointer gotchas: the playhead line (z-index 4) covers the start handle
  (z-index 3) at x=0, so drag the handle's right edge; the scroller has `minWidth: 100%`, so compute
  zoom from handle positions `(endHandle.x - startHandle.x) / duration`, never `scroller.width`.
- OneDrive sync of this folder intermittently reverts files mid-session; verify with
  `git status`/file reads before assuming state.
