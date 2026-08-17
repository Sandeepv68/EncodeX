# Analytics Integration via Aptabase

## Overview

EncodeX uses [Aptabase](https://aptabase.com) for privacy-first, open-source analytics. The integration is built behind an abstraction layer so the analytics backend can be swapped with minimal code changes.

## Architecture

```
src/shared/analytics/
├── types.ts              # AnalyticsProvider interface + AnalyticsConfig
├── analytics-constants.ts # localStorage key + defaults for opt-out
├── noop-provider.ts      # No-op fallback (disabled / no key / tests)
├── provider.ts           # Singleton holder + getAnalytics / setAnalyticsProvider / setAnalyticsEnabled
├── aptabase-main.ts      # Aptabase main-process implementation
├── aptabase-renderer.ts  # Aptabase renderer-process implementation
└── analytics.ts          # High-level domain API (analytics.conversionStarted, etc.)
```

### Design Principles

- **Interface + Factory pattern** — mirrors the existing `ITranscoder` / `createTranscoder` abstraction in `src/main/transcoders/`.
- **Process-aware providers** — `@aptabase/electron` requires separate imports for main (`@aptabase/electron/main`) and renderer (`@aptabase/electron/renderer`). Each has its own thin provider file.
- **Lazy SDK loading** — providers use `require()` at call time to avoid top-level import side effects and to gracefully degrade when the SDK is unavailable (e.g. during tests).
- **Centralized event API** — business logic never calls `trackEvent` directly. All calls go through `analytics.ts`, which provides typed, domain-specific methods.
- **Opt-out at provider level** — `setAnalyticsEnabled(false)` makes `getAnalytics()` return a `NoopProvider`, so all `analytics.*()` calls become silent no-ops.

## Provider Interface

```ts
// src/shared/analytics/types.ts
interface AnalyticsProvider {
  initialize(config: AnalyticsConfig): void;
  track(eventName: string, properties?: Record<string, string | number>): void;
  shutdown(): void;
}

interface AnalyticsConfig {
  appKey: string;
  appVersion: string;
  isDebug: boolean;
}
```

To swap Aptabase for another provider, implement `AnalyticsProvider` in a new file and update the initialization callsites. The high-level `analytics.ts` API and all business logic remain untouched.

## Environment Variables

| Variable | Process | Purpose |
|---|---|---|
| `APTABASE_APP_KEY` | Main (Node.js) | Read via `process.env.APTABASE_APP_KEY` |
| `VITE_APTABASE_APP_KEY` | Renderer (Vite) | Read via `import.meta.env.VITE_APTABASE_APP_KEY` |
| `VITE_APP_VERSION` | Renderer (Vite) | App version string for Aptabase session metadata |

Both key variables should hold the same value. They are separate because the main process reads `process.env` directly while Vite only exposes `VITE_*`-prefixed vars to the renderer.

Set these in `.env` (gitignored) at the project root. See `.env.example` for the template.

## Initialization Flow

### Main Process (`src/main/index.ts`)

```ts
const aptabaseKey = process.env.APTABASE_APP_KEY;
if (aptabaseKey) {
  const provider = new AptabaseMainProvider();
  setAnalyticsProvider(provider);
  provider.initialize({
    appKey: aptabaseKey,
    appVersion: pkg.version,
    isDebug: !app.isPackaged,
  });
}
```

Runs once at startup, before `app.whenReady()`. Aptabase automatically detects debug vs release from `app.isPackaged`.

### Renderer Process (`src/renderer/main.tsx`)

```ts
const aptabaseKey = import.meta.env.VITE_APTABASE_APP_KEY;
if (aptabaseKey) {
  const rendererProvider = new AptabaseRendererProvider();
  setAnalyticsProvider(rendererProvider);
  rendererProvider.initialize({
    appKey: aptabaseKey,
    appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
    isDebug: import.meta.env.DEV,
  });
}
```

Runs once before React mounts. The renderer SDK delegates to the main process via IPC.

## Event Taxonomy

All events are defined in `src/shared/analytics/analytics.ts`. Custom properties are limited to strings and numbers per the Aptabase SDK contract.

| Event Name | Trigger | Properties |
|---|---|---|
| `app_started` | Main process `app.whenReady()` | — |
| `app_quit` | Main process `will-quit` | — |
| `screen_view` | Route change in React Router | `screen` (path) |
| `conversion_started` | `CONVERT_FILE` IPC handler begins | `codec`, `inputFormat` |
| `conversion_completed` | Conversion emitter fires `end` | `codec`, `durationSec` |
| `conversion_failed` | Conversion emitter fires `error` | `code` (ErrorCode), `codec` |
| `conversion_cancelled` | `CANCEL_CONVERSION` IPC handler | `codec` |
| `batch_started` | `QUEUE_START` IPC handler | `jobCount` |
| `batch_completed` | JobQueue `drained` event | `jobCount`, `durationSec` |
| `error_occurred` | `formatError()` in `src/shared/errors.ts` | `code`, `context` (first 100 chars) |
| `setting_changed` | Settings toggle changed | `setting`, `value` |
| `feature_used` | Feature-specific usage | `feature` |

## Integration Points

### Conversion Lifecycle (`src/main/ipc/conversion.ts`)

- `conversion_started` — fired at the start of the `CONVERT_FILE` handler, before the transcoder begins.
- `conversion_completed` — fired on the `end` event, with wall-clock duration.
- `conversion_failed` — fired on the `error` event, with the normalized error code.
- `conversion_cancelled` — fired in the `CANCEL_CONVERSION` handler.

### Batch Queue (`src/main/ipc/queue.ts`)

- `batch_started` — fired when `QUEUE_START` is handled, with the count of queued jobs.
- `batch_completed` — fired when the JobQueue emits `drained`.

### Error Tracking (`src/shared/errors.ts`)

- `error_occurred` — fired inside `formatError()` for every non-CANCELLED error.
- `CANCELLED` errors are explicitly skipped since they represent user intent, not failures.

### Screen Tracking (`src/renderer/App.tsx`)

- `screen_view` — fired on every React Router location change via the `<ScreenTracker />` component.

## Opt-Out Mechanism

### User Preference

- Stored in localStorage under `encodex-analytics-enabled` (`true`/`false`).
- Default: `true` (analytics enabled).
- Read at startup by `settingsStore` and synced to the provider-level flag.

### Settings UI (`src/renderer/pages/Settings.tsx`)

A "Usage Analytics" toggle switch lets users opt out. Toggling it:
1. Persists the new value to localStorage.
2. Calls `setAnalyticsEnabledFlag()` to gate all subsequent `track()` calls.
3. Fires a `setting_changed` event (only when enabling).

### Provider-Level Gating

```ts
// src/shared/analytics/provider.ts
export function getAnalytics(): AnalyticsProvider {
  if (!enabled) return new NoopProvider();
  if (!provider) return new NoopProvider();
  return provider;
}
```

When disabled, every `analytics.*()` call is a silent no-op — no SDK calls, no network requests.

## Swapping the Provider

To replace Aptabase with another analytics backend (e.g. PostHog, Mixpanel):

1. Create `src/shared/analytics/posthog-provider.ts` implementing `AnalyticsProvider`.
2. Update the initialization in `src/main/index.ts` and `src/renderer/main.tsx` to instantiate the new provider.
3. No changes to `analytics.ts`, `errors.ts`, `conversion.ts`, `queue.ts`, `App.tsx`, or any other business logic.

## Files Changed

### New Files

| File | Purpose |
|---|---|
| `src/shared/analytics/types.ts` | Provider interface and config types |
| `src/shared/analytics/analytics-constants.ts` | Storage key and default for opt-out |
| `src/shared/analytics/noop-provider.ts` | No-op fallback provider |
| `src/shared/analytics/provider.ts` | Singleton holder, factory, enabled flag |
| `src/shared/analytics/aptabase-main.ts` | Aptabase main-process provider |
| `src/shared/analytics/aptabase-renderer.ts` | Aptabase renderer-process provider |
| `src/shared/analytics/analytics.ts` | High-level domain tracking API |
| `.env` | Environment variables (gitignored) |
| `.env.example` | Template for environment variables |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Added `@aptabase/electron` dependency |
| `src/main/index.ts` | Initialize main analytics provider, track app lifecycle |
| `src/renderer/main.tsx` | Initialize renderer analytics provider |
| `src/renderer/App.tsx` | Added `<ScreenTracker />` for route-based screen_view |
| `src/main/ipc/conversion.ts` | Track conversion lifecycle events |
| `src/main/ipc/queue.ts` | Track batch start/completion events |
| `src/shared/errors.ts` | Track non-cancelled errors in `formatError()` |
| `src/renderer/stores/settingsStore.ts` | Added `analyticsEnabled` persistence and provider sync |
| `src/renderer/stores/types.ts` | Added `analyticsEnabled` + `setAnalyticsEnabled` to `SettingsState` |
| `src/renderer/pages/Settings.tsx` | Added analytics opt-out toggle |
| `src/renderer/vite-env.d.ts` | Type declarations for Vite env vars |
