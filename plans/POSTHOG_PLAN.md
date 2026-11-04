# PostHog Product Analytics Plan - EncodeX

> Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped
>
> **Goal:** Turn the existing PostHog integration (main-process capture, `$ai_generation`,
> OTel logs, consent gate, sanitizer) into a full product-analytics program: person and group
> analytics, saved funnels and retention, feature flags and experiments, in-app surveys,
> error tracking as an opt-in, and governance that keeps the taxonomy and PostHog in sync.
>
> **Non-negotiable constraints (carried over from `docs/ANALYTICS.md`):**
> 1. Payloads stay **categorical-only**: no file names, paths, media content, or free text.
> 2. No backend credential enters the renderer. The personal API key (secret) stays in main.
> 3. Consent is central. Every new capability respects the single telemetry switch.
> 4. Adapters never throw. Analytics must never take the app down.
> 5. Prompt and completion content stays opt-in (`POSTHOG_AI_CAPTURE_CONTENT=true`).
>
> Companion docs: `docs/ANALYTICS.md` (current design), `plans/APTABASE_ANALYTICS_PLAN.md`
> (original provider-agnostic design), `plans/SENTRY_MONITORING_PLAN.md` (error monitoring),
> `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` (KPI tracker).

---

## 0. Progress Dashboard

| Checkpoint | Scope | Status | Exit gate |
| ---------- | ----- | ------ | --------- |
| **CP0** | Baseline and governance groundwork | `[x]` | Taxonomy snapshot, instrumentation audit, and open decisions recorded here. |
| **CP1** | Foundations: identity, super properties, release tracking | `[ ]` | Person profiles, global properties, and release annotations verified in PostHog. |
| **CP2** | Saved analytics: funnels, retention, dashboards as code | `[ ]` | Five dashboards exist in PostHog and are exported to `docs/analytics-dashboards/`. |
| **CP3** | Group analytics and cohorts | `[ ]` | Group events appear with bounded cardinality; cohorts saved. |
| **CP4** | Feature flags (remote kill switches and rollouts) | `[ ]` | Group gate and one feature rollout controlled remotely, with offline fallback tested. |
| **CP5** | Experiments and in-app surveys | `[ ]` | One experiment with a pre-registered metric; one survey live with consent gating. |
| **CP6** | Error tracking decision and AI observability expansion | `[ ]` | Decision recorded (ADR); AI traces and span hierarchy verified. |
| **CP7** | Governance: schema sync, CI guard, privacy review | `[ ]` | CI fails on taxonomy drift; privacy review checklist enforced in PRs. |

Update this table as checkpoints close. A checkpoint is `[x]` only when its exit gate is
demonstrated (screenshot or saved-insight link in the PR, plus passing tests).

---

## 1. Current State (Baseline, verified in code)

| Area | Status | Where |
| ---- | ------ | ----- |
| Typed event taxonomy (~120 events, groups, schema v1) | Present | `src/shared/analytics/events.ts` |
| Main-process capture via `posthog-node` | Present | `src/main/analytics/posthogMainProvider.ts` |
| Renderer relay over IPC (no token in renderer) | Present | `src/renderer/analytics/posthogRendererProvider.ts`, `ipcBridge.ts` |
| Consent gate (single switch, two stores) | Present | `src/main/analytics/consent.ts`, `AnalyticsService.ts` |
| Per-group emission gate (`ANALYTICS_GROUPS`) | Present (env only) | `src/main/analytics/groupGate.ts` |
| Prop sanitizer (primitives only) | Present | `src/shared/analytics/sanitize.ts` |
| Anonymous install id as `distinctId` | Present | `src/main/index.ts` (`analytics-install-id.txt`) |
| AI generations as `$ai_generation` (metadata by default) | Present | `src/main/ai/connectors.ts` |
| OTel log export to `/i/v1/logs` | Present (markers only) | `posthogMainProvider.ts` |
| Wiring test: every event has a call site | Present | `src/shared/analytics/__tests__/AnalyticsWiring.test.ts` |
| `identify` / person properties | **Missing** | - |
| Super properties (`app_version`, `platform`, `arch`) | **Missing** | - |
| Groups on events (`groups`, `groupIdentify`) | **Missing** | - |
| Feature flags, experiments | **Missing** | - |
| Surveys | **Missing** (renderer SDK removed) | - |
| Saved dashboards, funnels, cohorts, alerts | **Missing from repo** (exist only ad hoc) | - |
| Error tracking in PostHog | **Off** (Sentry covers errors) | - |
| Session identifiers | **Missing** | - |
| Taxonomy ↔ PostHog sync check | **Missing** | - |

