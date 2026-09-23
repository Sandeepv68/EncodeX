# Usage Analytics (Aptabase, swappable)

EncodeX ships anonymous, categorical-only usage analytics through a
**provider-agnostic analytics layer**. Application code only talks to the
shared facade; Aptabase is the first adapter behind it. Error/performance
monitoring lives on a separate layer (see `docs/MONITORING.md`); both are
governed by a single Settings toggle.

## Architecture

```
App code ──► shared/analytics facade (initAnalytics / recordAnalyticsEvent / ...)
                  │ AnalyticsProvider interface
                  ▲
    AptabaseMainProvider     NoopProvider
    (main process, lazy)     (default)
```

- `src/shared/analytics/types.ts` — the provider contract ("port").
- `src/shared/analytics/events.ts` — the authoritative **event taxonomy**:
  every event name, its categorical payload, its functional group
  (`ANALYTICS_EVENT_GROUP`) and its rollout tier (`ANALYTICS_TIER`). Audit this
  file before adding or changing an event.
- `src/shared/analytics/AnalyticsService.ts` — facade singleton; never throws,
  no-ops before init and while consent is off, pre-init events are buffered
  (capped) and replayed once initialized.
- `src/main/analytics/aptabaseMainProvider.ts` — the **only** module allowed to
  import `@aptabase/electron/main`. Loads the SDK lazily, sanitizes payloads,
  enforces the per-group gate, and tracks in-flight requests so
  `flush`/`close` have real semantics (the SDK has no `flush`/`close` export).
- `src/main/analytics/providerFactory.ts` — picks the backend from config/env.
- `src/renderer/analytics/aptabaseRendererProvider.ts` — renderer adapter.

The renderer never sees the App Key; renderer events travel to the main
process over the SDK's own `aptabase-ipc` transport (registered when the
main-process SDK initializes), so backend delivery still happens on the main
side.

> **CSP requirement:** the renderer's `index.html` Content-Security-Policy must
> allow that custom scheme. The SDK delivers events with a `fetch` to
> `aptabase-ipc://trackEvent`, which falls under `connect-src`. Since
> `connect-src` defaults to `default-src 'self'`, ensure the meta policy
> includes `connect-src 'self' aptabase-ipc` — otherwise renderer events are
> silently dropped (the adapter's fetch is rejected and logged as a
> `TypeError: Failed to fetch`).

## Configuration

