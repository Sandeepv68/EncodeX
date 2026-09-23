# Aptabase Usage Analytics Plan â€” EncodeX

> Status legend: `[ ]` pending Â· `[~]` in progress Â· `[x]` done
>
> **Goal:** Integrate **Aptabase** as the application-usage-analytics backend behind a
> provider-agnostic analytics layer (ports & adapters), mirroring the existing monitoring
> architecture, so the analytics platform can be swapped later with **zero call-site changes**.
>
> Captures as much product signal as possible **and reconstructs full user journeys** â€” from
> install â†’ terms â†’ onboarding â†’ first goal â†’ first successful conversion â†’ repeat use â€” across
> all 10 screens, plus queue, profiles, image/audio/video tools, settings, MCP, updates, hardware
> acceleration, window chrome, CLI, and telemetry (â‰ˆ80 named events, preferred-tier rollout).
>
> Companion docs: `plans/SENTRY_MONITORING_PLAN.md` (the architecture being mirrored),
> `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` (KPI tracker / Checkpoint 10), `docs/MONITORING.md`.

---

## 1. Decisions Log

| #  | Decision      | Choice                                                                                                                                                                                                                                                                                                                                                       |
| -- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 | Consent model | **One visual telemetry switch, layered stores.** Settings keeps a single "usage analytics + error reporting" toggle. Each layer keeps its OWN persisted consent file (`analytics-consent.json` seeds from `monitoring-consent.json` on first boot) so either platform can be removed without breaking the other. The one switch flips BOTH IPC channels.        |
| D2 | Backend       | SaaS Aptabase (app key via env `APTABASE_APP_KEY`), self-hosted supported via `APTABASE_HOST` + `A-SH-*` key.                                                                                                                                                                                                                                                 |
| D3 | Scope         | GUI **and** CLI mode (`encodex --cli`) report; MCP mode reports only framing events.                                                                                                                                                                                                                                                                          |
| D4 | Transport     | `@aptabase/electron` â€” renderer tracks via `@aptabase/electron/renderer` which relays over the SDK's own `aptabase-ipc` scheme to main; **the App Key lives only in the main process** (same rule as the Sentry DSN). SDK uses Electron `net` (proxy-aware, non-blocking).                                                                                     |
| D5 | Provider swap | Selection via `ANALYTICS_PROVIDER` env (`aptabase` \| `noop`); default `aptabase` only when `APTABASE_APP_KEY` present. Runtime enforcement lives in the shared facade (consent off â‡’ NoopProvider) exactly like monitoring.                                                                                                                                  |
| D6 | Taxonomy      | Bump `ANALYTICS_SCHEMA_VERSION` 1 â†’ 2. Extend the existing 14-event taxonomy to an **â‰ˆ80-event catalog across 16 user journeys** (Â§4). All payloads stay **categorical-only** (source disambiguators, counts, buckets, ids, modes, durations as numbers â€” never file names, paths, or PII). Rolled out in two tiers: `v1` launch (~45) and `v2` follow-up (~30). |
| D7 | SDK constraint| `@aptabase/electron@0.3.1` has **no `flush()`/`close()` export** and requires `initialize()` **before `app.whenReady()`** (otherwise it self-disables). The adapter therefore (a) inits synchronously at module load like monitoring does, and (b) tracks in-flight request promises itself to give the facade real `flush`/`close` semantics.                 |
| D8 | Existing layer| Keep `recordAnalyticsEvent` / `analyticsService.recordEvent` / `createAnalyticsEvent` public surface **byte-identical**; only the routing changes (breadcrumbs â†’ real AnalyticsProvider backend). Call sites stay untouched.                                                                     |
| D9 | Journey depth | Journey reconstruction is **event-sequence based**, not screen-tour based: no page/route dumps, no throttle-prone UI micro-events. `tool_opened {route}` marks screen entry; `source` props (`dialog`/`drop`/`folder`), `mode` (`gui`/`cli`), `jobKind`, and SDK session id stitch each journey's steps together (Â§5).                                                |
| D10| Noise gates   | Two-tier rollout + a per-group event flag. High-frequency interactions (playback toggle, timeline zoom, drag) are excluded by default and only enabled if a specific question needs them (Phase 6.5).                                                                                           |

## 2. Architecture â€” Ports & Adapters

```
App code â”€â”€â–º recordAnalyticsEvent(event)            (src/shared/analytics/AnalyticsService.ts)
                  â”‚                                                  â–² the "port"
                  â”‚ delegates to AnalyticsProvider interface         â”‚ (src/shared/analytics/types.ts)
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                          â”‚ implemented by adapters
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  AptabaseMainProvider               NoopProvider                    (future providers
  (src/main/analytics, wraps        (default fallback)                one file each,
   @aptabase/electron/main)         src/shared/analytics)             e.g. PostHogMainProvider)
        â”‚                                  â–²
        â”‚ (main posts to <region>.aptabase.com/api/v0/event via Electron net)
   AptabaseRendererProvider               â”‚ mirrors main backend via ANALYTICS_GET_STATE
   (src/renderer/analytics, wraps  @aptabase/electron/renderer  â†’ aptabase-ipc â†’ main)
```

- App code only ever calls `recordAnalyticsEvent(createAnalyticsEvent(name, props))`.
- The `AnalyticsProvider` contract is the only coupling; backends are one file each + a
  factory entry. Swapping Aptabase â‡’ PostHog/Plausible/etc. = new adapter + `ANALYTICS_PROVIDER` change.
- **Renderer never sees the App Key** â€” it relays `{eventName, props}` over the SDK's
  `aptabase-ipc` scheme registered by main (`initialize` does this automatically).
- The old breadcrumb routing (`addMonitoringBreadcrumb`) is **removed** â€” analytics gets its
  own network channel. Monitoring and analytics become fully independent layers.
