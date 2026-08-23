# Error Monitoring (Sentry, swappable)

EncodeX integrates error/performance monitoring through a **provider-agnostic
monitoring layer**. Application code only ever talks to the shared facade;
Sentry is just the first adapter behind it.

## Architecture

```
App code ──► shared/monitoring facade (initMonitoring / captureException / ...)
                  │ MonitorProvider interface
                  ▲
   SentryMainProvider      SentryRendererProvider     NoopProvider
   (main process)          (renderer)                 (default)
```

- `src/shared/monitoring/types.ts` — the provider contract ("port").
- `src/shared/monitoring/MonitoringService.ts` — facade singleton; never throws,
  no-ops before init and while consent is off.
- `src/main/monitoring/sentryMainProvider.ts` — full-feature Sentry adapter for
  the main process (errors, native crash minidumps, tracing, CPU profiling,
  renderer event-loop block (ANR) detection, release-health sessions,
  screenshots).
- `src/renderer/monitoring/sentryRendererProvider.ts` — renderer adapter; events
  travel to main over the SDK's own IPC so **the DSN never enters the renderer
  bundle**.
- `noopProvider.ts` — safe fallback used when unconfigured or consent is off.

## Configuration

| Variable                                              | Purpose                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `SENTRY_DSN`                                          | Enables Sentry when present (main process only).                         |
| `SENTRY_ENVIRONMENT`                                  | Environment label (defaults from NODE_ENV).                              |
| `MONITORING_PROVIDER`                                 | Optional override: `sentry` \| `noop`; otherwise auto-detected from DSN. |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | CI-only: production sourcemap upload via `@sentry/vite-plugin`.          |

Release identifier: `encodex@<app version>`.

### Native CPU profiler

The profiler ships with Node-ABI prebuilds that do **not** load inside
Electron. When the binding is unavailable the provider logs a warning and
continues with tracing only - error capture is unaffected. To enable CPU
profiling in a packaged build, rebuild the binding against Electron first:

```
npx @electron/rebuild -f -w @sentry/node-cpu-profiler
```

## Privacy & consent

- Reporting is **on by default** but fully user-controllable via _Settings →
  Error reporting_. The toggle persists to `userData/monitoring-consent.json`,
  which both GUI and CLI honor at boot.
- Turning it off closes the backend at runtime; nothing is captured afterwards.
- No PII is sent by default (`sendDefaultPii: false`); user identity is only set
  if the app explicitly provides it.

## Swapping backends later

1. Add an adapter implementing `MonitorProvider` (main and/or renderer side).
2. Register it in the respective `providerFactory.ts`.
3. Set `MONITORING_PROVIDER=<new>` (and provide its config/env).
4. Remove the Sentry adapters + package once confident.

No application code, IPC surface, or consent logic changes.