### 1.1 Relevant `posthog-node` capabilities (verify against the installed version before use)

Installed: `posthog-node@5.61.2`, `@posthog/core` (shared). Confirm each API against
`node_modules/posthog-node/dist/*.d.ts` before implementing; the list below is the intended
surface, not a guarantee.

- `capture({ distinctId, event, properties, groups, timestamp })`: per-event properties and group keys.
- `identify({ distinctId, properties: { $set, $set_once } })`: person properties.
- `groupIdentify({ groupType, groupKey, properties })`: group profiles.
- `getFeatureFlag` / `isFeatureEnabled` / `getAllFlags`: server-side flag evaluation.
  Local evaluation (no network per call) needs a personal API key, which must stay in main.
- `privacyMode` (already set): suppresses `$ai_input` / `$ai_output_choices` unless opted in.
- `enableExceptionAutocapture` / `captureException`: error tracking (currently removed).
- `shutdown()` / `flush()`: already wrapped by the adapter's `close()` / `flush()`.
- Super properties: **not a client feature in posthog-node**. Implement in the adapter by
  merging a registry into every `capture` call (see Phase 1.2).
- Sessions: `$session_id` passed as a property; the adapter manages its own session id.

---

## 2. Decisions

| # | Decision | Choice | Status |
| - | -------- | ------ | ------ |
| PD1 | Person model | Anonymous `distinctId` only (install id). No account, email, or name ever sent. | `[x]` decided (already in code) |
| PD2 | Person properties allowlist | `app_version`, `os`, `arch`, `locale`, `channel`, `hw_accel_available` (bool), `first_seen_version`. All coarse, no PII. | `[ ]` approved (Q3 yes); implementation in CP1 |
| PD3 | Super properties | `app_version`, `platform`, `arch`, `channel`, `mode` (`gui`/`cli`/`mcp`), `session_id`. Attached in the adapter, never in call sites. | `[ ]` |
| PD4 | Group types | `profile_kind` (built-in profile category), `hardware_class` (bucketed: `cpu`, `gpu_hw`, `gpu_sw`). Group keys are fixed enums, never user-defined names. | `[ ]` |
| PD5 | Remote flags transport | Main process only. Flag values cached on disk; offline default = the value compiled in. Startup request with 2 s timeout. | `[ ]` approved (Q2 yes); implementation in CP4 |
| PD6 | Local flag evaluation | **Not enabled** by default: it needs a personal API key in main. Revisit only if per-call flag latency matters. | `[x]` decided |
| PD7 | Renderer SDK (`posthog-js`) | Re-add for surveys (Q4 yes). Opt-in only, no autocapture, no session replay, no pageview capture, CSP limited to the PostHog host. | `[ ]` approved (Q4 yes); implementation in CP5 |
| PD8 | Error tracking | **Sentry stays the sole error tool** (Q5). PostHog error tracking is not enabled in the app. | `[x]` decided (Q5 keep Sentry) |
| PD9 | Session replay | **Excluded.** Screens show media names and paths; violates the zero-PII contract. | `[x]` decided |
| PD10 | Autocapture (clicks, pageviews) | **Excluded.** Captures element text and URLs. | `[x]` decided |
| PD11 | Dashboards as code | Exported JSON under `docs/analytics-dashboards/`, plus a README. The source of truth is the repo; PostHog is the rendering target. | `[ ]` |
| PD12 | Data warehouse export | **Out of scope.** Free tier includes only 1M warehouse rows via Sources and no alerts guarantee; revisit if usage grows. | `[-]` dropped for now |
| PD13 | Project topology | **One PostHog project** (free tier allows one project). Environments are separated by a `channel` super property (`dev` / `prod`), and dashboards filter to `channel = prod`. Replaces the two-project plan in task 0.4. | `[x]` decided (Q1 free tier) |
| PD14 | Quota behavior | Free tier drops events past 1M/month and returns default values for flags past the request quota. Client code must treat both as normal, not as errors. Track our own event volume so we notice before the cap. | `[x]` decided |

