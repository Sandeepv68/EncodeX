# PostHog Dashboards - EncodeX

These dashboards are the PostHog-side rendering of the analytics questions in
`docs/ANALYTICS.md`. They were created in PostHog and exported here from the
saved dashboard and insight definitions. All seven exports are checked in below
alongside `data-schema.json`, `cohorts.json`, and `event-traffic-audit.md`.

Every dashboard and saved insight is filtered by the person property
`environment = production` with test-account filtering enabled, so development
capture stays on but only production users appear in the PostHog portal.
Production-only filtering is also applied to EncodeX cohorts, session recording
playlists, survey targeting, and log alerts. `Internal / Test users` stays
unfiltered because saved insights reference it with `not_in` to exclude test
accounts. Product-event insights also keep `channel = prod` (PD13: one project,
env separated by super property).

## Dashboards

### 1. Activation (`activation.json`)

Question: how many installs reach a first successful conversion within 7 days?

- Funnel: `app_launched` -> `onboarding_started` -> `onboarding_goal_selected` ->
  `conversion_started` -> `conversion_completed`, window 7 days.
- Breakdown by `mode` and `channel` (one insight per breakdown because funnels
  support a single breakdown).

### 2. Retention (`retention.json`)

Question: do users come back?

- Daily first-time retention on `app_launched` through D30 (31 intervals).
- Weekly active users broken down by person property `first_seen_version`.
- Stickiness: WAU / MAU on `app_launched`.

### 3. Feature adoption (`feature-adoption.json`)

Question: which tools are used, and how often?

- Unique users per event group (`convert`, `image`, `audio`, `cut`, `queue`,
  `mcp`) per week, breakdown by `platform`.

### 4. Reliability (`reliability.json`)

Question: where does the app fail?

- Failure rate for conversion and the combined media operations (`*_failed` /
  `*_started` for conversion, remux, demux, compress, audio, and cut).
- `ui_error_shown` count by `ctx.route` and `category` (no free text; no
  `error_code` is currently emitted).

### 5. Batch health (`batch-health.json`)

Question: how healthy is the batch queue?

- `batch_queue_started` vs `batch_completed`.
- Median and p90 of `jobCount` per queue; job duration is not currently captured.
- Retry rate: `batch_job_retried` / total `batch_job_*`.

### 6. Hardware and transcoder mix (`hardware-mix.json`)

Question: what do users run on?

- Breakdown of `transcoder_changed`, `hwaccel_mode_changed`,
  `encoder_type_changed` by `platform`.

### 7. AI observability (`ai-observability.json`)

Question: how much AI traffic and spend are we sending, and are generations
failing?

- `$ai_generation` volume, `$ai_total_cost_usd` spend, and `$ai_is_error` rate.
- Provider mix by `$ai_provider`.
- `$ai_generation_summary` volume.
- No `channel` filter because the property is absent on AI events; the saved
  person-property filter `environment = production`, internal/test cohort
  exclusion, and `filterTestAccounts: true` still apply.

## Cohorts (`cohorts.json`)

- **Power users**: >= 10 `conversion_completed` in the last 7 days.
- **MCP users**: `mcp_server_toggled` (on) at least once.
- **Batch users**: >= 3 `batch_queue_started` in 30 days.
- **Churn risk**: active in weeks 1-2, zero `app_launched` in the last 14 days.

## Export procedure

1. Build or update the insight in the PostHog UI.
2. Export the saved dashboard and insight definitions, locally only.
3. Save as `analytics/posthog/analytics-dashboards/<name>.json`.
4. Commit in the same PR that adds the underlying event or property.

Each dashboard export records dashboard metadata, shared filters, tile layouts,
and the full saved query definitions for its insights.
