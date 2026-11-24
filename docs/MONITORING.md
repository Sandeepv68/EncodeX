# Error Monitoring (Sentry primary, PostHog additive)

EncodeX integrates error/performance monitoring through a **provider-agnostic
monitoring layer**. Application code only talks to the shared facade; Sentry is
the primary adapter. When PostHog is configured and telemetry consent is on, the
facade also forwards errors to the analytics layer as PostHog `$exception`
events. Both paths are governed by one Settings toggle.

## Architecture

```
App code ──► shared/monitoring facade
                  │ MonitorProvider interface
                  ▲
    SentryMainProvider      SentryRendererProvider     NoopProvider
    (main process)          (renderer)                 (default)
                  │
                  └──► AnalyticsService.captureAnalyticsException
                              │
                              ▼
                       PostHogMainProvider
                       (main process, $exception)
```

- `src/shared/monitoring/types.ts` — the provider contract ("port").
- `src/shared/monitoring/MonitoringService.ts` — facade singleton; never throws,
  no-ops before init and while consent is off, and fans out exceptions to the
  analytics facade when the active analytics provider is enabled.
- `src/main/monitoring/sentryMainProvider.ts` — full-feature Sentry adapter for
  the main process (errors, native crash minidumps, tracing, CPU profiling,
  renderer event-loop block (ANR) detection, release-health sessions,
  screenshots).
- `src/renderer/monitoring/sentryRendererProvider.ts` — renderer adapter; events
  travel to main over the SDK's own IPC so **the DSN never enters the renderer
  bundle**.
- `src/shared/analytics/AnalyticsService.ts` — receives exception fan-out,
  buffers up to 25 pre-init exceptions, and replays them once analytics is
  initialized. Consent-off clears the buffer.
- `src/main/analytics/posthogMainProvider.ts` — forwards sanitized exceptions to
  PostHog using `posthog-node` with exception autocapture enabled. Node SDK
  dedupe prevents a duplicate event for an explicitly captured error.
- `src/renderer/analytics/posthogRendererProvider.ts` — relays renderer
  exceptions over `IPC.ANALYTICS_CAPTURE_EXCEPTION`; it does not load a
  `posthog-js` exception autocapture plugin.
- `noopProvider.ts` — safe fallback used when unconfigured or consent is off.

## Configuration

| Variable                                              | Purpose                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                                          | Enables Sentry when present (main process only). Loaded from the repo-root `.env` via dotenv (real environment variables win) or the shell. For packaged releases it is baked in at build time via `npm run gen:sentry-config` (runs automatically on `npm install` and as part of `npm run build`). The generated file (`src/main/generated/sentryBuildConfig.ts`) is git-ignored, so the DSN never enters version control. |
| `SENTRY_ENVIRONMENT`                                  | Environment label (defaults from NODE_ENV).                                                                                                                                                                                                                                     |
| `MONITORING_PROVIDER`                                 | Optional override: `sentry` \| `noop`; otherwise auto-detected from DSN.                                                                                                                                                                                                        |
| `POSTHOG_PROJECT_TOKEN` / `POSTHOG_HOST`              | Existing analytics configuration. When PostHog is the active analytics backend, exceptions also flow to PostHog; no separate exception variable is needed.                                                                                                                   |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | CI-only: production sourcemap upload via `@sentry/vite-plugin`.                                                                                                                                                                                                                 |

Release identifier: `encodex@<app version>`.

The VitePress site has its own cookieless browser exception capture through the
PostHog web snippet. It captures unhandled errors and unhandled rejections only;
console error capture and session replay stay off.

### Native CPU profiler

The profiler ships with Node-ABI prebuilds that do **not** load inside
Electron. When the binding is unavailable the provider logs a warning and
continues with tracing only - error capture is unaffected. To enable CPU
profiling in a packaged build, rebuild the binding against Electron first:

```
npx @electron/rebuild -f -w @sentry/node-cpu-profiler
```

## What gets reported

To both Sentry and PostHog when both are active:

- Uncaught exceptions and unhandled rejections.
- React errors caught by the app's ErrorBoundary.
- **Errors logged through the shared `Logger.error(...)`** in either process:
  the facade bridges ERROR-level log records into real issue events (tagged
  `handler: logger-error`), so anything printed as `[ERROR]` in the app
  console appears in the backend's issue feed.

Sentry-only features:

- Renderer crashes (`render-process-gone`) as native crash/minidump events.
- Tracing, CPU profiling, renderer event-loop block (ANR) detection, release
  health sessions, and screenshots.

Plain `console.log`/`info`/`warn` output is _not_ reported by the monitoring
facade. Set `SENTRY_DEBUG=1` to watch Sentry SDK capture/delivery in local dev.

## Privacy & consent

- Reporting is **on by default** but fully user-controllable via _Settings →
  Usage data & error reporting_. The toggle persists to
  `userData/monitoring-consent.json` and the sibling
  `userData/analytics-consent.json` used by the usage-analytics layer, which is
  seeded from it; both GUI and CLI honor them at boot.
- Turning it off closes the monitoring backend and stops analytics exception
  fan-out at runtime; turning it on again re-enables both. Pre-init exception
  buffers are cleared while consent is off.
- Sentry sends no PII by default (`sendDefaultPii: false`); user identity is only
  set if the app explicitly provides it. PostHog events and exceptions carry no
  user identity; the anonymous installation id is not derived from accounts or
  hardware.
- PostHog exception messages and stacks are an explicit exception to the
  categorical-only event rule: they are retained for triage and may contain
  paths or free text. Structured context is primitive-only, key- and
  value-filtered, and length-bounded. See
  `analytics/posthog/adr/0002-additive-posthog-error-tracking.md`.
- Duplicate capture is controlled by the Node SDK's dedupe for explicit
  captures and by using a single consent gate; Sentry adapters are unchanged.
- Since 1.0.0-beta.4, product usage events no longer ride the Sentry breadcrumb
  channel. They were moved onto a dedicated, provider-agnostic analytics layer
  (`docs/ANALYTICS.md`) that records anonymous categorical events only.

## Swapping backends later

1. Add an adapter implementing `MonitorProvider` (main and/or renderer side).
2. Register it in the respective `providerFactory.ts`.
3. Set `MONITORING_PROVIDER=<new>` (and provide its config/env).
4. Remove the Sentry adapters + package once confident.

PostHog is intentionally not a replacement `MonitorProvider`: it is an
analytics provider that receives exceptions through the shared analytics facade.
Removing or swapping Sentry therefore does not remove PostHog error capture. No
application code, IPC surface, or consent logic changes.