### Open decisions (owner input required)

| Q | Question | Answer | Effect on plan |
| - | -------- | ------ | -------------- |
| Q1 | Which PostHog plan tier? | **Free tier.** One project; 1M events/month; 1M flag requests/month; 5K replays; 100K exceptions; 1,500 survey responses; 100K AI events shared with evaluations; 10 GB logs; 1-year retention. Over-limit events are dropped; flags return defaults. | PD13, PD14. Task 0.4 replaced. Warehouse export dropped (PD12). Experiments are billed with flags, so they fit free tier. |
| Q2 | May the app make a flag request at startup? | **Yes.** | PD5 approved; CP4 unblocked. |
| Q3 | Are `os`, `arch`, `app_version`, `locale` on the person acceptable? | **Yes.** | PD2 approved; CP1 unblocked. |
| Q4 | Re-add `posthog-js` in the renderer for surveys? | **Yes.** | PD7 approved; CP5 renderer work unblocked under the PD7 constraints. |
| Q5 | Keep Sentry as sole error tool, or trial PostHog error tracking? | **Keep Sentry.** | PD8 decided. CP6 narrowed to AI observability and log review; error-tracking ADR is closed. |
| Q6 | File location for this plan | **Yes**: `plans/POSTHOG_PLAN.md`. | None. |

All open questions are answered. Remaining gates are sequencing, not decisions.

---

## 3. Phase Details

### Phase 0 - Baseline and governance groundwork (CP0)

- [x] **0.1** Snapshot the taxonomy: 120+ names, groups, and schema version recorded in
      `events.ts` (source of truth).
- [x] **0.2** Audit instrumentation: confirmed wiring for every event (AnalyticsWiring test).
- [x] **0.3** Record open decisions Q1–Q6 and default positions (this file, section 2).
- [x] **0.4** Project topology (replaces the two-project plan, PD13): keep **one** PostHog project
      on the free tier. Dev and prod are separated by the `channel` super property (Phase 1.2).
      Dashboards and cohorts filter `channel = prod`. Dev builds still send events, so the filter is
      mandatory on every saved insight (checked in CP7).
- [x] **0.5** Plan tier documented: **free** (Q1). Limits recorded in section 2 (Q1 row) and PD14.

### Phase 1 - Foundations (CP1)

**1.1 Person identity** (PD1, PD2)
- [x] Add `identify()` once per install, at init, with `$set` for mutable fields
      (`app_version`, `os`, `arch`, `locale`, `channel`, `hw_accel_available`) and
      `$set_once` for `first_seen_version`.
- [x] Re-identify on app version change and on locale change (not on every launch).
- [x] Add a `person_properties` allowlist in `src/shared/analytics/` so new fields need review.
- [x] Test: identify called once per boot, payload contains only allowlisted keys.

**1.2 Super properties** (PD3)
- [x] Add a registry in the main adapter: `registerSuperProperties({ app_version, platform, arch, channel, mode })`.
- [x] Merge the registry into every `capture` call. Event props override super props on collision
      only for keys in an explicit allowlist; otherwise the event wins and a debug log is emitted.
- [x] Set `mode` at startup from the entry point (`gui` / `cli` / `mcp`).
- [x] Test: every captured event carries the super properties; no duplicate keys.

**1.3 Sessions** (PD3)
- [x] Generate a `session_id` (UUID) per process; rotate after 30 minutes of inactivity.
- [x] Attach `$session_id` to every event via super properties.
- [x] Verify PostHog session grouping in the UI with a manual run.

**1.4 Release tracking**
- [x] On each version bump, send one `app_release` event with `app_version`, `channel`, `build_date`.
- [x] Add a PostHog annotation via the API from the release workflow (`.github/workflows`), using a
      personal key held in CI secrets only, never in the app.
