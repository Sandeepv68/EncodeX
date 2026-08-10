# E2E Test Plan (Vitest + Playwright _electron, mock preload)

## Objective
Write and stabilize E2E specs for the EncodeX renderer against a mocked main-process IPC
(preload `__test` API) so the suite runs headless, fast, and deterministically on CI.

## Status (as of 2026-08-10)

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
- [x] **Phase 3 — Remaining suites** (all green, 102/102 across 10 files):
      - `video-cut.spec.ts` — 6 tests: start disabled, select video/timeline/output enables cut,
        use-duration toggle, cut success toast, live progress + cancel via confirm dialog,
        cancel-job clears form
      - `batch.spec.ts` — 6 tests: empty state, add files via review dialog, queue-added event
        seeding, live progress + finished toast, cancel all via confirm dialog, status filter
      - `logs.spec.ts` — 4 tests: emitted + startup entries, level filter, clear, download toast
      - `settings.spec.ts` — 6 tests: theme cards + default state, theme switching,
        always-on-top (windowCalls), launch-at-login (loginCalls), hwaccel mode/encoder persist
        to localStorage, hide/restore on toggle
- [x] **Phase 4 — testid hardening**: `data-testid` added to `VideoCut`, `Logs`, `Settings`
      (switches/selects/theme cards), `ConfirmDialog` paper, `TimeField`/`FilterSelect` via a
      `testId` prop; selectors must append ` input` for MUI TextField roots.
- [ ] **Phase 5 — real convert + CI**: confirm real ffmpeg conversion path once; wire the E2E job
      into the CI workflow.
- **Known gaps (not yet covered)**: batch reorder / single-job remove /
      close-with-active-jobs confirmation; video-cut timeline drag/scrub;
      image-compress quality/scale; audio-extract bitrate; convert pixel format.

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
- OneDrive sync of this folder intermittently reverts files mid-session; verify with
  `git status`/file reads before assuming state.
