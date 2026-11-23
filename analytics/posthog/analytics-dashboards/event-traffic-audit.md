# EncodeX PostHog event traffic audit

Snapshot: 2026-11-23 · Project `709196` · Taxonomy `src/shared/analytics/events.ts` v2

## Method

Compared the 129 typed events in `ANALYTICS_EVENT_GROUP` with PostHog's event
taxonomy snapshot taken `2026-11-23T09:47:28Z`. Events marked "not seen in the
last 30 days" by PostHog are treated as silent. Counts are directional because
the project has a small beta population.

## Result

- 60 of 129 typed events have reached PostHog.
- 69 typed events are silent.
- Live-only events: `app_release`, `encodex_diag_ping`, `$ai_generation_summary`,
  `$ai_trace_summary`. `app_release` is emitted by `trackReleaseOnce()` and is
  intentionally outside the typed taxonomy; `encodex_diag_ping` is a diagnostic
  probe; the two `$ai_*_summary` events are SDK-generated.
- No `$feature_flag_called` traffic before this change because startup used
  `getAllFlags()`, which does not emit exposure events. `refreshFlags()` now
  reads declared flags through `getFeatureFlag(..., { sendFeatureFlagEvents: true })`.
- No `$pageview` or `$exception` traffic; expected for an Electron desktop app
  without web analytics or `$exception` capture wired in.
- No `$ai_span`, `$ai_trace`, or `$ai_feedback` traffic at snapshot time; only
  `$ai_generation` plus SDK summaries had arrived. The code now emits metadata-only
  `$ai_span` events and span IDs on `$ai_generation`; runtime arrival is pending.

## Silent events by reason

| Reason | Events |
| ------ | ------ |
| v2 tier or UI path not exercised in captured sessions | `terms_rejected`, `onboarding_goal_selected`, `onboarding_mcp_enabled`, `dashboard_shortcut_used`, `convert_output_selected`, `suggested_extension_applied`, `preview_opened`, `copy_mode_toggled`, `transcoder_changed`, `cut_use_duration_toggled`, `cut_audio_toggled`, `batch_concurrency_changed`, `batch_profile_applied`, `batch_queue_started`, `batch_queue_paused`, `batch_queue_resumed`, `batch_clear_completed`, `batch_job_retried`, `batch_job_reordered`, `batch_job_reveal_in_folder`, `batch_job_path_copied`, `batch_export`, `batch_import`, `batch_filter_changed`, `logs_cleared`, `profile_created`, `profile_updated`, `profile_deleted`, `profile_reset`, `telemetry_opt_in`, `telemetry_opt_out`, `hwaccel_toggled`, `always_on_top_toggled`, `launch_at_login_toggled`, `mcp_port_committed`, `mcp_connection_value_copied` |
| Failure, pause, resume, or cancel paths not reached | `conversion_paused`, `conversion_resumed`, `conversion_cancelled`, `remux_failed`, `demux_failed`, `compress_failed`, `audio_extract_paused`, `audio_extract_resumed`, `audio_extract_cancelled`, `audio_extract_failed`, `video_cut_paused`, `video_cut_resumed`, `video_cut_cancelled`, `video_cut_failed`, `mux_queue_failed` |
| Feature workflow not exercised during capture window | `compress_input_selected`, `compress_format_changed`, `compress_started`, `compress_completed`, `audio_codec_changed`, `audio_extract_started`, `audio_extract_completed`, `video_cut_started`, `video_cut_completed` |
| Update lifecycle not reached | `update_download_started`, `update_downloaded`, `update_install_now`, `update_install_on_restart`, `update_download_cancelled`, `update_restart_install_cancelled`, `update_release_notes_opened`, `update_retry`, `update_installed` |

## Group and test-account verification

- `$groupidentify` carries group keys dynamically; raw event rows did not expose
  `$group_0` / `$group_1` columns, so group verification used the `groups` table.
- `hardware_class` keys: `cpu`, `gpu_hw`, `gpu_sw`.
- `profile_kind` keys: `custom`.
- All observed keys match the enum helpers in `src/main/analytics/groups.ts`; no
  user-defined strings were observed.
- Project test filter: cohort `689593` with operator `not_in`.
- The four new behavioral cohorts set `filterTestAccounts: true` inside `filters`.
- Test-account delta check: `app_launched` DAU for 2026-11-16 → 2026-11-23 was
  identical with `filterTestAccounts: false` and `true` (36/0/4/2/39/10/18/3),
  because cohort `689593` currently has 0 members. The filter is wired correctly;
  no traffic was excluded.

## Log ingestion verification

- `SELECT count() FROM logs` returned `0` for both 7-day and 30-day windows.
- Logs product is enabled for project `709196`, but `enable_log_capture` is not
  listed as completed in project onboarding.
- `posthogMainProvider.ts` now sends `Content-Type: application/json` on the
  OTLP log exporter, which PostHog requires. Runtime verification is still
  needed after the next app launch.
- Retention/cost decision: keep the default 14-day retention. Logs and Tracing
  share a 10 GB/month free tier; beyond that ingestion is $0.25/GB (10–300 GB)
  or $0.15/GB (300+ GB). Custom retention is $0.05/GB per month retained and is
  not enabled. Source: https://posthog.com/docs/logs/pricing#retention.

## Follow-up

- Re-run `read-data-schema` after a beta session that exercises compress, audio,
  cut, profile CRUD, settings toggles, and update flows.
- Confirm `$feature_flag_called` appears after the next consented startup.
- Confirm at least one `$ai_span` event appears after a Copilot plan that consults
  a configured AI provider.
- Confirm at least one `logs` row appears after the next consented startup.
- Decide whether `app_release` and `encodex_diag_ping` should be added to the
  typed taxonomy or marked as intentional out-of-band events.
