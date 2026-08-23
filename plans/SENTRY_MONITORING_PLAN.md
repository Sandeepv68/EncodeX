# Sentry Monitoring Integration Plan â€” EncodeX

> Status legend: `[ ]` pending Â· `[~]` in progress Â· `[x]` done
>
> **Goal:** Integrate Sentry with **all features enabled**, behind a provider-agnostic
> monitoring layer so the backend can be swapped later with minimal code change.

---

## 1. Decisions Log

| #   | Decision      | Choice                                                                                                                                                                                  |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Consent model | **On by default** + Settings toggle (persists to `userData/monitoring-consent.json`, single source of truth readable by main & CLI pre-boot)                                            |
| D2  | Scope         | GUI **and** CLI mode (`encodex --cli`) both report                                                                                                                                      |
| D3  | Backend       | SaaS sentry.io (DSN via env var)                                                                                                                                                        |
| D4  | Feature depth | **All bells and whistles** â€” use full `@sentry/electron` SDK capabilities (tracing, profiling, ANR, sessions, native crash reporting, screenshots, user feedback, Spotlight dev mode) |

## 2. Architecture â€” Ports & Adapters

```
App code â”€â”€â–º monitor facade (singleton, src/shared/monitoring)
                  â”‚ delegates to MonitorProvider interface   â† the "port"
                  â–² implemented by                            â† adapters ("ports")
     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
SentryMainProvider  NoopProvider   SentryRendererProvider  (future providers:
(src/main, full     (default)      (src/renderer, wraps    one file each)
 @sentry/electron)                 @sentry/electron/renderer)
```

- App code only ever calls `monitor.captureException(err, { tags, extra })` etc.
- Renderer uses `@sentry/electron/renderer` directly inside its adapter â†’ keeps ALL
  automatic instrumentation (global handlers, breadcrumbs, tracing) while app code stays
  provider-agnostic.
- DSN lives only in the **main process**; renderer SDK forwards over Sentry's own IPC.

### Feature matrix (full-feature mode)

| Feature                                                     | Where           | Enabled via                                                                |
| ----------------------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| Error capture + global handlers (uncaught/unhandled)        | Main + Renderer | SDK auto + explicit wiring in bootstrap                                    |
| Native crash minidumps (render-process-gone, child crashes) | Main            | SDK default crashReporter                                                  |
| Performance tracing (`tracesSampleRate`)                    | Main + Renderer | init options                                                               |
| Profiling (`profilesSampleRate`)                            | Main            | `@sentry/profiling-node` (graceful fallback if native binding unavailable) |
| ANR detection (main-process hangs)                          | Main            | `anrDetection`                                                             |
| Release health / sessions                                   | Main            | SDK default                                                                |
| Screenshots on error                                        | Main            | `attachScreenshot` option                                                  |
| Breadcrumbs (console, ipc, etc.)                            | Both            | SDK defaults (+ existing console patches feed it)                          |
| User feedback / crash report dialog                         | Renderer/Main   | facade `captureFeedback` + dialog on fatal                                 |
| Spotlight local debugging                                   | Dev only        | `spotlight: NODE_ENV==='development'`                                      |
| Sourcemaps upload (readable prod traces)                    | CI/build        | `@sentry/vite-plugin` (renderer) + tsc sourceMap for main/preload          |
| Session Replay                                              | â€”             | âŒ Not supported for Electron renderer (SDK limitation); documented        |

## 3. Config / Environment

```bash
# .env / environment
SENTRY_DSN=...                # enables Sentry (absent â‡’ NoopProvider)
SENTRY_ENVIRONMENT=development|production
MONITORING_PROVIDER=sentry    # optional override ('sentry' | 'noop')
# CI-only sourcemap upload:
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=...
SENTRY_PROJECT=...
```

Consent file: `<userData>/monitoring-consent.json` â†’ `{ "enabled": true }` (absent â‡’ enabled).

## 4. Phases

### Phase 0 â€” Dependency âœ… (2026-08-22)

- [x] 0.1 Install `@sentry/electron` â†’ v7.17.0
- [x] 0.2 Install `@sentry/profiling-node` â†’ v10.70.0 (native binding verified working via prebuilds)
- [x] 0.3 Install `@sentry/vite-plugin` â†’ v5.4.0 (devDep)
- [x] 0.4 Verified API surface: `@sentry/electron/{main,renderer,preload}` exports; `anrIntegration`, `nodeProfilingIntegration`, `captureFeedback`, `preloadInjectionIntegration` all present

### Phase 1 â€” Shared contracts âœ… (2026-08-22)

- [x] 1.1 `src/shared/monitoring/types.ts` â€” `MonitorProvider`, `MonitorContext`, `MonitoringConfig`, levels
- [x] 1.2 `src/shared/monitoring/MonitoringService.ts` â€” facade singleton `monitor`, `initMonitoring()`, never-throws guarantees
      â†³ deviation: NoopProvider placed at `src/shared/monitoring/noopProvider.ts` (dependency-free; needed by BOTH processes as fallback)
- [x] 1.3 Unit tests: facade delegation, no-op-before-init, never throws â€” 10/10 passing

### Phase 2 â€” Main-side providers âœ… (2026-08-22)