| Variable             | Purpose                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APTABASE_APP_KEY`   | Enables analytics when present (main process only). Loaded from the repo-root `.env` via dotenv (real environment variables win) or the shell; for packaged releases it ships via environment or electron-builder config injection. Keys look like `A-{US\|EU\|DEV\|SH}-...`; an absent/invalid key simply never activates the backend. It never enters the renderer bundle. |
| `APTABASE_HOST`      | **Only for self-hosted** Aptabase API endpoints (`A-SH-...` keys). Leave empty on cloud.                                                                                                                                                                                              |
| `APTABASE_ENVIRONMENT` | Environment label (defaults from `NODE_ENV`).                                                                                                                                                                                                                                       |
| `ANALYTICS_PROVIDER` | Optional override: `aptabase` \| `noop`; otherwise auto-detected from the App Key.                                                                                                                                                                                                    |
| `ANALYTICS_GROUPS`   | Optional per-group emission gate (comma-separated, e.g. `lifecycle,convert,queue`). A group not listed is silently dropped, so a noisy group can be disabled without a release. Absent/empty ⇒ every group is emitted.                                                                 |
| `APTABASE_DEBUG`     | Set to `1` to watch the SDK log event delivery in local dev.                                                                                                                                                                                                                          |

Groups: `lifecycle`, `onboarding`, `nav`, `convert`, `image`, `audio`, `cut`,
`queue`, `profiles`, `settings`, `mcp`, `updates`, `hw`, `cli`, `ux`.

## Privacy & consent

- Analytics is **on by default** but fully user-controllable via _Settings →
  Usage data & error reporting_. The single toggle drives **both** the
  analytics layer and the error-monitoring layer: consent persists to
  `userData/analytics-consent.json` and `userData/monitoring-consent.json`
  (both GUI and CLI honor them at boot; `analytics-consent.json` is seeded
  from the monitoring file when missing).
- Turning the toggle off closes both backends at runtime; nothing is recorded
  afterwards. `telemetry_opt_out` is emitted *before* disabling, and
  `telemetry_opt_in` *after* re-enabling.
- **Privacy contract (taxonomy):** every payload is categorical-only. By
  design, no event contains media content, file names, folder paths, file
  sizes, or any personal identifier. The adapter additionally strips any
  non-string/number/boolean property as defense in depth.
- Duration fields are bucketed (e.g. `trimSecBucket`), and percentages/counts
  are coarse aggregate measures, never raw paths or metadata.
- No PII by default; no user identity is ever attached to an event.

## What gets recorded

All events are defined in `src/shared/analytics/events.ts`. Categories:

| Group       | Example events                                                                       |
| ----------- | ------------------------------------------------------------------------------------ |
| lifecycle   | `app_installed`, `app_launched`, `app_quit`                                          |
| ux          | `window_maximize_toggled`, `window_close_requested`, `window_close_deferred`         |
| onboarding  | `terms_accepted`, `onboarding_started`, `onboarding_goal_selected`, `onboarding_dismissed` |
| nav         | `dashboard_card_clicked`, `dashboard_shortcut_used`, `tool_opened`, `locale_changed`  |
| convert     | `conversion_started/completed/failed`, `codec_changed`, `transcoder_changed`, `preview_opened` |
| image       | `compress_started/completed/failed`, `compress_format_changed`                        |
| audio       | `audio_extract_started/completed/failed`, `audio_codec_changed`                       |
| cut         | `video_cut_started/completed/failed`, `timeline_zoom_changed`, `media_playback_toggled` |
| queue       | `batch_queue_started`, `batch_completed`, `batch_job_retried`, `batch_export`         |
| profiles    | `profile_applied`, `profile_created`, `profile_updated`, `profile_deleted`            |
| settings    | `telemetry_opt_in/out`, `theme_changed`, `hwaccel_*`, `always_on_top_toggled`, `encoder_type_changed` |
| mcp         | `mcp_server_toggled`, `mcp_port_committed`, `mcp_token_generated`, `mcp_connection_value_copied` |
| updates     | `update_available`, `update_downloaded`, `update_installed`, ...                      |
| hw          | `hw_accel_detected`                                                                   |
| cli         | `cli_invoked`, `cli_completed`                                                        |

See `src/shared/analytics/events.ts` for the full catalog, payload schemas, and
tier map (`v1` = launch cut, `v2` = gated follow-up).

## Recommended dashboard queries

Funnels (§5.2 of `plans/APTABASE_ANALYTICS_PLAN.md`):

- **Convert:** `convert_input_selected` → `preview_opened` → `conversion_started`
  → `conversion_completed` (broken out by `transcoder`, `hwAccel`, `jobKind`).
- **Compress:** `compress_input_selected` → `compress_started` → `compress_completed`
  (watch `savedPercent` distribution).
- **Audio extract:** `audio_input_selected` → `audio_extract_started` →
  `audio_extract_completed`.
- **Video cut:** `cut_input_selected` → `video_cut_started` → `video_cut_completed`
  (watch failure rate via `video_cut_failed{code, trimSecBucket}`).
- **Batch queue:** `batch_files_added` → `batch_review_confirmed` →
  `batch_queue_started` → `batch_completed` (track `batch_failed / batch_completed`).

Feature adoption:

- Segmentation by event group (e.g. % of installs reaching `queue` group usage).
- Velocity: `conversion_completed{speedX}`, `audio_extract_completed{durationSec}`.

Retention:

- `app_launched` per user (session start) vs `app_quit{sessionSec}`; compute
  D1/D7 return rates from `app_installed` + subsequent `app_launched` events.

## Swapping backends later

1. Add an adapter implementing `AnalyticsProvider` (main and renderer side).
2. Register it in the respective `providerFactory.ts`.
3. Set `ANALYTICS_PROVIDER=<new>` (and provide its config/env).
4. Remove the Aptabase adapters + package once confident.

No application code, IPC surface, or consent logic changes.