# PostHog Dashboards - EncodeX

These dashboards are the PostHog-side rendering of the analytics questions in
`docs/ANALYTICS.md`. They are created in the PostHog UI and exported here as
JSON (via the read-only personal API key, run locally - never in CI). The
exported files are committed so the intended insights are reviewable in the
repo; PostHog remains the rendering target.

Every saved insight **must** filter `channel = prod` (PD13: one project, env
separated by super property).

## Dashboards

### 1. Activation (`activation.json`)

Question: how many installs reach a first successful conversion within 7 days?

- Funnel: `app_launched` -> `onboarding_started` -> `onboarding_goal_selected` ->
  `conversion_started` -> `conversion_completed`, window 7 days.
- Breakdown by `mode` and `channel`.

### 2. Retention (`retention.json`)

Question: do users come back?

- Retention on `app_launched`, cohort = `first_seen_version` (weekly).
- D1 / D7 / D30.
- Stickiness: WAU / MAU on `app_launched`.

### 3. Feature adoption (`feature-adoption.json`)

Question: which tools are used, and how often?

- Unique users per event group (`convert`, `image`, `audio`, `cut`, `queue`,
  `mcp`) per week, breakdown by `platform`.

### 4. Reliability (`reliability.json`)

Question: where does the app fail?

- Failure rate per tool: `*_failed` / `*_started` (conversion, remux, demux,
  compress, audio, cut).
- `ui_error_shown` count by route and error code (no free text).

### 5. Batch health (`batch-health.json`)

Question: how healthy is the batch queue?

- `batch_queue_started` vs `batch_completed`.
- Median and p90 of job duration buckets.
- Retry rate: `batch_job_retried` / total `batch_job_*`.

### 6. Hardware and transcoder mix (`hardware-mix.json`)

Question: what do users run on?

- Breakdown of `transcoder_changed`, `hwaccel_mode_changed`,
  `encoder_type_changed` by `platform`.

## Cohorts (`cohorts.json`)

- **Power users**: >= 10 `conversion_completed` in the last 7 days.
- **MCP users**: `mcp_server_toggled` (on) at least once.
- **Batch users**: >= 3 `batch_queue_started` in 30 days.
- **Churn risk**: active in weeks 1-2, zero `app_launched` in the last 14 days.

## Export procedure

1. Build the insight in the PostHog UI.
2. Export via the read-only personal API key, locally only.
3. Save as `docs/analytics-dashboards/<name>.json`.
4. Commit in the same PR that adds the underlying event or property.

These files are committed empty until the first export is performed.
