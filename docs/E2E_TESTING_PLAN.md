# E2E Testing Plan (Playwright UI Tests)

## Goal

Replace the current smoke-only `e2e/app.spec.ts` with complete, deterministic,
per-page UI tests driven by Playwright, plus a small real-backend smoke tier.

## Tooling

- **Vitest** (v4.1.10) as the runner, config: `e2e/vitest.e2e.config.ts`.
- **Playwright** `_electron` launcher for the Electron app.
- Two tiers:
  - **Tier A — Deterministic UI tests (mocked `electronAPI`).** Fast, no native
    dialogs, no real ffmpeg. The default `test:e2e` run.
  - **Tier B — Real-backend smoke tests (real preload + real ffmpeg).** Slower,
    gated by the `E2E_REAL` env var; runs actual conversions on generated media.

## Mock strategy

A real `contextBridge.exposeInMainWorld` object cannot be cleanly redefined from
`addInitScript`, so an opt-in **test-mode preload swap** is used:

- `src/main/index.ts` loads `e2e/mocks/preload.js` instead of the real preload
  when `ENCODEX_TEST_MODE === '1'` (only reachable during e2e runs).
- `e2e/mocks/preload.js` exposes the full `ElectronAPI` shape backed by a
  shared in-memory store (`e2e/mocks/main-store.js`), plus a `window.electronAPI.__test`
  control surface used by specs to drive dialogs, progress events, queue jobs,
  and log messages.
- No production behavior changes; the branch is inert unless the env var is set.

## Selector strategy

- Never select by translated text — use roles, MUI-generated structure, and
  targeted `data-testid` attributes added during Phase 4.
- i18n: the real app loads English translations, but tests stay language-agnostic.

## File structure

```
e2e/
  vitest.e2e.config.ts      # env E2E=true, ENCODEX_TEST_MODE=1, retries, screenshots
  helpers.ts                # existing media generators / build checks
  fixtures/app.ts           # launch/teardown helper (one Electron per spec file)
  mocks/
    main-store.js           # shared in-memory state + event emitter (plain JS)
    preload.js              # test-mode contextBridge exposing mock electronAPI
    control.ts              # typed helpers to drive the mock from specs
  specs/
    shell.spec.ts           # title bar, drawer nav, routes, theme, language
    convert.spec.ts
    media-info.spec.ts
    image-compress.spec.ts
    audio-extract.spec.ts
    video-cut.spec.ts
    batch.spec.ts
    logs.spec.ts
    settings.spec.ts
    real-convert.spec.ts    # Tier B, gated by E2E_REAL
```

## Phases

### Phase 1 — Infrastructure
- [x] `e2e/mocks/main-store.js` — mutable state + subscription emitter.
- [x] `e2e/mocks/preload.js` — mock `electronAPI` + `__test` control surface.
- [x] Test-mode preload swap in `src/main/index.ts`.
- [x] `e2e/fixtures/app.ts` — build check, launch, window resolution, teardown.
- [x] Update `e2e/vitest.e2e.config.ts` (env, retries on CI, screenshots).
- [x] npm scripts: `test:e2e` (mocked), `test:e2e:real` (Tier B).

### Phase 2 — Shell + navigation
- [x] Title/window smoke, `electronAPI` surface checks (absorbs old app.spec.ts).
- [x] Drawer shows all 9 nav items; each navigates to its route without an
      ErrorBoundary fallback.
- [x] Theme toggle and language menu smoke tests.

### Phase 3 — Per-page feature specs (Tier A)
- [x] **Convert** — browse/select, output select, codec/bitrate/scale/transcoder,
      copy mode, start → progress → completion toast, pause/resume/cancel.
      (pix-fmt option not asserted explicitly.)
- [x] **MediaInfo** — select file → video/audio stream sections + EXIF.
- [x] **ImageCompress** — select image, preview/info, format, compress → result.
      (quality/scale not changed in a test.)
- [x] **AudioExtract** — select video, codec, extract, derived output.
      (bitrate not changed in a test.)
- [x] **VideoCut** — select video, timeline loads, duration field, cut, progress,
      cancel + cancel-job. (No timeline drag/scrub test yet.)
- [x] **Batch** — add files, queue events, progress, cancel-all, status filter.
      (reorder, single-job remove, and close-with-active-jobs confirmation
      not yet covered.)
- [x] **Logs** — pushed `onLogMessage` entries render in the panel, filter, clear,
      download.
- [x] **Settings** — theme switching, always-on-top, launch-at-login, hwaccel
      persistence + window calls.

### Phase 4 — Selector hardening
- [x] Add `data-testid` to interactive components (`CodecSelect`, `GroupedSelect`,
      `FileDropZone`, timeline, primary buttons, Settings switches/selects/cards,
      `ConfirmDialog`).

### Phase 5 — Real tier + CI
- [ ] `real-convert.spec.ts` — real conversion of generated media → output exists.
- [ ] `.github/workflows/e2e.yml` — build, xvfb (Linux), `test:e2e`.
- [ ] Verify full suite runs green.

## Risks

- **i18n** — selectors must not depend on translated text (Phase 4).
- **Launch cost** — reuse one Electron instance per spec; limit workers.
- **Native dialogs** — Tier A never opens them (mocked); Tier B uses generated
  files with no dialog interaction.
- **MUI dropdowns / timeline** — need stable selectors; timeline drag needs
  `mouse.move` steps.

---

## Progress

| Phase | Status |
| --- | --- |
| 1. Infrastructure | Done |
| 2. Shell + navigation | Done |
| 3. Per-page specs | Done (see known gaps above) |
| 4. Selector hardening | Done |
| 5. Real tier + CI | Not started |
