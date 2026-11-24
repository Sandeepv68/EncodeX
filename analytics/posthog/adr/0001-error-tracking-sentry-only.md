# ADR-0001: Error tracking stays Sentry-only

- Status: Superseded by [ADR-0002](0002-additive-posthog-error-tracking.md)
- Date: 2026-11-23
- Owners: EncodeX maintainers

> This ADR is retained as the original decision record. The Sentry-only
> constraint was explicitly reversed on 2026-11-23; see ADR-0002 for the current
> decision.

## Context

EncodeX already uses Sentry for error monitoring and has a single consent switch
that covers both analytics and error reporting. PostHog is used for product
analytics, AI observability, surveys, logs, and feature flags.

Enabling PostHog error tracking as a second error pipeline would duplicate
issues, split triage, and create a second retention surface for stack traces and
breadcrumbs. The two systems also have different payload shapes and privacy
review paths.

## Decision

Use Sentry as the only error-tracking destination. Do not enable PostHog error
tracking ingestion for this project.

PostHog `logs` remains available as a separate diagnostic surface for explicit
application log records (for example high-severity log lines), not as a stack
trace or exception replacement. `$exception` and error-tracking events are out
of scope unless a new ADR explicitly reverses this decision.

## Consequences

- Error triage stays in Sentry; no duplicate issue streams.
- Privacy review for exceptions stays with the existing Sentry path.
- EncodeX keeps one consent switch: the same toggle controls analytics,
  surveys, and Sentry monitoring.
- Any future PostHog error-tracking rollout requires a new ADR, a privacy
  checklist review, and confirmation of retention/deletion behavior.