- [x] Test: release workflow dry-run produces an annotation payload.

**1.5 Event hygiene**
- [x] Set `$process_person_profile: false` on high-volume events that do not need a person
      (for example `ui_error_shown` bursts, log events) to control cost.
- [x] Document the list in `docs/ANALYTICS.md`.

**CP1 exit gate:** persons show `app_version`, `os`, `arch`, `first_seen_version` in the UI; every
event carries super properties; one release annotation visible.

### Phase 2 - Saved analytics (CP2)

**2.1 Activation funnel** (saved insight)
- [ ] `app_launched` → `onboarding_started` → `onboarding_goal_selected` → `conversion_started` → `conversion_completed`.
- [ ] Breakdown by `mode` and `channel`. Window: 7 days.

**2.2 Retention**
- [ ] D1 / D7 / D30 retention on `app_launched`, cohort = `first_seen_version` week.
- [ ] Stickiness (WAU / MAU) on `app_launched`.

**2.3 Feature adoption trends**
- [ ] Unique users per event group (`convert`, `image`, `audio`, `cut`, `queue`, `mcp`) per week.
- [ ] Breakdown by `platform`.

**2.4 Reliability**
- [ ] Failure rate per tool: `*_failed` / `*_started` (conversion, remux, demux, compress, audio, cut).
- [ ] `ui_error_shown` count by route and error code (no free text).

**2.5 Batch health**
- [ ] `batch_queue_started` vs `batch_completed`; median and p90 of job duration buckets.
- [ ] Retry rate: `batch_job_retried` / `batch_job_*` total.

**2.6 Hardware and transcoder mix**
- [ ] Breakdown of `transcoder_changed`, `hwaccel_mode_changed`, `encoder_type_changed` by platform.

**2.7 Dashboards as code** (PD11)
- [ ] Create the five dashboards above in PostHog.
- [ ] Export each to `docs/analytics-dashboards/<name>.json` via the PostHog API (read-only personal key, run locally, not in CI).
- [ ] `docs/analytics-dashboards/README.md` lists each dashboard, its question, and its owner.

**CP2 exit gate:** five dashboards exist; JSON exports committed; README lists the question each one answers.

### Phase 3 - Group analytics and cohorts (CP3)

**3.1 Group types** (PD4)
- [ ] Define `profile_kind` and `hardware_class` as fixed enums in `src/shared/analytics/groups.ts`.
- [ ] `groupIdentify` once per process for each group value seen.
- [ ] Add `groups: { profile_kind }` to `conversion_started` and `batch_queue_started`.
- [ ] Add `groups: { hardware_class }` to `hw_accel_detected`.

**3.2 Cardinality guard**
- [ ] Unit test: group keys are members of the enum; anything else is dropped with a debug log.
- [ ] No file names, paths, or user-defined profile names may appear in group keys.

**3.3 Cohorts**
- [ ] Power users: ≥ 10 `conversion_completed` in the last 7 days.
- [ ] MCP users: `mcp_server_toggled` (on) at least once.
- [ ] Batch users: ≥ 3 `batch_queue_started` in 30 days.
- [ ] Churn-risk: active in weeks 1–2, zero `app_launched` in the last 14 days.
- [ ] Export cohort definitions to `docs/analytics-dashboards/cohorts.json`.

**CP3 exit gate:** group analytics show bounded group counts; cohorts saved and exported.

### Phase 4 - Feature flags (CP4)

Prerequisite: Q1 (plan tier) and Q2 (startup flag request) answered.

**4.1 Flag inventory**
- [ ] Define flags in `src/shared/analytics/flags.ts` with name, owner, default value, and removal date.
- [ ] Initial flags: `analytics_group_convert` (mirrors `ANALYTICS_GROUPS` remotely),
      `analytics_group_queue`, and one feature rollout (for example `mcp_server_default_on`).