- Same never-throws, no-op-before-init, consent-gated guarantees as `MonitoringService`.

### Provider contract (`src/shared/analytics/types.ts`)

```ts
export interface AnalyticsProvider {
  readonly name: string;
  init(config: AnalyticsConfig): void | Promise<void>;
  track(event: AnalyticsEvent): void | Promise<void>;
  setEnabled(enabled: boolean): void | Promise<void>;
  isEnabled(): boolean;
  flush?(timeoutMs?: number): Promise<boolean>;
  close?(timeoutMs?: number): Promise<boolean>;
}

export interface AnalyticsConfig {
  provider?: string;      // 'aptabase' | 'noop'; omitted => factory auto-detects
  appKey?: string;        // A-EU-* | A-US-* | A-SH-*
  host?: string;          // required only for self-hosted (A-SH-*)
  enabled: boolean;       // consent master switch; providers must respect it
  environment?: string;
  release?: string;
  debug?: boolean;
}
```

### SDK truth (verified @aptabase/electron@0.3.1)

- `@aptabase/electron/main` exports `{ initialize, trackEvent }`.
  - `initialize(appKey, { host? })` â€” must run before `app.whenReady()`; validates key format
    (`A-{US|EU|DEV|SH}-\d+`), registers `aptabase-ipc` scheme + `aptabase:trackEvent` IPC.
  - `trackEvent(name, props?)` â€” fire-and-forget POST per event; buffers events emitted before
    init completes; props limited to **strings and numbers**; auto 1-hour session rotation; auto
    system props (OS name/version, app version, locale, isDebug, engine, SDK version).
- `@aptabase/electron/renderer` exports `{ trackEvent }` â€” posts to `aptabase-ipc://trackEvent`.
- Peer dep: `electron >= 3` (project is on Electron `^43.4.0` â€” satisfied).
- Package last published 3 years ago (low churn) â€” the adapter pattern fully contains that risk.

## 3. Capture matrix â€” what each KPI maps to