- [x] 2.1 NoopProvider â†’ placed at `src/shared/monitoring/noopProvider.ts` (see Phase 1 deviation)
- [x] 2.2 `src/main/monitoring/sentryMainProvider.ts` â€” full options (traces/profiles/session/ANR/screenshots/native crashes via defaults), lazy import, profiling guarded dynamic import; SDK's OnUncaughtException/OnUnhandledRejection defaults intentionally kept (explicit handlers live at bootstrap; see note)
      â†³ NOTE: explicit process handlers were added at bootstrap AND SDK defaults remain active; dedup relies on Sentry event grouping. Revisit if duplicates appear.
- [x] 2.3 `src/main/monitoring/providerFactory.ts` (`MONITORING_PROVIDER` env or DSN presence)

### Phase 3 â€” Consent persistence (main) âœ… (2026-08-22)

- [x] 3.1 `src/main/monitoring/consent.ts` â€” read/write `userData/monitoring-consent.json` (absent â‡’ enabled)
- [x] 3.2 Runtime enable/disable semantics in facade (`setMonitoringEnabled`) + provider close/re-init

### Phase 4 â€” IPC surface âœ… (2026-08-22)

- [x] 4.1 `IPC.MONITORING_GET_STATE` + `IPC.MONITORING_SET_ENABLED` in `src/shared/ipc-channels.ts`
- [x] 4.2 `src/main/monitoring/ipcBridge.ts` â€” handlers feed consent + state queries (returns `{enabled, backend}` so renderer mirrors main's backend choice)
- [x] 4.3 Preload exposure: `monitoringGetState()`, `monitoringSetEnabled()`
- [x] 4.4 Synced `src/renderer/electron-api.d.ts`
- [x] 4.5 Synced `e2e/mocks/preload.js`

### Phase 5 â€” Main bootstrap wiring âœ… (2026-08-22)

- [x] 5.1 GUI branch: consent read â†’ `initMonitoring()` first at module load, before window creation
- [x] 5.2 CLI branch: same shared bootstrap
- [x] 5.3 `process.on('uncaughtException')` / `'unhandledRejection'` â†’ capture
- [x] 5.4 `render-process-gone` / `child-process-gone` â†’ capture; `will-quit` flushes/closes; CLI exit paths close too

### Phase 6 â€” Renderer wiring âœ… (2026-08-22)

- [x] 6.1 `src/renderer/monitoring/sentryRendererProvider.ts` (+ `providerFactory.ts`) â€” wraps `@sentry/electron/renderer`; SDK GlobalHandlers default disabled, replaced by explicit facade-routed listeners (swappability); events flow over SDK IPC, DSN stays in main
- [x] 6.2 Init before React mount in `src/renderer/main.tsx` + global `error`/`unhandledrejection` through facade; mount guaranteed via `.finally`
- [x] 6.3 `ErrorBoundary.componentDidCatch` â†’ capture with componentStack extra

### Phase 7 â€” Settings UI toggle

- [x] 7.1 `settingsStore.ts`: `monitoringEnabled` state + setter calling IPC
- [x] 7.2 Toggle UI in `Settings.tsx` (follow launchAtLogin precedent)
- [x] 7.3 i18n keys (en + all locales present under `src/renderer/i18n/locales`) + `npm run validate:locales`

### Phase 8 â€” Sourcemaps

- [x] 8.1 `tsconfig.main.json` / `tsconfig.preload.json`: `"sourceMap": true`
- [x] 8.2 `vite.config.ts`: conditional `@sentry/vite-plugin` (only when `SENTRY_AUTH_TOKEN` present) + `build.sourcemap`
- [x] 8.3 electron-builder: keep maps out of packaged app where sensible

### Phase 9 â€” Config & docs

- [x] 9.1 `.env.example` (repo has none â€” create; do NOT commit real `.env`)
- [x] 9.2 Docs note (docs site page or README section): env vars, privacy statement, swap guide

### Phase 10 â€” Tests

- [x] 10.1 Facade tests (Phase 1 covers) â€” extend for setEnabled semantics
- [x] 10.2 `consent.test.ts` (tmp dir based)
- [x] 10.3 `noopProvider.test.ts`
- [x] 10.4 `ipcBridge.test.ts` (mock `electron` ipcMain)
- [x] 10.5 `sentryMainProvider.test.ts` (vi.mock `@sentry/electron`)
- [x] 10.6 settingsStore monitoring tests

### Phase 11 â€” Verification

- [x] 11.1 `npm run typecheck` (all three projects)
- [x] 11.2 `npm run lint`
- [x] 11.3 `npm run test:unit`
- [x] 11.4 `npm run validate:locales`
- [ ] 11.5 Manual smoke: dev run with fake DSN â†’ event in dashboard; toggle off â†’ silence; CLI error path reported

## 5. Swap-Out Guide (future backend change)

1. Add `providers/<newBackend>MainProvider.ts` (+ renderer counterpart if needed) implementing `MonitorProvider`.
2. Register it in the factory map (`'newbackend': ...`).
3. Set `MONITORING_PROVIDER=newbackend`.
4. Delete Sentry adapter files + npm package when confident.
5. App code, IPC surface, consent logic, settings UI: **unchanged**.

## 6. Rollback

Set `MONITORING_PROVIDER=noop` (or unset `SENTRY_DSN`) â€” entire system becomes a no-op without code changes. Removing the feature = revert this branch.