**4.2 Main-process evaluation**
- [ ] Fetch flags once at startup with a 2-second timeout; cache to `userData/analytics-flags.json`.
- [ ] Precedence: environment override > cached remote value > compiled-in default.
- [ ] Renderer never evaluates flags; main passes resolved values through IPC if needed.
- [ ] Flag requests are sent only when consent is on.

**4.3 Group gate integration**
- [ ] `groupGate.ts` consults remote flags before emitting; `ANALYTICS_GROUPS` env remains the
      highest-priority offline override.
- [ ] Test: flag off → events dropped and no `capture` call; env override beats remote.

**4.4 Rollout**
- [ ] One feature rollout behind a flag, 10% → 50% → 100% over two releases, with the flag
      removed after 100%.

**CP4 exit gate:** a group can be disabled remotely with no release; offline start uses the cached/compiled default; tests cover all precedence paths.

### Phase 5 - Experiments and surveys (CP5)

Prerequisite: Q1 answered; Q4 answered before any renderer work.

**5.1 Experiment protocol**
- [ ] Pre-register the hypothesis, primary metric, guardrail metrics, and minimum detectable effect in `docs/analytics-experiments/<name>.md` before launch.
- [ ] Candidate experiments (choose one first): default output container in the convert form;
      dashboard card order; the copy of the empty batch-queue state. Use only categorical outcomes already in the taxonomy.

**5.2 Implementation**
- [ ] Assign variant via the flag system (CP4). Record `experiment_variant` as a super property for the experiment's lifetime only.
- [ ] Guardrail: stop the experiment if `conversion_failed` rate rises by more than 1 percentage point.

**5.3 Surveys** (requires PD7 / Q4)
- [ ] Decide whether `posthog-js` is re-added to the renderer. If yes:
      - opt-in only; no autocapture; no session replay; no pageview capture;
      - CSP updated for the PostHog host only (`connect-src`, `script-src` if the bundle is external);
      - survey triggers only after N successful `conversion_completed` events, once per install;
      - the survey response is categorical (rating, multiple choice). Free text is allowed only in the survey itself, opt-in, and never attached to analytics events.
- [ ] Alternative without `posthog-js`: a main-process window that submits via the surveys API. Evaluate against the renderer option before choosing.

**CP5 exit gate:** one experiment pre-registered and analyzed; one survey live (or the alternative documented as chosen) with consent and CSP verified.

### Phase 6 - Error tracking and AI observability (CP6)

**6.1 Error tracking decision (ADR)**
- [ ] Write `docs/adr/0001-error-tracking.md` comparing Sentry vs PostHog error tracking on: stack-trace quality, Electron support, cost, PII controls, and whether it duplicates Sentry.
- [-] ~~Trial PostHog error tracking~~ dropped: Q5 keeps Sentry as the sole error tool (PD8).
- [ ] If adopted: `enableExceptionAutocapture` stays off; use explicit `captureException` with sanitized messages and bucketed context only.

**6.2 AI observability expansion**
- [ ] Keep `$ai_generation` metadata-only by default; keep `POSTHOG_AI_CAPTURE_CONTENT` opt-in.
- [ ] Add `$ai_trace_id` grouping for one user action that makes several LLM calls (Copilot turns).
- [ ] Add span hierarchy for batch-level operations (`$ai_span` where the SDK supports it).
- [ ] Add latency and token-count dashboards for AI features by provider (`$ai_provider`).

**6.3 OTel logs review**
- [ ] Confirm the log pipeline's retention and cost in the PostHog UI.
- [ ] Emit structured job outcomes (`conversion_failed` with `error_code`, `transcoder`, bucketed duration) through OTel logs, not the event stream, if cost is acceptable.

**CP6 exit gate:** ADR merged; AI traces show multi-call grouping; log pipeline cost reviewed and recorded.

### Phase 7 - Governance and data quality (CP7)

**7.1 Taxonomy ↔ PostHog sync**
- [ ] Generate `docs/analytics-dashboards/data-schema.json` from `events.ts` (event name, group, payload keys, schema version).
- [ ] Use PostHog's data-schema / event definitions API to compare the repo against the project. Report drift; do not auto-write.
- [ ] Script: `npm run analytics:schema-check` (read-only; needs a read-only key, local only).