| KPI (from `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md`)      | Journey | Event(s)                                                          |
| ----------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Install â†’ first launch                                | J1/J2   | `app_installed`, `app_launched`                                  |
| Terms gate pass rate                                  | J2      | `terms_rejected` vs `terms_accepted`                              |
| Onboarding start â†’ goal â†’ first conversion            | J2â†’J4   | `onboarding_started` â†’ `onboarding_goal_selected` â†’ `conversion_started` â†’ `conversion_completed` |
| First successful conversion (priority #1)             | J4      | `conversion_started` â†’ `conversion_completed`\|`_failed`          |
| Repeat conversion (retention)                         | J4/J8   | `conversion_completed` grouped by SDK session id                  |
| Batch power users                                     | J8      | `batch_files_added` â†’ `batch_queue_started` â†’ `batch_completed`   |
| Profile adoption                                      | J10     | `profile_created` â†’ `profile_applied`                             |
| Aux tools adoption (image/audio/cut)                  | J5/J6/J7| `*_started` â†’ `*_completed`\|`_failed` per tool                    |
| Hardware-accel share                                  | J14     | `hw_accel_detected` + `conversion_* .hwAccel`                     |
| CLI adoption                                          | J15     | `cli_invoked` (+ subcommand) â†’ `cli_completed`                    |
| Update health                                         | J13     | `update_*` chain (available â†’ download â†’ install)                 |
| Setting exploration                                  | J11     | `theme_changed`, `hwaccel_*`, `locale_changed`, etc.              |
| Telemetry opt-out rate                                | J11     | `telemetry_opt_in`, `telemetry_opt_out`                          |

## 4. Event taxonomy v2 â€” full catalog by user journey

Bump to `ANALYTICS_SCHEMA_VERSION = 2`. Names stay snake_case/dot-free. Every payload field
**must** remain categorical or a plain number â€” the privacy contract in the `events.ts` header
is non-negotiable. `v1` = first-pass launch set; `v2` = second-pass follow-up. Existing wired
events are marked **(wired)**. Line numbers are the verified insertion points.

### J1 â€” App lifecycle & window chrome

| Event                      | Tier | Props                                            | Call site                                        |
| -------------------------- | ---- | ------------------------------------------------ | ------------------------------------------------ |
| `app_installed`            | v1   | `{ version, platform, arch }`                    | First-run marker in `src/main/index.ts` bootstrap (Phase 7.2) |
| `app_launched`             | v1   | `{ version, platform, arch }`                    | `src/main/index.ts:473` **(wired)**               |
| `app_quit`                 | v2   | `{ sessionSec: number, crashDuringSession }`     | `src/main/index.ts` `will-quit`, before `flushAnalytics` |
| `window_maximize_toggled`  | v2   | `{ maximized }`                                  | `src/renderer/components/TitleBar.tsx:76`         |
| `window_close_requested`   | v2   | `{}`                                             | `src/renderer/components/TitleBar.tsx:80`         |
| `window_close_deferred`    | v2   | `{ reason: 'pending' }`                          | `src/renderer/components/CloseConfirmDialog.tsx:87` |

### J2 â€” First-run, terms & onboarding (the acquisition funnel)

| Event                      | Tier | Props                          | Call site                                        |
| -------------------------- | ---- | ------------------------------ | ------------------------------------------------ |
| `terms_accepted`           | v1   | `{}`                           | `src/renderer/components/TermsDialog.tsx:86`     |
| `terms_rejected`           | v1   | `{}`                           | `TermsDialog.tsx:77` (app quits)                 |
| `onboarding_started`       | v1   | `{ version }`                  | `src/renderer/components/GettingStartedCard.tsx:110` **(wired)** |
| `onboarding_goal_selected` | v1   | `{ goal }`                     | `GettingStartedCard.tsx:123` **(wired)**         |
| `onboarding_dismissed`     | v2   | `{ version }`                  | `GettingStartedCard.tsx:138`                     |
| `dashboard_card_clicked`   | v2   | `{ route }`                    | `src/renderer/pages/Dashboard.tsx:187`           |
| `dashboard_shortcut_used`  | v2   | `{ shortcutId }`               | `Dashboard.tsx:158-163`                          |

### J3 â€” Navigation & language shell

| Event           | Tier | Props                        | Call site                                        |
| --------------- | ---- | ---------------------------- | ------------------------------------------------ |
| `tool_opened`   | v1   | `{ route }`                  | `src/renderer/components/AppDrawer.tsx:295` (nav click) |
| `locale_changed`| v1   | `{ language, rtl }`          | `src/renderer/components/LanguageMenu.tsx:170`   |

> `tool_opened` is the **journey anchor**: every tracked interaction can be attributed to the
> tool it happened in by its `route` (and the SDK session), so nav paths are reconstructable
> without a `page_view` event per render.

### J4 â€” Single conversion spine (primary journey)

| Event                      | Tier | Props                                                                               | Call site                                        |
| -------------------------- | ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| `convert_input_selected`   | v1   | `{ source: 'dialog'\|'drop' }`                                                        | `src/renderer/pages/Convert.tsx:424` / `:436`    |
| `convert_output_selected`  | v1   | `{}`                                                                                | `src/renderer/hooks/useConversion.ts:217`        |
| `suggested_extension_applied` | v1 | `{ codec }`                                                                      | `Convert.tsx:472`                                |
| `codec_changed`            | v1   | `{ codecType: 'video'\|'audio', codec }`                                             | `src/renderer/components/CodecSelect.tsx:94` (shared: Convert/Batch/ProfileEditor) |
| `preview_opened`           | v1   | `{}`                                                                                | `Convert.tsx:447` (hotkey `convert.preview` :341)|
| `conversion_started`       | v1   | `{ jobKind:'single', transcoder, hwAccel, copyMode, presetClass, container, mode:'gui'\|'cli' }` | `src/main/ipc/conversion.ts:91` + `src/main/queue/job-queue.ts:594` **(wired)** |
| `conversion_paused`        | v1   | `{}`                                                                                | `Convert.tsx:824` / `useConversion.ts:186`       |
| `conversion_resumed`       | v1   | `{}`                                                                                | `Convert.tsx:835` / `useConversion.ts:192`       |
| `conversion_cancelled`     | v1   | `{ jobKind }`                                                                       | `Convert.tsx:876` + queue cancel path (`job-queue.ts` stop) |
| `conversion_completed`     | v1   | `{ jobKind, transcoder, hwAccel, presetClass, container, durationSec: number, speedX: number, mode }` | `job-queue.ts:635` **(wired)** + `conversion.ts:141` |
| `conversion_failed`        | v1   | `{ jobKind, transcoder, hwAccel, code?, mode }`                                     | `job-queue.ts:615` **(wired)** + `conversion.ts:128` |
| `copy_mode_toggled`        | v2   | `{ copyMode }`                                                                      | `Convert.tsx:499-505` (hotkey `convert.lossless` :340) |
| `transcoder_changed`       | v2   | `{ transcoder }`                                                                    | `Convert.tsx:790-800` / `settingsStore.ts:260`   |
| `preview_closed`           | v2   | `{}`                                                                                | `Convert.tsx:353`                                |
| `convert_form_cleared`     | v2   | `{}`                                                                                | `Convert.tsx:886`                                |

### J5 â€” Image compression journey

| Event                       | Tier | Props                                           | Call site                                        |
| --------------------------- | ---- | ----------------------------------------------- | ------------------------------------------------ |
| `compress_input_selected`   | v1   | `{ source: 'dialog'\|'drop' }`                    | `src/renderer/pages/ImageCompress.tsx:180`       |
| `compress_format_changed`   | v1   | `{ format }`                                    | `ImageCompress.tsx:220`                          |
| `compress_started`          | v1   | `{ format, qualityBand, scaleApplied }`         | `ImageCompress.tsx:263` (button :485)            |
| `compress_completed`        | v1   | `{ format, savedPercent: number }`              | `ImageCompress.tsx:263-310` (success path)       |
| `compress_failed`           | v1   | `{ format, code? }`                             | `src/renderer/hooks/useMediaTask.ts:90-91`       |

### J6 â€” Audio extraction journey

| Event                      | Tier | Props                 | Call site                                        |
| -------------------------- | ---- | --------------------- | ------------------------------------------------ |
| `audio_input_selected`     | v1   | `{ source }`          | `src/renderer/pages/AudioExtract.tsx:103`        |
| `audio_codec_changed`      | v1   | `{ codec }`           | `AudioExtract.tsx:135`                           |
| `audio_extract_started`    | v1   | `{ codec }`           | `AudioExtract.tsx:174` (button :323)             |
| `audio_extract_paused`     | v2   | `{}`                  | `AudioExtract.tsx:332`                           |
| `audio_extract_resumed`    | v2   | `{}`                  | `AudioExtract.tsx:337`                           |
| `audio_extract_cancelled`  | v2   | `{}`                  | `AudioExtract.tsx:346`                           |
| `audio_extract_completed`  | v1   | `{ codec, durationSec }` | success path                                   |
| `audio_extract_failed`     | v1   | `{ codec, code? }`    | error path                                       |

### J7 â€” Video cut journey

| Event                      | Tier | Props                                      | Call site                                        |
| -------------------------- | ---- | ------------------------------------------ | ------------------------------------------------ |
| `cut_input_selected`       | v1   | `{ source: 'dialog'\|'drop' }`               | `src/renderer/pages/VideoCut.tsx:460` / `:683` / `:690` |
| `cut_use_duration_toggled` | v1   | `{ useDuration }`                          | `VideoCut.tsx:781`                               |
| `video_cut_started`        | v1   | `{ useDuration, includeAudio, trimSecBucket }` | `VideoCut.tsx:508` (button :796)               |
| `video_cut_paused`         | v1   | `{}`                                       | `VideoCut.tsx:809`                               |
| `video_cut_resumed`        | v1   | `{}`                                       | `VideoCut.tsx:820`                               |
| `video_cut_cancelled`      | v1   | `{}`                                       | `VideoCut.tsx:831` (dialog :872)                 |
| `video_cut_completed`      | v1   | `{ useDuration, includeAudio, durationSec }` | success path                                    |
| `video_cut_failed`         | v1   | `{ code?, trimSecBucket }`                 | error path                                       |
| `cut_audio_toggled`        | v2   | `{ includeAudio }`                         | `VideoCut.tsx:657`                               |
| `timeline_zoom_changed`    | v2   | `{ direction: 'in'\|'out' }`                 | `src/renderer/components/VideoTimeline.tsx:534/542` |
| `media_playback_toggled`   | v2   | `{ playing }`                              | `src/renderer/components/MediaPlayer.tsx:793`    |
| `video_cut_form_cleared`   | v2   | `{}`                                       | `VideoCut.tsx:842` (dialog :882)                 |

### J8 â€” Batch queue journey

| Event                      | Tier | Props                                              | Call site                                        |
| -------------------------- | ---- | -------------------------------------------------- | ------------------------------------------------ |
| `batch_files_added`        | v1   | `{ source: 'dialog'\|'folder'\|'drop', count }`     | `src/renderer/pages/BatchQueue.tsx:740` / `:753` / `:644` |
| `batch_review_confirmed`   | v1   | `{ count }`                                        | `BatchQueue.tsx:766` (`QueueAddReviewDialog.tsx:111`) |
| `batch_operation_changed`  | v1   | `{ operation }`                                    | `BatchQueue.tsx:912`                              |
| `batch_concurrency_changed`| v1   | `{ concurrency }`                                  | `BatchQueue.tsx:900` / `settingsStore.ts:382`     |
| `batch_profile_applied`    | v1   | `{ profileId }`                                    | `BatchQueue.tsx:953`                              |
| `batch_queue_started`      | v1   | `{ jobCount, operationMix, concurrency }`          | `BatchQueue.tsx:994`                              |
| `batch_queue_paused`       | v1   | `{}`                                               | `BatchQueue.tsx:973`                              |
| `batch_queue_resumed`      | v1   | `{}`                                               | `BatchQueue.tsx:983`                              |
| `batch_queue_cancelled_all`| v1   | `{ count }`                                        | `BatchQueue.tsx:823` (opened at :813)             |
| `batch_clear_completed`    | v1   | `{ count }`                                        | `BatchQueue.tsx:835` (button :1244)               |
| `batch_job_retried`        | v1   | `{ operation }`                                    | `src/renderer/components/QueueJobCard.tsx:316` â†’ `BatchQueue.tsx:786` |
| `batch_job_removed`        | v1   | `{ status }`                                       | `QueueJobCard.tsx:337`                            |
| `batch_completed`          | v1   | `{ completed, failed }`                            | `src/main/queue/job-queue.ts:542` (drain)         |
| `batch_job_reordered`      | v2   | `{ movedBy }`                                      | `BatchQueue.tsx:1099` (`handleDragEnd`)           |
| `batch_job_options_edited` | v2   | `{ operation }`                                    | `QueueJobCard.tsx:296` â†’ `BatchQueue.tsx:849`/`865` |
| `batch_job_reveal_in_folder` | v2 | `{}`                                             | `QueueJobCard.tsx:322`                            |
| `batch_job_path_copied`    | v2   | `{}`                                               | `QueueJobCard.tsx:327`                            |
| `batch_export`             | v2   | `{ count }`                                        | `BatchQueue.tsx:1005`                             |
| `batch_import`             | v2   | `{ count }`                                        | `BatchQueue.tsx:1019`                             |
| `batch_condense_toggled`   | v2   | `{ condensed }`                                    | `BatchQueue.tsx:1132`                             |
| `batch_filter_changed`     | v2   | `{ filter: 'all'\|'queued'\|'running'\|'done'\|'failed' }` | `BatchQueue.tsx:1225`                    |

### J9 â€” Media info & logs (support journey)

| Event                 | Tier | Props                                      | Call site                                        |
| --------------------- | ---- | ------------------------------------------ | ------------------------------------------------ |
| `media_info_probed`   | v1   | `{ kind: 'video'\|'image', streamCountBucket, hasExif }` | `src/renderer/pages/MediaInfo.tsx:99-124` |
| `logs_filter_changed` | v2   | `{ level }`                                | `src/renderer/pages/Logs.tsx:143`                 |
| `logs_cleared`        | v2   | `{}`                                       | `Logs.tsx:154`                                   |
| `logs_exported`       | v2   | `{ entryCount }`                           | `Logs.tsx:159` (`downloadLogs` :94)               |

### J10 â€” Profiles journey

| Event               | Tier | Props                          | Call site                                        |
| ------------------- | ---- | ------------------------------ | ------------------------------------------------ |
| `profile_applied`   | v1   | `{ profileId, category }`      | `src/renderer/components/ProfileSelector.tsx:174-187` **(wired)** |
| `profile_created`   | v1   | `{ category, advanced }`       | `src/renderer/components/ProfileEditorDialog.tsx:394` â†’ `src/renderer/stores/profileStore.ts:90` |
| `profile_updated`   | v1   | `{ category }`                 | `ProfileEditorDialog.tsx:394` (edit branch :136-138) |
| `profile_deleted`   | v1   | `{ category, custom }`         | `ProfileSelector.tsx:315-323`                    |
| `profile_reset`     | v2   | `{ category }`                 | `ProfileEditorDialog.tsx` reset-to-default       |

### J11 â€” Settings & app identity

| Event                     | Tier | Props                  | Call site (all `src/renderer/pages/Settings.tsx` + `stores/settingsStore.ts`) |
| ------------------------- | ---- | ---------------------- | ------------------------------------------------------------------------------ |
| `theme_changed`           | v1   | `{ themeId }`          | `Settings.tsx:392`                                                             |
| `telemetry_opt_in`        | v1   | `{ version }`          | `settingsStore.ts:338` (enabled transition)                                    |
| `telemetry_opt_out`       | v1   | `{ version }`          | `settingsStore.ts:338` (disabled transition â€” see note below)                  |
| `hwaccel_toggled`         | v1   | `{ enabled }`          | `Settings.tsx:438` / `settingsStore.ts:272`                                    |
| `hwaccel_mode_changed`    | v1   | `{ mode }`             | `Settings.tsx:453` / `settingsStore.ts:284`                                    |
| `encoder_type_changed`    | v1   | `{ encoderType }`      | `Settings.tsx:472` / `settingsStore.ts:297`                                    |
| `always_on_top_toggled`   | v2   | `{ enabled }`          | `Settings.tsx:405` / `settingsStore.ts:311`                                    |
| `launch_at_login_toggled` | v2   | `{ enabled }`          | `Settings.tsx:415` / `settingsStore.ts:325`                                    |

> **Note on `telemetry_opt_out`:** with consent now off, the facade is a no-op â€” so emit it
> **before** disabling and rely on `flushAnalytics()` to deliver it. If that proves unreliable,
> accept the event loss (the opt-in rate is the metric that matters). Decide in Phase 6 review.

### J12 â€” MCP server journey (power users)

| Event                         | Tier | Props                                   | Call site (`src/renderer/pages/Settings.tsx`) |
| ----------------------------- | ---- | --------------------------------------- | --------------------------------------------- |
| `mcp_server_toggled`          | v2   | `{ enabled }`                           | `:216`                                        |
| `mcp_port_committed`          | v2   | `{ isDefaultPort }`                     | `:237` (`commitPort`, def :167)               |
| `mcp_token_generated`         | v2   | `{}`                                    | `:254` (`handleGenerateToken` :178)           |
| `mcp_token_cleared`           | v2   | `{}`                                    | `:300` (`handleClearToken` :190)              |
| `mcp_connection_value_copied` | v2   | `{ valueType: 'token'\|'endpoint'\|'authorization' }` | `:294`/`:320`/`:334` (`copyConnectionValue` :205) |

### J13 â€” Update journey

| Event                        | Tier | Props                        | Call site                                             |
| ---------------------------- | ---- | ---------------------------- | ----------------------------------------------------- |
| `update_check_triggered`     | v1   | `{ source }`                 | `src/renderer/pages/About.tsx:143` / `components/Footer.tsx` / `stores/updateStore.ts:150` |
| `update_dialog_opened`       | v1   | `{ source }`                 | `Footer.tsx:122/136/192` (`openDialog` :189)          |
| `update_available`           | v1   | `{ version, newVersion }`    | `updateStore.ts:89` **(wired)**                       |
| `update_download_started`    | v1   | `{}`                         | `components/UpdateDialog.tsx:137` / `updateStore.ts:155` |
| `update_downloaded`          | v1   | `{ version, newVersion }`    | `src/main/updater.ts:470`                             |
| `update_install_now`         | v1   | `{}`                         | `UpdateDialog.tsx:165/174` / `updateStore.ts:165`     |
| `update_install_on_restart`  | v1   | `{}`                         | `UpdateDialog.tsx:162` / `updateStore.ts:172`         |
| `update_download_cancelled`  | v2   | `{}`                         | `UpdateDialog.tsx:143-147` / `updateStore.ts:160`     |
| `update_restart_install_cancelled` | v2 | `{}`                    | `UpdateDialog.tsx:171` / `updateStore.ts:180`         |
| `update_release_notes_opened`| v2   | `{}`                         | `UpdateDialog.tsx:95` / `updateStore.ts:185`          |
| `update_retry`               | v2   | `{}`                         | `UpdateDialog.tsx:183` (reset + re-check)             |
| `update_installed`           | v2   | `{ version, newVersion }`    | `src/main/updater.ts` install branch                  |

### J14 â€” Hardware acceleration

| Event                  | Tier | Props                       | Call site                        |
| ---------------------- | ---- | --------------------------- | -------------------------------- |
| `hw_accel_detected`    | v1   | `{ mode, encoderType }`     | existing (defined, unwired) â€” wire at detection |

### J15 â€” CLI journey

| Event            | Tier | Props                                            | Call site                      |
| ---------------- | ---- | ------------------------------------------------ | ------------------------------ |
| `cli_invoked`    | v1   | `{ version, platform, arch, subcommand?, hwAccel }` | `src/main/index.ts:229` **(wired)** â€” add `hwAccel` |
| `cli_completed`  | v2   | `{ subcommand?, outcome: 'ok'\|'error', durationSec }` | CLI exit paths in `src/main/index.ts` |

### J16 â€” Product-visible friction (low noise)

| Event            | Tier | Props            | Call site                                   |
| ---------------- | ---- | ---------------- | ------------------------------------------- |
| `ui_error_shown` | v2   | `{ category }`   | `src/renderer/components/ErrorBoundary.tsx` / `ErrorBanner.tsx` / `ErrorSnackbar.tsx` â€” product-visible only, NOT crash data (monitoring owns that) |

Every addition must be added to `AnalyticsEventName` + `AnalyticsEventPayloadMap` in `events.ts`
(`schema: 2` comes from `ANALYTICS_SCHEMA_VERSION`). Recommended launch cut: **all `v1` (~45)**;
`v2` (~30) is reviewed group-by-group before wiring.

## 5. User journeys & funnels â€” how the catalog reconstructs them

Aptabase gives us the **session id** on every event (auto, rotates after 1 h idle) plus system
props (OS, app version, locale). Journey reconstruction therefore needs no screen-tour capture â€”
it is pure **event sequencing within a session**, stitched by:
- **Entry anchor:** `tool_opened { route }` fires on every navigation (AppDrawer).
- **Disambiguation props:** `source` (`dialog`/`drop`/`folder`), `mode` (`gui`/`cli`),
  `jobKind` (`single`/`batch`), `operation`, tiered `*_started/*_completed/*_failed`.
- **Attempt counting:** completed vs. started fo the same `jobKind`+`route` in a session = success
  rate per journey; pause/resume/cancel in between = effort spent.

### 5.1 Journey sequences (event order per journey)

```
FIRST-RUN:      app_installed â†’ app_launched â†’ [terms_rejected (exit)] | terms_accepted
                â†’ onboarding_started â†’ onboarding_goal_selected â†’ tool_opened{goal route} â†’ â€¦

SINGLE CONVERT: tool_opened{/convert} â†’ convert_input_selected{source} â†’ codec_changed?
                â†’ conversion_started â†’ [conversion_paused|resumed]*
                â†’ conversion_completed{durationSec, speedX} | conversion_failed{code} | conversion_cancelled

IMAGE:          tool_opened{/image-compress} â†’ compress_input_selected â†’ compress_format_changed?
                â†’ compress_started â†’ compress_completed{savedPercent} | compress_failed

BATCH:          tool_opened{/batch-queue} â†’ batch_files_added{source} â†’ batch_review_confirmed
                â†’ batch_operation_changed? â†’ batch_profile_applied? â†’ batch_queue_started
                â†’ [batch_queue_paused|resumed] â†’ per-job patchwork â†’ batch_completed{completed,failed}

VIDEO CUT:      tool_opened{/video-cut} â†’ cut_input_selected â†’ cut_use_duration_toggled?
                â†’ video_cut_started â†’ [pause|resume]* â†’ video_cut_completed | _failed | _cancelled

UPDATE:         update_check_triggered â†’ update_available â†’ update_download_started
                â†’ update_downloaded â†’ update_install_now | update_install_on_restart

PROFILES:       profile_created â†’ profile_applied {in J4 or J8} â†’ profile_updated | profile_deleted

CLI:            cli_invoked{subcommand} â†’ cli_completed{outcome, durationSec}
```

### 5.2 Funnel definitions to build in the Aptabase dashboard

| Funnel                     | Entry â†’ Exit                                                     | Metric |
| -------------------------- | ---------------------------------------------------------------- | ------ |
| Acquisition                | `app_installed` â†’ `terms_accepted` â†’ `onboarding_goal_selected`  | %     |
| First conversion (KPI #1)  | `conversion_started` â†’ `conversion_completed` (first in session) | rate, median durationSec |
| Batch power-user            | `batch_files_added` â†’ `batch_queue_started` â†’ `batch_completed`  | %, avg count |
| Aux-tool adoption           | `*_input_selected` â†’ `*_started` â†’ `*_completed` per tool        | % per tool |
| Update loop                | `update_download_started` â†’ `update_downloaded` â†’ `update_install_now` | % |
| Profile power-user          | `profile_created` â†’ `profile_applied` (same/any session)         | % |
| Drop vs dialog             | `convert_input_selected{source}` / `batch_files_added{source}` / `cut_input_selected{source}` split | distribution |

### 5.3 Session & funnel enrichment

- **Journey context badge:** optional middleware in `AnalyticsService.recordEvent` that stamps
  active `route` and `jobKind` onto every event as `ctx.route` / `ctx.jobKind` (derived from the
  last `tool_opened`), so per-journey breakdowns stay correct even if a call site forgets a prop.
- **Duration bucketing:** durations as **numbers** (Aptabase allows numbers) â€” keep raw
  `durationSec`/`speedX` for median/percentile computes in dashboards.
- **Cross-reference to monitoring:** same session + opt-in consent means the analytics session id
  can be paired with Sentry breadcrumb/trace scope for "did an error correlate with a conversion
  failure" post-mortems â€” but only at aggregate level, never PII.

### 5.4 Anti-noise guardrails (D10)

- High-frequency interactions (`media_playback_toggled`, `timeline_zoom_changed`,
  `batch_job_reordered`) stay **v2 + feature-flag gated** â€” off unless a specific question needs them.
- No drag/throttle events, no per-render events, no file-name/path/size props anywhere.
- Per-group emission flag (`ANALYTICS_GROUPS=lifecycle,convert,queue,...`) so a noisy group can
  be disabled remotely without a release.

## 6. Config / Environment

```bash
# .env / environment
APTABASE_APP_KEY=A-EU-xxxxxxxx       # enables Aptabase (absent => NoopProvider)
APTABASE_HOST=https://analytics.example.org   # ONLY for self-hosted A-SH-* keys
ANALYTICS_PROVIDER=aptabase          # optional override ('aptabase' | 'noop')
ANALYTICS_GROUPS=lifecycle,onboarding,nav,convert,image,audio,cut,queue,profiles,settings,mcp,updates,hw,cli,ux
                                     # optional per-group switch for noise control (D10)
```

Consent file: `<userData>/analytics-consent.json` â†’ `{ "enabled": true }` (absent â‡’ seeded
from `monitoring-consent.json`'s value â‡ default `true`).

No build-time config needed (unlike Sentry DSN): the App Key is a runtime env var. For
packaged builds, electron-builder can embed it or it can ship unset (layer inert).

## 7. Phases

### Phase 0 â€” Dependency

- [x] 0.1 `npm add @aptabase/electron` â†’ 0.3.1 (peer `electron >= 3`, project on `^43.4.0` âœ“)
- [x] 0.2 Verify exports: `@aptabase/electron/main` â†’ `{ initialize, trackEvent }`; `@aptabase/electron/renderer` â†’ `{ trackEvent }`
- [x] 0.3 Confirm no `flush`/`close` in SDK â‡’ adapter owns in-flight tracking (D7)

### Phase 1 â€” Shared contracts (`src/shared/analytics/`)

- [x] 1.1 `types.ts` â€” `AnalyticsProvider`, `AnalyticsConfig` (Â§2), `AnalyticsState` `{ enabled, backend }`
- [x] 1.2 `noopProvider.ts` â€” dependency-free fallback (copy `noopProvider.ts` pattern from `src/shared/monitoring/`)
- [x] 1.3 Refactor `AnalyticsService.ts` â†’ facade singleton with `initAnalytics`, `setAnalyticsEnabled`, `isAnalyticsEnabled`, `getAnalyticsBackendName`, `trackAnalyticsEvent`, `flushAnalytics`, `closeAnalytics`, `resetAnalyticsForTests`, `getActiveAnalyticsProviderForTests`
- [x] 1.4 **Remove** `addMonitoringBreadcrumb` coupling from `AnalyticsService.ts` (no monitoring import left)
- [x] 1.5 Journey badge middleware: stamp `ctx.route` / `ctx.jobKind` from last `tool_opened` (Â§5.3)
- [x] 1.6 Keep `recordAnalyticsEvent` / `analyticsService.recordEvent` public surface unchanged
- [x] 1.7 Unit tests: delegation, no-op-before-init, never-throws, consent-off â‡’ noop, badge stamping (mirror `MonitoringService.test.ts` / `noopProvider.test.ts`)

### Phase 2 â€” Main-side provider

- [x] 2.1 `src/main/analytics/aptabaseMainProvider.ts` â€” ONLY module allowed to import `@aptabase/electron/main`; lazy `import()`; `init` calls `initialize(appKey, { host? })` guarding on key presence; must complete before `app.whenReady()` â‡’ facade called from module-load bootstrap (Phase 7); `track()` â†’ `trackEvent(name, props)` with `props` whitelisted + sanitized (strings/numbers only, empty omitted); track in-flight promises for `flush`/`close`; supports `ANALYTICS_GROUPS` group gating; `name = 'aptabase'`
- [x] 2.2 `src/main/analytics/providerFactory.ts` â€” `ANALYTICS_PROVIDER` env override; default `aptabase` when `config.appKey` or `process.env.APTABASE_APP_KEY`; unknown â‡’ `null`
- [x] 2.3 Tests with `vi.mock('@aptabase/electron/main')` (init order, key missing, props sanitize, group gating, flush waits inflight)

### Phase 3 â€” Renderer-side provider

- [x] 3.1 `src/renderer/analytics/aptabaseRendererProvider.ts` â€” ONLY module allowed to import `@aptabase/electron/renderer`; `track()` â†’ `trackEvent(name, props)`; App Key never present here
- [x] 3.2 `src/renderer/analytics/providerFactory.ts` â€” mirrors main backend from `analyticsGetState()` (same as `resolveRendererMonitorProvider`)
- [x] 3.3 Tests with `vi.mock('@aptabase/electron/renderer')`

### Phase 4 â€” Consent, IPC surface

- [x] 4.1 `src/main/analytics/consent.ts` â€” read/write `userData/analytics-consent.json`; missing â‡’ `readMonitoringConsent()` (D1 seed); corrupt â‡’ default `true`
- [x] 4.2 `IPC.ANALYTICS_GET_STATE` + `IPC.ANALYTICS_SET_ENABLED` in `src/shared/ipc-channels.ts` (+ `ANALYTICS_GET_GROUPS` if remote toggling needed)
- [x] 4.3 `src/main/analytics/ipcBridge.ts` â€” thin handlers returning `AnalyticsState`; persists consent via `writeAnalyticsConsent`; toggles facade (mirror `src/main/monitoring/ipcBridge.ts`)
- [x] 4.4 Preload: `analyticsGetState()`, `analyticsSetEnabled(enabled)` in `src/preload/index.ts` + synced `src/renderer/electron-api.d.ts`
- [x] 4.5 Synced mocks: `e2e/mocks/preload.js`, `src/test-setup.ts`

### Phase 5 â€” Bootstrap wiring

- [x] 5.1 MAIN `src/main/index.ts`: `bootstrapAnalytics()` at module load **before** `app.whenReady()` (D7), collocated with `bootstrapMonitoring()`; reads `analytics-consent.json`, builds `AnalyticsConfig`, calls `initAnalytics(config, resolveMainAnalyticsProvider)`
- [x] 5.2 Renderer bootstrap before React mount â†’ queries `analyticsGetState()`, `initAnalytics({ enabled, provider: backend })`; render guaranteed via `.finally` (same as monitoring)
- [x] 5.3 `will-quit`: `void flushAnalytics(5000)` before `closeAnalytics()` (adapter drains in-flight requests); renderer window close guarded by `window_close_deferred`
- [x] 5.4 CLI branch: after `cli_invoked`, **await** the track promise before exit; `cli_completed` on exit; `closeAnalytics()` on CLI/MCP exit paths

### Phase 6 â€” Event wiring (taxonomy v2 + journeys)

- [x] 6.1 `events.ts`: bump schema to 2; add all Â§4 events (~80) to `AnalyticsEventName` + `AnalyticsEventPayloadMap`
- [x] 6.2 Wire the `v1` launch cut (~45) per Â§4 tables (every journey table above)
- [x] 6.3 Journey sequence call sites: `tool_opened` (AppDrawer) + badge propagation so every event carries `ctx.route`/`ctx.jobKind`
- [x] 6.4 Enrich `conversion_*` in `job-queue.ts` with `durationSec`/`speedX`/`presetClass`/`container`/`mode` (no file names/paths/sizes)
- [x] 6.5 Review + wire `v2` groups behind `ANALYTICS_GROUPS` flags; default OFF for window-chrome, logs, MCP, playback/zoom, reorder (Â§5.4)
- [x] 6.6 Privacy lint pass: assert no payload carries paths/filenames; grep call sites for accidental path props
- [x] 6.7 Update `src/shared/analytics/__tests__/AnalyticsService.test.ts` for new taxonomy + routing + badge (no longer asserts breadcrumb behavior)

### Phase 7 â€” Settings UI (single switch, D1)

- [x] 7.1 `settingsStore.ts`: add `analyticsEnabled`; `setTelemetryEnabled(enabled)` calls `analyticsSetEnabled(enabled)` **and** `monitoringSetEnabled(enabled)`, adopts both results; hydration calls both getters
- [x] 7.2 `Settings.tsx`: relabel the existing switch (id `settings-monitoring-error-reporting` kept for tests) â†’ "Usage data & error reporting"; hint string updated
- [x] 7.3 i18n keys (en + all locales) + `npm run validate:locales`
- [x] 7.4 Emit `telemetry_opt_in`/`telemetry_opt_out` on transition (see Â§4 note)
- [x] 7.5 First-run `app_installed` marker (write `<userData>/first-launch` when absent) â†’ `app_installed` then `app_launched`

### Phase 8 â€” Docs & config

- [x] 8.1 `.env.example`: `APTABASE_APP_KEY`, `APTABASE_HOST`, `ANALYTICS_PROVIDER`, `ANALYTICS_GROUPS`
- [x] 8.2 New `docs/ANALYTICS.md` â€” architecture, privacy, env vars, event catalog reference, swap guide, recommended dashboard queries (funnels Â§5.2, feature adoption, retention)
- [x] 8.3 Update `docs/MONITORING.md` + `plans/SENTRY_MONITORING_PLAN.md` Â§6: analytics moved off the breadcrumb channel onto its own layer
- [x] 8.4 Update `wiki/` + `site/` privacy note ("usage analytics" disclosed alongside monitoring)

### Phase 9 â€” Tests

- [x] 9.1 Facade + noopProvider + badge middleware (Phase 1)
- [x] 9.2 `consent.test.ts` (seeding from monitoring file, tmp-dir based)
- [x] 9.3 `aptabaseMainProvider.test.ts` / `aptabaseRendererProvider.test.ts` (vi.mock)
- [x] 9.4 `providerFactory.test.ts` (main + renderer)
- [x] 9.5 `ipcBridge.test.ts` (mock electron `ipcMain`)
- [x] 9.6 `settingsStore` telemetry toggle tests
- [x] 9.7 Taxonomy completeness test: every `AnalyticsEventName` has wiring (grep-based) so the catalog never silently drifts
- [x] 9.8 Validate no direct `@aptabase/*` imports outside the two adapters (lint rule / CI grep)

### Phase 10 â€” Verification

- [x] 10.1 `npm run typecheck`
- [x] 10.2 `npm run lint`
- [x] 10.3 `npm run test:unit`
- [x] 10.4 `npm run validate:locales`
- [ ] 10.5 Manual smoke (dev with fake `A-DEV-` key on `http://localhost:3000`): full first-run journey replay lands in order; journey badge correct; toggle off â†’ silence; CLI run arrives; `APTABASE_HOST` honored for self-host key

## 8. Swap-Out Guide (future backend change)

1. Add `providers/<newBackend>MainProvider.ts` (+ renderer counterpart) implementing `AnalyticsProvider`.
2. Register it in the factory map (`'newbackend': ...`) in `src/main/analytics/providerFactory.ts` + renderer factory.
3. Set `ANALYTICS_PROVIDER=newbackend` (and its env vars, e.g. `POSTHOG_API_KEY`).
4. Delete the Aptabase adapter files + `@aptabase/electron` package when confident.
5. App code, IPC surface, consent logic, Settings UI, event taxonomy: **unchanged**.

## 9. Rollback

Set `ANALYTICS_PROVIDER=noop` (or unset `APTABASE_APP_KEY`) â€” the whole system becomes a
no-op without code changes. Removing the feature = revert this branch (call sites already
only touch the facade).

## 10. Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| SDK requires init before `app.whenReady()` | Bootstrap at module load (Phase 5.1); SDK buffers pre-init events (D7) |
| No `flush`/`close` in SDK â‡’ events could drop at quit | Adapter owns in-flight promise list; `flushAnalytics` drains it; CLI exit awaits the track promise |
| Renderer tracking depends on `aptabase-ipc` scheme registered by main | Renderer provider guards `isEnabled()`; failure is console-only in SDK and silently dropped by facade |
| Package has low release cadence / could be abandoned | Contained behind adapter; swap-out is one file (see Â§8) |
| Event flood / taxonomy drift | Two-tier rollout + `ANALYTICS_GROUPS` gating; categorical-only lint (6.6); wiring-completeness test (9.7); schema version on every event |
| Journey reconstruction ambiguity | `tool_opened` anchor + ctx badge + `source`/`mode`/`jobKind` disambiguation props (Â§5) |
| `telemetry_opt_out` lost on consent-off | Emit before disabling + flush; accept loss as fallback (Â§4 J11 note) |
| Network only reachable online | Fire-and-forget; events are non-blocking; dropped events are acceptable (analytics, not correctness) |