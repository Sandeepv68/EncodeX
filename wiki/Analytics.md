# 📊 Usage Analytics (PostHog / Aptabase, swappable)

EncodeX records anonymous, **categorical-only** usage events through a
provider-agnostic analytics layer. Application code only talks to the shared
facade; PostHog and Aptabase are interchangeable adapters behind it.
Error/performance monitoring lives on a separate layer ([[Monitoring]]); both
are governed by a single Settings toggle.

## Architecture

```
App code ──► shared/analytics facade (initAnalytics / recordAnalyticsEvent / ...)
                  │ AnalyticsProvider interface
                  ▲
    PostHogMainProvider      AptabaseMainProvider      NoopProvider
    (main process)           (main process, lazy)      (default)
                  ▲
    PostHogRendererProvider  AptabaseRendererProvider
    (renderer → IPC → main)  (renderer → aptabase-ipc → main)
```

- `src/shared/analytics/types.ts` — provider contract ("port").
- `src/shared/analytics/events.ts` — **authoritative taxonomy**: event names,
  categorical payloads, functional group (`ANALYTICS_EVENT_GROUP`) and rollout
  tier (`ANALYTICS_TIER`). Audit this file before adding a new event.
- `src/shared/analytics/sanitize.ts` — shared prop sanitizer used by every
  adapter.
- `src/shared/analytics/AnalyticsService.ts` — facade singleton; never throws,
  no-ops before init and while consent is off, buffers pre-init events.
- `src/main/analytics/posthogMainProvider.ts` — the **only** module that
  constructs the PostHog client; also forwards AI Observability generations.
- `src/main/analytics/aptabaseMainProvider.ts` — the **only** module importing
  `@aptabase/electron/main`; lazy SDK load, payload sanitization, per-group
  gate, in-flight tracking for `flush`/`close`.
- `src/main/analytics/providerFactory.ts` — backend selection from config/env.
- Renderer never sees a backend credential. PostHog renderer events relay over
  `IPC.ANALYTICS_TRACK_EVENT` to the main-process provider; Aptabase renderer
  events use the SDK's own `aptabase-ipc` transport.

## Configuration

| Variable                     | Purpose |
| ---------------------------- | ------- |
| `POSTHOG_PROJECT_TOKEN`      | Enables PostHog when present (main process only; public project token). Baked by `npm run gen:posthog-config`; runtime env wins. |
| `POSTHOG_HOST`               | PostHog ingestion host (for example `https://us.i.posthog.com`); required when PostHog is active. |
| `POSTHOG_AI_CAPTURE_CONTENT` | Set to `true` to send AI prompt/completion content to PostHog AI Observability. Default is metadata only. |
| `APTABASE_APP_KEY`           | Enables Aptabase when present (main process only; `A-{US\|EU\|DEV\|SH}-...`). Loaded from `APTABASE_BUILD_CONFIG` at build time (git-ignored, baked by `npm run gen:aptabase-config`); runtime env wins. |
| `APTABASE_HOST`              | Only for self-hosted Aptabase. Leave empty on cloud. |
| `APTABASE_ENVIRONMENT`       | Environment label (defaults from `NODE_ENV`). |
| `ANALYTICS_PROVIDER`         | Optional override: `posthog` \| `aptabase` \| `noop`; otherwise PostHog wins when its token is present, then Aptabase. |
| `ANALYTICS_GROUPS`           | Per-group emission gate (comma-separated); a noisy group can be disabled without a release. |
| `APTABASE_DEBUG`             | `1` to watch SDK logging in local dev. |

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
  PostHog uses a random anonymous installation id persisted in `userData` for
  cross-session retention; it is not derived from hardware or accounts.
- **AI Observability is metadata-only by default** (model, latency, token
  counts, error status). Prompt/completion content is sent only when
  `POSTHOG_AI_CAPTURE_CONTENT=true` is explicitly configured.

## Event catalog & dashboards

See `src/shared/analytics/events.ts` for every event, payload schema, group,
and tier. Recommended funnels, feature-adoption and retention queries live in
`docs/ANALYTICS.md`.

## Swapping backends later

1. Add an adapter implementing `AnalyticsProvider` (main and renderer).
2. Register it in the respective `providerFactory.ts`.
3. Set `ANALYTICS_PROVIDER=<new>`.
4. Remove the adapters + package for any backend you no longer ship.

No application code, IPC surface, or consent logic changes.