**7.2 CI guard**
- [ ] CI job runs the schema generator and fails when an event in `events.ts` has no dashboard reference, or a dashboard references an event no longer in `events.ts`.
- [ ] Unit test for the generator output shape (no network).

**7.3 Privacy review**
- [ ] `docs/analytics-privacy-checklist.md`: every new event or property must answer: categorical? no paths/names? no free text? bounded cardinality? consent-gated? group key from enum?
- [ ] PR template line referencing the checklist for any change under `src/shared/analytics/` or `src/main/analytics/`.

**7.4 Data retention and deletion**
- [ ] Document the retention period configured in the PostHog project.
- [ ] Document how a user's data is deleted on request (install id → person deletion via the PostHog API), and the procedure.

**CP7 exit gate:** schema-check runs locally; CI guard green on a deliberate drift test (then reverted); checklist in PR template.

---

## 4. Test Strategy

| Layer | What is tested | Tooling |
| ----- | -------------- | ------- |
| Unit (main) | identify payload allowlist, super-property merge, session rotation, flag precedence, group enum guard | Vitest, mocked `posthog-node` (existing pattern in `posthogMainProvider.test.ts`) |
| Unit (renderer) | relay only; no flag or key logic | Vitest (existing `posthogRendererProvider.test.ts`) |
| Contract | every `AnalyticsEventName` has wiring (existing), every dashboard references existing events (new, CP7) | Vitest |
| Live probe (manual) | real delivery to `encodex-dev` after each checkpoint | temporary probe test, deleted after run (pattern used in the 17:21 session) |
| Privacy | no path/name/free-text fields pass the sanitizer | property tests on `sanitizeAnalyticsProps` |

Each checkpoint must leave the full suite green (`npm test`), typecheck (`npm run typecheck:main`,
`npm run typecheck:renderer`), lint, and `npm run doc:drift`.

---

## 5. Risks and Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Dev events pollute prod project | Wrong metrics | Separate projects per channel (0.4); CI asserts token/project mapping |
| Flag request slows startup or fails offline | Startup delay, dead features | 2 s timeout, cached values, compiled-in defaults, tests for offline path |
| Cardinality explosion via groups or props | Cost, slow insights | Enum-only group keys (3.2); allowlists; `$process_person_profile: false` for noisy events |
| Survey or renderer SDK leaks content | Privacy breach | Opt-in, no autocapture, no replay, CSP scoped, no free text on analytics events |
| Personal API key leaks into app bundle | Account compromise | Keys only in CI secrets and local `.env` for scripts; never in `src/` or the built app; CI check greps the bundle |
| Taxonomy and dashboards drift | Misleading metrics | CP7 generator and CI guard |
| Duplicate error tooling | Cost and confusion | ADR before any PostHog error tracking (CP6) |
| `.env` duplicate keys silently override values | Analytics disabled (happened once) | Generators and runtime both use dotenv last-wins; startup warnings for invalid host (shipped) |

---

## 6. Progress Log

Append one line per completed item. Newest first.

| Date | Checkpoint | Item | Commit | Notes |
| ---- | ---------- | ---- | ------ | ----- |
| 2026-11-04 | CP0 | Owner answered Q1–Q6; plan updated (free tier, one project, Sentry kept, flags and surveys approved) | - | Tier limits checked on posthog.com/pricing |
| 2026-11-04 | CP0 | 0.1–0.5 done; plan created | - | Baseline verified in code |
| 2026-11-04 | - | Host misconfiguration surfaced; `.env` parsing aligned with dotenv | `8d425e35` | Root cause of "no events in PostHog" |
| 2026-11-04 | - | Full PostHog integration and AI observability | `e6ff6f8e` | Pushed to `fix/otel-posthog-compat` |

---

## 7. Definition of Done (per item)

- Code, tests, and docs changed together in one PR.
- Checkbox flipped to `[x]` in this file in the same PR, with a progress-log line.
- Privacy checklist answered for any event or property change (from CP7 onward; before that, by hand in the PR description).
- Verified in PostHog for any user-visible or dashboard item (screenshot or insight link in the PR).
