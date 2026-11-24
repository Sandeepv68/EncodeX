# PostHog Integration Plan — EncodeX

> Prepared 2026-11-23. Sources: repository audit (`package.json`, `src/**`, `docs/**`, `plans/**`)
> plus live inspection of the connected PostHog project through the PostHog MCP
> (`project-get`, `execute-sql` over `system.*`, `read-data-schema`) and current
> [PostHog docs](https://posthog.com/pricing).
>
> Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped.
>
> This file is the single source of truth for the integration. It replaces the stale
> baseline in the earlier revision of this plan (items marked "Missing" there are now
> implemented in code); prior decisions and the progress log are preserved below.

<!-- POSTHOG_PLAN_PROGRESS v1 — update table, phase header markers, checkboxes and log together -->

## 0. Progress tracker

> Last updated: 2026-11-23 · Overall: **46 / 60 items (77%)**
> Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped.
> A checkpoint is `[x]` only when its exit gate is demonstrated (insight link or
> screenshot + passing checks referenced in the progress log).

| Checkpoint | Scope | Items | Status | Exit gate |
| ---------- | ----- | ----- | ------ | --------- |
| **CP0** | Baseline and decisions | 4 / 4 · 100% | `[x]` | Live baseline and PD1–PD15 recorded here |
| **CP1** | Harden existing instrumentation | 6 / 7 · 86% | `[!]` | Traffic/group/test-account/log checks verified live; release annotation blocked on personal key |
| **CP2** | Saved analytics and dashboards | 9 / 9 · 100% | `[x]` | 6 dashboards + JSON exports + starter relabel + 3 enabled metric alerts |
| **CP3** | Groups and cohorts | 6 / 7 · 86% | `[~]` | 4 cohorts saved and exported |
| **CP4** | Feature flags and experiments | 3 / 7 · 43% | `[~]` | 3 declared flags + dedicated experiment flag; experiment draft with 1 primary/3 secondary metrics; runtime, kill switch, bucketing, and launch tests remain |
| **CP5** | Surveys | 3 / 4 · 75% | `[~]` | Survey launched for first `conversion_completed` on Desktop; consent gate/CSP done; live delivery remains |
| **CP6** | AI observability, logs, alerts | 4 / 6 · 67% | `[~]` | AI dashboard + metadata-only trace/span hierarchy + opt-in docs + enabled log alert; feedback, saved log views, and notification destination remain |
| **CP7** | Non-goals and site analytics | 6 / 6 · 100% | `[x]` | ADR merged; site analytics and scoped site heatmaps use project `709196` |
| **CP8** | Governance and data quality | 5 / 6 · 83% | `[~]` | Schema-check + CI guard + deletion/quota docs; payload-key/live-flag schema remains |
| **CP9** | Deferred / optional | 0 / 4 · 0% | `[ ]` | Revisit only on a recorded trigger |

**Active now:** CP1 release annotation, CP3 UI group-profile check, CP4 flag runtime/kill-switch and experiment bucketing/launch, CP5 live survey delivery, CP6 saved log views and AI feedback UI, CP8 schema payload keys, and web analytics/heatmap deploy and live verification. Alert configuration is complete; all three metric alerts and the high-severity log alert are enabled, with the log alert intentionally silent by owner choice.
Each implemented item must flip its checkbox, refresh this table, and append a
progress-log row in the same change.

---

## 1. Scope and non-negotiables

Goal: turn the already-working PostHog SDK integration into a **complete PostHog
program** — saved analytics, cohorts, flags, experiments, surveys, AI observability,
logs, governance — without weakening the privacy contract.

1. Payloads stay **categorical-only**: no file names, paths, media content, or free text
   in analytics events.
2. No backend credential enters the renderer. The public project token is fetched over
   IPC; personal/secret keys stay in main, local scripts, or CI secrets only.
3. One consent switch governs analytics and monitoring; no capability bypasses it.
4. Adapters never throw; analytics must never take the app down.
5. Prompt/completion content stays opt-in (`POSTHOG_AI_CAPTURE_CONTENT=true`).
6. Every saved insight filters `channel = prod` and honors the test-account cohort.

Companion docs: `docs/ANALYTICS.md`, `docs/ARCHITECTURE.md`,
`analytics/posthog/analytics-dashboards/README.md`, `docs/analytics-privacy-checklist.md`,
`plans/SENTRY_MONITORING_PLAN.md`.

---

## 2. Verified current state

### 2.1 Application and SDK integration (from code)

| Area | State | Evidence |
| ---- | ----- | -------- |
| Stack | Electron 43 + React 19 + TypeScript + Vite 8, npm, single root; main / preload / renderer split; CLI and embedded MCP entry points | `package.json:2-11,111-200`; `docs/ARCHITECTURE.md:9-17` |
| SDKs | `posthog-js@^1.445.3`, `posthog-node@^5.61.2` | `package.json:153-154` |
| Main client | Single `posthog-node` client, consent gate, host validation, super properties, release event, OTel log exporter | `src/main/analytics/posthogMainProvider.ts:62-151,157-215` |
| Renderer | `posthog-js` exists only for surveys; normal events relay via `IPC.ANALYTICS_TRACK_EVENT`, token never in renderer bundle | `src/renderer/analytics/posthogRendererProvider.ts:37-73`; `src/renderer/surveys/posthogSurveys.ts:27-43` |
| Facade | `AnalyticsService` buffers pre-init events, enforces consent, never throws | `src/shared/analytics/AnalyticsService.ts:109-189,241-309` |
| Taxonomy | Schema v2, ~129 event names in 15 groups with tier map; sanitizer strips non-primitives | `src/shared/analytics/events.ts:38-322`; `src/shared/analytics/sanitize.ts` |
| Identity | Persistent anonymous install id (UUID) is `distinctId`; no account/email/name; allowlisted person properties | `src/main/index.ts:125-154`; `src/shared/analytics/personProperties.ts:12-39` |
| Sessions | Own UUID with 30-minute inactivity rotation, attached as `$session_id` | `posthogMainProvider.ts:169-174` |
| Groups | `profile_kind` and `hardware_class` enums with cardinality guard and `groupIdentify` | `src/main/analytics/groups.ts:8-31`; `posthogMainProvider.ts:185-199,221-265` |
| Flags | Three flags registered with defaults/owners; remote fetch at startup, 2 s timeout, disk cache, group gate integration | `src/main/analytics/flags.ts:12-38`; `posthogMainProvider.ts:93-95,267-324` |
| AI observability | `$ai_generation` with model/provider/tokens/latency/errors across OpenAI-compatible, Anthropic, Gemini connectors; content opt-in | `src/main/ai/connectors.ts:174-190,311-474`; `posthogMainProvider.ts:357-389` |
| Logs | OTel log exporter to `/i/v1/logs`; markers only | `posthogMainProvider.ts:120-146` |
| Consent UI | Settings toggle drives analytics + monitoring | `src/renderer/stores/settingsStore.ts:426-458`; `AdvancedSettingsTab.tsx:104-114` |
| Config generation | `npm run gen:posthog-config` bakes public token/host into main; `.env.example:36-52` documents names | `scripts/generate-posthog-config.mjs:26-45` |
| Tests | Vitest unit/integration, `npm run typecheck:*`, lint, `npm run doc:drift`, `npm run analytics:schema-check`, e2e | `package.json:30-100`; `docs/TESTING.md:7-31` |

### 2.2 PostHog project (live MCP inspection)

| Property | Value |
| -------- | ----- |
| Project | `EncodeX`, id `709196` (US Cloud, `https://us.i.posthog.com`), timezone UTC |
| Person-on-events | Enabled |
| Group types | `hardware_class` (index 0), `profile_kind` (index 1) |
| Test accounts | Cohort `689593` "Internal / Test users" applied as project test-account filter |
| Products enabled | Product analytics, web analytics, session replay, flags, experiments, surveys, error tracking, logs, AI observability, workflows, metrics, endpoints, MCP analytics available; only privacy-compatible products are used, with exception capture as the documented non-categorical exception |
| Saved insights | 34 (5 wizard + 8 starter + 15 CP2 + 5 AI observability + 1 alert-source volume insight `14531023`) |
| Dashboards | 9 (2 starter/wizard + 7 owned: activation, retention, feature adoption, reliability, batch health, hardware mix, AI observability) |
| Cohorts | 5 (test-account exclusion + 4 behavioral) |
| Feature flags | 3 declared live (100% / 100% / 0%) plus 1 experiment-only 0% rollout flag (`mcp_server_default_on_experiment`) and 1 active survey-targeting flag (`1120431`) |
| Experiments / surveys / annotations | 1 draft experiment (`629482`, 1 primary + 3 secondary metrics); 1 launched survey (`01a20809-2a1a-0000-3d9b-4076a5323850`, started `2026-11-23T12:01:54.605873Z`); 0 annotations |
| Governance artifacts | 1 notebook, 3 enabled daily insight alerts, 1 enabled high-severity log alert, 1 quarterly reminder, 7 dashboard exports, cohort export, traffic audit |
| Billing posture | Free tier: 1M events, 1M flag requests, 100K AI events, 1,500 survey responses, 100K exceptions, 10 GB logs, 5K replays, 1M warehouse rows ([pricing](https://posthog.com/pricing)) |

### 2.3 Live data flow (last 7 days)

`read-data-schema` confirms 70+ custom events arriving, including `app_launched`,
`app_installed`, `$identify`, `$groupidentify`, `app_release`, `tool_opened`,
`onboarding_started`, `conversion_started/completed/failed`, `remux_*`, `demux_*`,
`batch_completed`, `mcp_server_toggled`, `codec_changed`, `hw_accel_detected`,
`ui_error_shown`, `$ai_generation`, and CLI events. Top volume: `tool_opened` 295,
`$identify` 218, `app_launched` 135, `app_installed` 111, `app_release` 111; about
106 distinct persons. At audit time `$ai_span`, `$ai_feedback`, `$feature_flag_called`,
`$pageview`, and `$exception` had **no** traffic. The code now emits metadata-only
`$ai_span` events, span IDs on `$ai_generation`, and additive `$exception` events;
runtime arrival still needs a consented app run. `$ai_trace` remains a PostHog
pseudo-trace created from child events unless an explicit trace event is later
required.

Conclusion: ingestion, identity, groups, releases, AI generation capture, alerts,
and survey launch work end-to-end in PostHog. Remaining work is live delivery and
notification routing, experiment/flag runtime checks, web analytics deploy
verification, and live `$exception` confirmation.

---

## 3. What is possible to set up in PostHog (capability inventory)

| Product / capability | Fit for EncodeX | Current state | Phase |
| -------------------- | --------------- | ------------- | ----- |
| Product analytics: events, trends, funnels, retention, stickiness, paths, lifecycle | Core — ~129 typed events already flow | 15 owned insights across 6 dashboards; starter/wizard charts still mixed in | 2 |
| Dashboards, saved insights, subscriptions, metric alerts | Core | 7 owned dashboards; 3 enabled daily metric alerts with email subscriber `844296` | 2, 8 |
| Person profiles and group analytics (`profile_kind`, `hardware_class`) | Core | Working; group profile UI check remains | 3 |
| Behavioral cohorts (power/MCP/batch/churn) | Core | 4 saved and exported | 3 |
| Feature flags: kill switches, staged rollouts, multivariate, payloads | Core — 3 flags declared in code | 3 live; runtime and kill-switch checks remain | 4 |
| Experiments with pre-registered metrics | High — one pilot | 1 draft pre-registration; launch/bucketing blocked | 4 |
| Surveys (NPS/PMF/CSAT, event-triggered) | Medium — renderer module wired and CSP-ready | 1 launched event-triggered survey; live delivery still needs a consented app run | 5 |
| AI Observability: generations, traces, spans, costs, dashboards | High — Copilot + three AI connectors | Generation capture, metadata-only spans, 5 insights, 1 dashboard; feedback UI absent | 6 |
| AI evaluations / PostHog AI | Optional — team productivity, not desktop instrumentation | Available in PostHog; no app-side eval harness | 9 (optional) |
| Logs / OTel / distributed tracing / APM | Medium — exporter already sends logs | 1 enabled high-severity log alert, intentionally silent by owner choice; no saved log views; APM spans not emitted | 6, 9 |
| Error tracking | Medium — second triage signal alongside Sentry | Additive `$exception` capture implemented with sanitized context and one consent switch; live arrival pending | 7 (exception to prior exclusion) |
| Session replay, heatmaps, autocapture, dead-click detection, web vitals | Excluded on desktop — screens show media names/paths; pageviews not emitted | No desktop replays/heatmaps/autocapture/pageviews; site heatmaps scoped to 3 allowlisted pages with saved heatmaps | 7 (keep off on desktop) |
| Web analytics / marketing analytics | Optional for the VitePress site, separate project | Reuses project `709196` for page views and scoped heatmaps; GA4 remains in place | 7 |
| Data warehouse, sources, CDP, realtime destinations, batch exports | Deferred — free-tier rows are tight | No sources or pipelines | 9 (deferred) |
| Workflows, transactional messaging, Inbox | Not applicable today — no outbound email/SMS path | None | 9 (deferred) |
| Replay Vision | Not applicable without session replay | Available in product but blocked by replay exclusion | 7 (keep off) |
| Endpoints, MCP tooling, PostHog AI apps (web/Slack/MCP/CLI) | Optional team productivity | MCP used for setup/analysis; no public endpoints created | 9 (optional) |
| Activity logs / audit trail | Governance only — PostHog records who changed project resources | Available in PostHog; not an app-side user activity feed | 8 |
| Schema sync, privacy checklist, CI guard, deletion procedure | Core governance | Schema check, CI guard, checklist, retention/quota docs, governance notebook, reminder present | 8 |

Docs for the main surfaces: [all products](https://posthog.com/docs),
[product analytics](https://posthog.com/docs/product-analytics),
[feature flags](https://posthog.com/docs/feature-flags),
[retention](https://posthog.com/docs/product-analytics/retention),
[AI traces/spans](https://posthog.com/docs/ai-observability/traces),
[manual AI capture](https://posthog.com/docs/ai-observability/installation/manual-capture),
[session replay privacy](https://posthog.com/docs/session-replay/privacy),
[activity logs](https://posthog.com/docs/settings/activity-logs),
[web analytics](https://posthog.com/docs/web-analytics), [pricing](https://posthog.com/pricing).

---

## 4. Decisions and constraints

| # | Decision | Choice | Status |
| - | -------- | ------ | ------ |
| PD1 | Person model | Anonymous install id only; no account, email, or name | `[x]` in code |
| PD2 | Person properties | Allowlisted coarse fields only (`app_version`, `os`, `arch`, `locale`, `channel`, `mode`, `hw_accel_available`, `first_seen_version`) | `[x]` in code |
| PD3 | Super properties / sessions | Adapter-merged registry; `$session_id` with 30-min rotation | `[x]` in code |
| PD4 | Group types | `profile_kind`, `hardware_class`; enum-only keys | `[x]` in code; `[~]` PostHog-side cohorts |
| PD5 | Flag transport | Main process only, remote eval, 2 s startup timeout, disk cache, compiled defaults | `[x]` in code and PostHog; runtime verification remains |
| PD6 | Local flag evaluation | Not enabled (would require a secret key in main); revisit only if latency matters | `[x]` |
| PD7 | Renderer `posthog-js` | Surveys only: opt-in, no autocapture/replay/pageviews, CSP scoped to PostHog host | `[x]` in code; survey launched, live delivery pending |
| PD8 | Error tracking | Sentry remains primary; PostHog captures exceptions additively under the same consent switch (ADR-0002 supersedes ADR-0001) | `[x]` in code; live verification pending |
| PD9 | Session replay | Excluded — screens expose media names/paths | `[x]` |
| PD10 | Autocapture | Excluded on desktop; site web only on the 3 heatmap allowlist URLs | `[x]` |
| PD11 | Dashboards as code | JSON exports in `analytics/posthog/analytics-dashboards/`; repo is source of truth | `[x]` |
| PD12 | Data warehouse export | Out of scope for now (free-tier row budget) | `[-]` |
| PD13 | Project topology | One project; dev/prod separated by `channel`; all insights filter `channel = prod` | `[x]` |
| PD14 | Quota behavior | Free-tier overages drop events / return flag defaults; app treats both as normal | `[x]` |
| PD15 | Source of truth for this plan | This file; the previous stale baseline is superseded | `[x]` |

Owner answers already on record: free tier (Q1), startup flag request allowed (Q2),
coarse person properties allowed (Q3), renderer SDK for surveys approved (Q4), keep
Sentry primary (Q5), plan lives in `plans/POSTHOG_PLAN.md` (Q6), relabel starter insights
(Q7), create experiment draft only (Q8), reuse project `709196` for site analytics
(Q9), configure alerts (Q10), launch the survey (Q11), daily 09:00 UTC cadence with
email subscriber `844296` (Q12), first-conversion Desktop trigger with partial
responses/no free text (Q13), leaving the log alert silent for now (Q14), and site
web heatmaps on 3 allowlisted pages with saved heatmaps (Q15). Open
decisions: experiment bucketing/launch. Desktop replay and autocapture exclusions
stand; the error-tracking exclusion was explicitly reversed by ADR-0002.

---

## 5. Gap analysis

1. **Runtime verification still trails configuration.** Flags, cohorts, dashboards,
   spans, exception capture, and the survey gate exist, but flag exposure events,
   `$ai_span` arrival, `$exception` arrival, logs, and survey delivery need a
   consented app run.
2. **Alerts are configured; the log alert is intentionally silent.** Three daily metric
   alerts and the high-severity log alert are enabled with email subscriber `844296`;
   the owner chose to leave the log alert without a notification destination for now.
   Saved log views remain uncreated.
3. **Starter-insight hygiene is fixed locally in PostHog.** Eight starter insights
   are relabeled `[Starter]` and tagged `non-production-sample`; their queries now
   use real `app_launched`/`tool_opened` events, while synthetic `$pageview`/`$screen`
   route events populate the generic Product Analytics overview cards.
4. **The survey is live; the experiment remains a draft.** Survey
   `01a20809-2a1a-0000-3d9b-4076a5323850` started `2026-11-23T12:01:54.605873Z` with
   first-conversion Desktop targeting; experiment `629482` has saved metrics but no
   bucketing confirmation, and setup context is not enabled on this connection.
5. **AI observability is incomplete but no longer shallow.** Generations, metadata-only
   spans, and a dashboard exist; `$ai_feedback` needs a new categorical rating UI and
   evaluations remain optional.
6. **Site/web analytics reuses the same project.** The desktop app still emits no
   pageviews; the VitePress site now has an env-gated, cookieless page-view and
   scoped heatmap snippet that needs deploy environment variables, the free-plan
   Heatmap capture URL selection, and live verification.
7. **Desktop exclusions mostly stay off.** Session replay, autocapture, and
   Replay Vision conflict with recorded privacy/stack decisions. Site heatmaps and
   additive PostHog exception capture are the explicit reversals, scoped to three
   site URLs and sanitized exception payloads respectively.

---

## 6. Implementation phases

### Phase 0 — Baseline and decisions (CP0) `[x]`

- [x] Snapshot taxonomy (`events.ts`, schema v2) and verify wiring test.
- [x] Record decisions PD1–PD15 and owner answers Q1–Q6.
- [x] Confirm one-project topology and test-account cohort `689593`.
- [x] Refresh baseline against live project (this file).

### Phase 1 — Harden existing instrumentation (CP1) `[!]`

- [x] Capture, identify, groups, super properties, sessions, releases, AI metadata live.
- [x] Verify every `ANALYTICS_EVENT_GROUP` has recent traffic; list silent events in
      `analytics/posthog/analytics-dashboards/event-traffic-audit.md` with a reason (feature not shipped,
      tier v2 gate, or missing call site). Use `read-data-schema` + a 30-day SQL scan.
- [x] Confirm `$groupidentify` values match the enum keys in `groups.ts` (observed keys
      `cpu`, `gpu_hw`, `gpu_sw`, `custom` are bounded).
- [!] Add a PostHog annotation on each release (personal key in CI secrets only) and
      verify one annotation appears next to `app_release` events. Blocked: no personal
      API key available in this environment.
- [x] Add internal test-account filtering verification: re-run one insight with and
      without cohort `689593` and record the delta (identical; cohort count is 0).
- [x] Verify OTel log retention/cost for `/i/v1/logs` and document the decision
      (14-day default, 10 GB/month free tier, custom retention off).
- [x] Confirm `posthog-node` v6 API surface before any SDK upgrade; installed `5.61.2`
      typechecks with `getFeatureFlag(..., { sendFeatureFlagEvents: true })`.
- **Exit gate:** live probe shows events, groups, persons, release annotation, and
  log cost documented; typecheck/lint green.

### Phase 2 — Saved analytics and dashboards (CP2) `[~]`

Create native typed insights (TrendsQuery / FunnelsQuery / RetentionQuery etc.), not
HogQL wrappers, then export dashboards to `analytics/posthog/analytics-dashboards/`.

- [x] **Activation dashboard** (`activation.json`): funnel `app_launched` →
      `onboarding_started` → `onboarding_goal_selected` → `conversion_started` →
      `conversion_completed` (7-day window), one insight each for `mode` and `channel`
      breakdowns, filter `channel = prod`.
- [x] **Retention dashboard** (`retention.json`): daily first-time retention on
      `app_launched` through D30, WAU by person property `first_seen_version`,
      and WAU/MAU trends.
- [x] **Feature adoption** (`feature-adoption.json`): weekly unique users per event
      group (`convert`, `image`, `audio`, `cut`, `queue`, `mcp`), breakdown by platform.
- [x] **Reliability** (`reliability.json`): conversion and combined media failure
      formulas (`*_failed / *_started`); `ui_error_shown` by `ctx.route` and
      `category` (no free text; no `error_code` emitted).
- [x] **Batch health** (`batch-health.json`): `batch_queue_started` vs
      `batch_completed`, median/p90 `jobCount` proxy, and retry rate; job duration
      is not currently captured.
- [x] **Hardware/transcoder mix** (`hardware-mix.json`): `transcoder_changed`,
      `hwaccel_mode_changed`, `encoder_type_changed` by platform.
- [x] Add alerts: conversion failure rate above 10%, event-volume drop below 50% of
      the trailing 7-day baseline, and AI generation error rate above 10%. All are
      enabled daily at 09:00 UTC with email subscriber `844296` (alert IDs
      `01a20846-cc85-7689-a9b9-e65b72ebf341`, `01a20846-d247-7da1-94ac-d376cd0399d8`,
      `01a20846-cdcf-7755-98f4-b30de2b64900`).
- [x] Relabel and repoint the 8 starter insights that relied on `$pageview` to real
      `app_launched`/`tool_opened` events, keeping `[Starter]` and
      `non-production-sample`; keep the 5 wizard insights separate.
- [x] Emit synthetic `$pageview`/`$screen` route events from the desktop app so the
      generic Product Analytics overview cards have sessionized traffic.
- [x] Export each dashboard to JSON from saved definitions locally; never in CI.
- **Exit gate:** six dashboards exist in PostHog, six JSON files committed, README
  lists question + query notes, every saved insight filters `channel = prod`.

### Phase 3 — Groups and cohorts (CP3) `[~]`

- [x] Group types exist in project; enum keys defined in code.
- [x] Power users: ≥10 `conversion_completed` in 7 days (cohort `751458`).
- [x] MCP users: `mcp_server_toggled` with `enabled = true` at least once (cohort `751459`).
- [x] Batch users: ≥3 `batch_queue_started` in 30 days (cohort `751460`).
- [x] Churn risk: ≥1 `app_launched` 14–28 days ago, zero in last 14 days (cohort `751461`).
- [x] Export cohort definitions to `analytics/posthog/analytics-dashboards/cohorts.json`.
- [ ] Add a group profile check for `hardware_class` and `profile_kind` in PostHog UI.
- **Exit gate:** four cohorts saved and exported; group counts bounded; no user-defined
  strings in group keys.

### Phase 4 — Feature flags and experiments (CP4) `[~]`

- [x] Create the three declared flags in PostHog with matching keys, owners, defaults,
      and removal date `2027-01-01`: `analytics_group_convert` (default on),
      `analytics_group_queue` (default on), `mcp_server_default_on` (default off).
- [ ] Verify runtime precedence offline: env override > disk cache > compiled default;
      confirm `$feature_flag_called` appears after startup when consent is on.
- [ ] Test remote kill switch: flip `analytics_group_convert` off in PostHog and
      confirm no `convert` events are emitted without a release.
- [x] Pre-register one experiment in `analytics/posthog/analytics-experiments/<name>.md`:
      hypothesis, primary metric, guardrails, MDE, duration. Draft experiment
      `629482` uses dedicated flag `mcp_server_default_on_experiment`; the boolean
      rollout-control flag `mcp_server_default_on` remains unchanged.
- [x] Create the PostHog experiment draft with 1 primary and 3 secondary metrics
      using confirmed events; bucketing and launch remain blocked by setup context
      and owner confirmation.
- [ ] Wire variant assignment through the flag system; guardrail: stop if
      `conversion_failed` rate rises >1 percentage point.
- [ ] Staged rollout 10% → 50% → 100%, then remove the flag and code branch.
- **Exit gate:** flags exist and are evaluated; kill switch and offline fallback
  tested; one experiment pre-registered and launched.

### Phase 5 — Surveys (CP5) `[~]`

- [x] Call `initPosthogSurveys(consent)` from the renderer bootstrap for consenting
      users only (`src/renderer/main.tsx` analytics section), gated by config so it can
      be disabled without a release.
- [x] Extend CSP: add the configured PostHog host to `connect-src` in
      `src/shared/csp.ts:29` (and `script-src` only if a remote script is used); keep
      `posthogSurveys.ts` options `autocapture: false`, `capture_pageview: false`,
      `persistence: 'memory'`, no replay.
- [x] Launch one categorical survey (NPS + product area) in PostHog; trigger after the
      first `conversion_completed` on Desktop, once per install; no free-text attached
      to analytics events. Survey `01a20809-2a1a-0000-3d9b-4076a5323850` started
      `2026-11-23T12:01:54.605873Z`; partial responses on, limit `1000`, internal
      targeting flag `1120431` active.
- [ ] Verify survey delivery with a live renderer run and check no media/path text
      leaks into events.
- **Exit gate:** one survey live, consent + CSP verified, response counts visible.

### Phase 6 — AI observability, logs, and alerts (CP6) `[~]`

- [x] Metadata-only `$ai_generation` for OpenAI-compatible, Anthropic, Gemini.
- [x] Group Copilot AI routing with one `$ai_trace_id` per plan request and emit a
      metadata-only `copilot.route` `$ai_span`; generations carry `$ai_span_id` and
      `$ai_parent_id` using PostHog's documented manual-capture properties.
- [ ] Add `$ai_feedback` on user thumb/up-down or copilot result rating (categorical);
      no rating UI exists yet, so the provider plumbing is intentionally deferred.
- [x] Build an AI dashboard: generations, tokens, latency, cost by `$ai_provider`
      and model; error rate by provider.
- [~] Create saved log views/alerts for high-severity OTel logs. Alert
      `01a20809-59ae-7c9c-8ee0-e46109d4d6ca` is enabled (`error`/`fatal` > 0 in 5 min,
      15 min cooldown) and intentionally silent by owner choice; saved log views and
      verification with real log traffic remain. The 10 GB/month free-tier budget is
      documented.
- [x] Keep `POSTHOG_AI_CAPTURE_CONTENT=false` in production; document opt-in procedure.
- **Exit gate:** trace/span hierarchy implemented and verified in PostHog, AI dashboard
  saved, log cost documented.

### Phase 7 — Explicit non-goals, site analytics, and additive error capture (CP7) `[x]`

- [x] Keep Sentry primary and add PostHog `$exception` capture under the same consent
      switch (PD8, PD9, PD10); ADR-0002 supersedes ADR-0001.
- [x] No session replay, heatmaps, or autocapture in the desktop app.
- [x] Reuse project `709196` for VitePress web analytics with an env-gated,
      cookieless snippet in `site/.vitepress/config.mts`; the desktop app sends only
      categorical events plus the documented exception path, and GA4 remains in place.
- [x] Enable site heatmaps only on `/`, `/download`, and `/video-converter` via
      `capture_heatmaps`, `capture_pageleave`, and an autocapture URL allowlist; keep
      session replay, surveys, cookie storage, and console error capture off.
- [x] Capture browser unhandled errors and rejections on the three scoped site pages
      with `capture_exceptions`; live arrival still needs a deployed site build.
- [x] Create saved heatmaps for the three scoped site pages; live capture still needs
      deploy env vars and the UI-only Heatmap capture URL selection.
- [x] Write `analytics/posthog/adr/0001-error-tracking-sentry-only.md` for the original
      Sentry vs PostHog decision (stack traces, Electron support, cost, PII,
      duplication) and `analytics/posthog/adr/0002-additive-posthog-error-tracking.md`
      for the current additive decision.

### Phase 8 — Governance and data quality (CP8) `[~]`

- [ ] Generate `analytics/posthog/analytics-dashboards/data-schema.json` from `events.ts` including
      event names, groups, payload keys, and schema version; include live traffic flags.
- [x] Complete `npm run analytics:schema-check` (read-only, local personal key) and
      make CI fail on taxonomy/dashboard drift.
- [x] Add the `docs/analytics-privacy-checklist.md` reference to
      `.github/PULL_REQUEST_TEMPLATE.md` for changes under `src/{shared,main}/analytics/`.
- [x] Document project retention period and the install-id → person deletion procedure.
- [x] Add quota monitoring documentation: event volume, flag requests, AI events,
      survey responses, and log bytes against free-tier limits; review at 50%, 80%, 95%.
      A daily event-volume drop alert and the high-severity log alert are now live;
      the log alert is intentionally silent by owner choice.
- [x] Schedule quarterly flag/experiment hygiene review (three flags have removal
      dates of 2027-01-01).
- **Exit gate:** schema-check green locally and in CI; checklist in template;
  retention/deletion and quota docs committed.

### Phase 9 — Deferred / optional `[ ]`

- [ ] Data warehouse sources, pipelines, and batch exports if event volume or
      cross-source questions justify the free-tier row budget (PD12).
- [ ] Workflows / transactional email only if the app gains an outbound email path.
- [ ] Notebooks for experiment write-ups; Inbox/self-driving for automated metric
      review; endpoints/MCP tooling for team queries.
- [ ] Revisit local feature-flag evaluation only if startup latency becomes measurable.

---

## 7. Verification and test strategy

| Layer | What is tested | Tooling |
| ----- | -------------- | ------- |
| Unit (main) | Identify allowlist, super-property merge, session rotation, flag precedence, group enum guard | Vitest, mocked `posthog-node` |
| Unit (renderer) | Survey boot gating and IPC relay only; no keys or flag logic in renderer | Vitest, jsdom |
| Contract | Every event name has wiring; every dashboard references existing events | Vitest + `analytics:schema-check` |
| Live probe | Events, flags, cohorts, surveys, traces, and `$exception` arrive in project `709196` | MCP `read-data-schema` / `execute-sql`, temporary probe removed after run |
| Privacy | No path/name/free-text fields pass the event sanitizer or survey events; exception context is filtered/bounded and raw stacks are documented as the deliberate exception | Property tests on `sanitizeAnalyticsProps` and `sanitizeExceptionContext` |
| Security | CSP contains only the configured host; no secret keys in renderer bundle | CSP tests + bundle grep in CI |

Per checkpoint: `npm test`, `npm run typecheck:main`, `npm run typecheck:renderer`,
lint, `npm run doc:drift`, and `npm run build` must be green.

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Dev events pollute production metrics | Wrong conclusions | `channel = prod` filter on every insight; test-account cohort `689593` |
| Flag request slows startup / fails offline | Broken features | 2 s timeout, disk cache, compiled defaults, precedence tests |
| Survey SDK leaks content | Privacy breach | Consent gate, no autocapture/replay/pageviews, scoped CSP, categorical questions only |
| Site autocapture leaks page content | Privacy breach | Three-URL autocapture allowlist, memory-only persistence, no session replay or surveys on site |
| Cardinality explosion | Cost and slow insights | Enum-only group keys, person-property allowlist, `$process_person_profile: false` on noisy events |
| Secret key leak into app bundle | Account compromise | Keys only in CI/local scripts; bundle grep in CI |
| Free-tier quota hit | Dropped events / flag defaults | 70% alerts, volume dashboard, keep high-volume logs out of event stream |
| Duplicate error tooling | Cost and confusion | Sentry primary, additive PostHog capture, one consent switch, Node SDK dedupe, ADR-0002 |
| Plan drift | Misleading roadmap | This file updated in the same PR as each checkpoint |

---

## 9. Definition of done

- Code, tests, and docs land in one PR.
- The relevant checkbox flips to `[x]` in this file in the same PR with a progress-log line.
- Privacy checklist answered for any event/property change.
- Every user-visible PostHog item is verified live (insight link or screenshot in the PR).
- All checks in section 7 pass.

---

## 10. Progress log

Newest first.

| Date | Checkpoint | Item | Commit | Notes |
| ---- | ---------- | ---- | ------ | ----- |
| 2026-11-23 | CP7 | Post-change validation and live-state check | - | Full unit suite (5,628 tests / 386 files), full typecheck, lint, format, doc:drift, analytics:schema-check, docs:build, and diff check pass; live project `709196` confirms `heatmaps_opt_in: true` and saved heatmaps `6otWQYCW`, `gwYwhE7F`, and `bU3wMrlM` completed at 375/768/1440 px, while `read-data-schema` still shows `$exception` and `$pageview` with no traffic in the last 30 days — live arrival still needs a consented app run and a deployed site build |
| 2026-11-23 | CP7 | Added additive PostHog exception capture | - | Sentry remains primary; main/renderer/site exceptions now reach PostHog under the single consent switch with sanitized context, bounded pre-init buffering, Node SDK dedupe, and no-throw adapters; ADR-0002 supersedes the Sentry-only ADR; live `$exception` verification remains |
| 2026-11-23 | CP7 | Enabled scoped site heatmaps and saved heatmaps | - | Project `709196` already had `heatmaps_opt_in: true`; the VitePress snippet now enables `capture_heatmaps` and `capture_pageleave` with autocapture limited to `/`, `/download`, and `/video-converter`; saved heatmaps `6otWQYCW`, `gwYwhE7F`, and `bU3wMrlM` completed at 375/768/1440 px; desktop replay/heatmaps/autocapture remain off; live capture still needs deploy env vars and the UI-only Heatmap capture URL selection; lint, full typecheck, format, doc:drift, analytics:schema-check, docs:build, and diff check pass |
| 2026-11-23 | CP2/CP5/CP6 | Launched survey, enabled alerts, and synced rollout docs | - | Created event-volume insight `14531023` and enabled daily alerts `01a20846-cc85-7689-a9b9-e65b72ebf341` (conversion failures >10%), `01a20846-cdcf-7755-98f4-b30de2b64900` (AI errors >10%), `01a20846-d247-7da1-94ac-d376cd0399d8` (volume <50% of trailing 7 days); enabled log alert `01a20809-59ae-7c9c-8ee0-e46109d4d6ca` (intentionally silent by owner choice); launched survey `01a20809-2a1a-0000-3d9b-4076a5323850` at `2026-11-23T12:01:54.605873Z` and enabled targeting flag `1120431`; full typecheck, format, lint, doc:drift, analytics:schema-check, docs:build, and diff check pass |
| 2026-11-23 | CP2/CP4/CP7 | Added experiment metrics, starter relabeling, and site web analytics | - | Experiment `629482` now has 1 primary + 3 secondary metrics on dedicated flag `mcp_server_default_on_experiment` (flag id `1120584`); 8 starter insights relabeled, retagged, and repointed to real EncodeX events; desktop emits synthetic `$pageview`/`$screen` route events; VitePress site uses env-gated cookieless `$pageview` snippet; full typecheck, format, lint, doc:drift, analytics:schema-check, docs:build, and diff check pass |
| 2026-11-23 | CP6 | Added metadata-only AI trace hierarchy | - | `$ai_generation` now carries `$ai_span_id`/`$ai_parent_id`; Copilot routing emits a `copilot.route` `$ai_span` with one `$ai_trace_id` per plan request; capability inventory refreshed from PostHog docs; full typecheck and full test suite (5,616 tests) pass |
| 2026-11-23 | CP4/CP6/CP7/CP8 | Added AI observability artifacts and governance docs | - | AI dashboard 2399517 + 5 insights + `ai-observability.json`; draft survey `01a20809-2a1a-0000-3d9b-4076a5323850`; governance notebook `Vl1aPIvR`; disabled logs alert `01a20809-59ae-7c9c-8ee0-e46109d4d6ca`; quarterly reminder `01a20809-5afd-7f33-a101-c9689a27acfb`; ADR + experiment pre-registration + retention/quota/opt-in docs; analytics-schema CI guard added; format, lint, full typecheck, 58 focused tests, doc:drift, schema-check, and diff check pass |
| 2026-11-23 | CP5 | Survey gate, CSP host plumbing, and local bootstrap | - | `POSTHOG_SURVEYS_ENABLED` defaults off; `initPosthogSurveys(consent)` wired; `POSTHOG_HOST` origin added to `connect-src` with invalid-host rejection; 22 focused tests pass |
| 2026-11-23 | CP2 | Created six dashboards, 15 insights, and six JSON exports | - | Dashboard IDs 2399420–2399425; all insights filter `channel = prod`, cohort 689593, test accounts off; README updated; lint, typecheck:main, 36 focused tests, and doc:drift pass |
| 2026-11-23 | CP1 | Added OTLP log `Content-Type` and flag exposure events | - | `posthogMainProvider.ts`; typecheck:main and 36 focused tests pass |
| 2026-11-23 | CP1 | Event traffic audit + group/test-account/log checks | - | 60/129 typed events seen; 69 silent; test-account delta 0; 14-day log retention kept |
| 2026-11-23 | CP4 | Created 3 declared flags | - | IDs 1120335/1120336/1120337; defaults 100%/100%/0%; `remove-by:2027-01-01` tags |
| 2026-11-23 | CP3 | Created 4 behavioral cohorts and exported definitions | - | IDs 751458/751459/751460/751461; test-account filter enabled; counts 1/1/0/67 |
| 2026-11-23 | CP0 | Plan refreshed from live project + code audit; stale baseline corrected | - | PostHog MCP: project 709196, 13 insights, 2 dashboards, 0 flags/surveys/experiments |
| 2026-11-04 | - | Full PostHog integration and AI observability | `e6ff6f8e` | Pushed to `fix/otel-posthog-compat` |
| 2026-11-04 | - | Host misconfiguration surfaced; `.env` parsing aligned with dotenv | `8d425e35` | Root cause of "no events in PostHog" |
| 2026-11-04 | CP0 | 0.1–0.5 done; plan created | - | Baseline verified in code |
| 2026-11-04 | CP0 | Owner answered Q1–Q6; plan updated | - | Free tier, one project, Sentry kept, flags and surveys approved |
