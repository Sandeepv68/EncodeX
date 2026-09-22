# 📊 Usage Analytics (Aptabase, swappable)

EncodeX records anonymous, **categorical-only** usage events through a
provider-agnostic analytics layer. Application code only talks to the shared
facade; Aptabase is the first adapter behind it. Error/performance monitoring
lives on a separate layer ([[Monitoring]]); both are governed by a single
Settings toggle.

## Architecture

```
App code ──► shared/analytics facade (initAnalytics / recordAnalyticsEvent / ...)
                  │ AnalyticsProvider interface
                  ▲
    AptabaseMainProvider     NoopProvider
    (main process, lazy)     (default)
```

- `src/shared/analytics/types.ts` — provider contract ("port").
- `src/shared/analytics/events.ts` — **authoritative taxonomy**: event names,
  categorical payloads, functional group (`ANALYTICS_EVENT_GROUP`) and rollout
  tier (`ANALYTICS_TIER`). Audit this file before adding a new event.
- `src/shared/analytics/AnalyticsService.ts` — facade singleton; never throws,
  no-ops before init and while consent is off, buffers pre-init events.
- `src/main/analytics/aptabaseMainProvider.ts` — the **only** module importing
  `@aptabase/electron/main`; lazy SDK load, payload sanitization, per-group
  gate, in-flight tracking for `flush`/`close`.
- `src/main/analytics/providerFactory.ts` — backend selection from config/env.
- Renderer events travel to main over the SDK's own `aptabase-ipc` transport;
  the App Key never enters the renderer bundle.

## Configuration

| Variable             | Purpose |
| -------------------- | ------- |
| `APTABASE_APP_KEY`   | Enables analytics when present (main process only; `A-{US\|EU\|DEV\|SH}-...`). |
| `APTABASE_HOST`      | Only for self-hosted Aptabase. Leave empty on cloud. |
| `APTABASE_ENVIRONMENT` | Environment label (defaults from `NODE_ENV`). |
| `ANALYTICS_PROVIDER` | Optional override: `aptabase` \| `noop`; auto-detected from App Key. |
| `ANALYTICS_GROUPS`   | Per-group emission gate (comma-separated); a noisy group can be disabled without a release. |
| `APTABASE_DEBUG`     | `1` to watch SDK logging in local dev. |

Groups: `lifecycle`, `onboarding`, `nav`, `convert`, `image`, `audio`, `cut`,
`queue`, `profiles`, `settings`, `mcp`, `updates`, `hw`, `cli`, `ux`.

## Privacy & consent

- On by default, but fully user-controllable via _Settings → Usage data & error
  reporting_ — the single toggle drives both analytics and monitoring. Consent
  persists to `analytics-consent.json` (seeded from `monitoring-consent.json`)
  and is honored by GUI and CLI.
- `telemetry_opt_out` fires *before* disabling; `telemetry_opt_in` fires
  *after* re-enabling.
- **Privacy contract:** payloads are categorical-only — no media content, file
  names, folder paths, file sizes, or personal identifiers. Durations/counts
  are bucketed; the adapters strip non-serializable props as defense in depth.

## Event catalog & dashboards

See `src/shared/analytics/events.ts` for every event, payload schema, group,
and tier. Recommended funnels, feature-adoption and retention queries live in
`docs/ANALYTICS.md`.

## Swapping backends later

1. Add an adapter implementing `AnalyticsProvider` (main and renderer).
2. Register it in the respective `providerFactory.ts`.
3. Set `ANALYTICS_PROVIDER=<new>`.
4. Remove the Aptabase adapters + package once confident.

No application code, IPC surface, or consent logic changes.