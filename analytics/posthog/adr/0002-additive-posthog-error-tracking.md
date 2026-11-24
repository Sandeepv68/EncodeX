# ADR-0002: Additive PostHog error tracking

- Status: Accepted
- Date: 2026-11-23
- Owners: EncodeX maintainers
- Supersedes: [ADR-0001](0001-error-tracking-sentry-only.md)

## Context

ADR-0001 rejected PostHog error tracking because the project's privacy baseline
was categorical-only and Sentry was already the dedicated error tool. That
decision is reversed for a narrow, explicit exception: error triage needs raw
exception messages and stack traces, which cannot be represented by the closed
event taxonomy.

The existing single consent switch already covers both analytics and error
reporting. Product analytics events remain categorical-only; only exception
capture is allowed to carry bounded free text.

## Decision

Sentry remains the primary error-monitoring backend. PostHog captures
exceptions additively through the existing analytics facade when telemetry
consent is on and a PostHog backend is configured. The desktop app uses the
same consent switch for Sentry and PostHog exception capture.

PostHog error tracking is implemented in three places:

- Main process: `posthog-node` runs with `enableExceptionAutocapture: true`, and
  `MonitoringService.captureException` fans out to
  `AnalyticsService.captureAnalyticsException` when the active analytics
  provider is enabled. Node SDK exception dedupe prevents a duplicate event for
  an explicitly captured error in the same turn.
- Renderer: the renderer does not load a `posthog-js` exception autocapture
  plugin. Errors are serialized, sanitized, and relayed over
  `IPC.ANALYTICS_CAPTURE_EXCEPTION` to the main-process provider.
- Marketing site: the VitePress snippet enables `capture_exceptions` for
  unhandled errors and unhandled rejections. Console error capture and session
  replay remain off.

## Privacy boundaries

The analytics event taxonomy is unchanged: `$exception` is not a product
analytics event and is not part of `events.ts` or the schema snapshot.

Exception messages and stacks are intentionally allowed because they are the
payload needed for debugging. They may contain paths, symbols, or free text, so
docs and privacy review must treat them as an explicit exception to the
categorical-only rule.

The structured context is sanitized separately:

- primitive values only;
- keys containing `file`, `path`, `url`, `uri`, `email`, `user`, `message`,
  `query`, or `stack` are dropped;
- values containing `/`, `\`, `@`, or line breaks are dropped;
- objects, empty strings, and overlong values are dropped or bounded;
- at most 25 exceptions are buffered before analytics initialization and are
  dropped when consent is off.

Capture calls never throw into application code. Disabling telemetry clears the
pre-init buffer and stops future fan-out.

## Non-goals

- Desktop session replay, autocapture, heatmaps, and pageviews stay off.
- No user identity is attached to exception events.
- No new environment variable is introduced; PostHog exceptions reuse
  `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`.
- No Sentry configuration or capture path is removed.

## Consequences

PostHog now has a second error signal alongside Sentry, with one consent switch
and no renderer credential. The free plan's exception allowance is documented
with the other quotas. Stack traces are readable only when production source
maps are uploaded, which is a separate release concern.

The main residual risk is undetected duplication if the Node SDK changes its
dedupe behavior. The explicit capture path and sanitized context are unit
tested; live confirmation of a single `$exception` per error is still required.
