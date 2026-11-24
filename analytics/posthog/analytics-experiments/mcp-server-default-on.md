# MCP server default on — experiment pre-registration (draft)

- Status: Draft, not launched
- Experiment id: `629482`
- Experiment URL: `https://us.posthog.com/project/709196/experiments/629482`
- Experiment flag key: `mcp_server_default_on_experiment`
- Rollout-control flag key: `mcp_server_default_on` (id `1120337`)
- Current experiment rollout: `0%`
- Planned owner: EncodeX maintainers
- Created: 2026-11-23

The existing boolean rollout-control flag cannot back a multivariate experiment.
A dedicated two-variant flag (`control` / `test`, 50/50 at launch) was created
for the draft; the rollout-control flag remains unchanged.

## Hypothesis

New installs will reach first MCP use more often when the embedded MCP server
is enabled by default, without increasing setup failures or support load.

## Primary metric

`MCP enabled within 7 days`: the share of exposed users who emit
`mcp_server_toggled` with `enabled = true` within 7 days. Attached to experiment
`629482` as a funnel metric with `channel = prod` and test accounts excluded by
the experiment exposure criteria.

## Secondary metrics

Attached to experiment `629482`:

- `Conversion completed within 7 days` using `conversion_completed` with
  `channel = prod` as a conversion-rate guardrail.
- `UI error shown within 7 days` using `ui_error_shown` with `channel = prod` as
  an error-rate guardrail; lower is better.
- `Session length at quit` using the mean of `app_quit.sessionSec` with
  `channel = prod`.

Not attached because the events are not present in the live project schema:

- `mcp_port_committed` within 7 days.
- `mcp_connection_value_copied` within 7 days.

## Design

- Unit of randomization: install.
- Proposed minimum detectable effect: +5 percentage points in 7-day MCP
  activation; revise after the baseline conversion rate is confirmed.
- Bucketing has not been confirmed. Confirm identical bucketing across the
  dashboard, funnel, retention, and feature-flag analyses before launch.
- Audience: new installs only; exclude internal/test cohort `689593` and apply
  `filterTestAccounts: true` to every saved query.
- Environment: `channel = prod` for all product-event queries.
- Duration: at least two full weekly cycles after launch, unless a guardrail
  breach requires an early stop.
- Stop rules: sustained increase in setup failures, error rate, or support
  reports; privacy or consent incident; quota risk.

## Data quality constraints

- No free text, file paths, user names, prompts, completions, or customer
  content in event properties.
- Use categorical properties only.
- AI observability events do not carry `channel`; AI-based guardrails must use
  test-account filtering only and be labeled accordingly.

## Launch checklist

- Confirm the attached primary and secondary metrics still match the final
  audience and guardrail thresholds.
- Confirm bucketing and sample ratio mismatch checks.
- Confirm experiment setup context is available on the active PostHog
  connection; it is not enabled on the current MCP connection.
- Confirm final audience, duration, and guardrail thresholds with the owner.
- Launch the draft only after the checklist is complete.
