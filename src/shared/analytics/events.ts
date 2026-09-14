/**
 * @fileoverview Typed, versioned product-analytics event taxonomy.
 *
 * Defines every product event the application may emit, together with its
 * payload shape. The taxonomy is the single source of truth for the download →
 * install → first launch → first conversion → success → repeat funnel defined
 * in `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md` (Checkpoint 10).
 *
 * Privacy contract (non-negotiable):
 *  - NO payload field below may contain personal data, file paths, file names,
 *    or User-Agent-style identifiers. Everything is categorical: how many, what
 *    kind, which mode. If a task needs a path to be useful, it does NOT belong
 *    in analytics (put it in a breadcrumb/logger instead).
 *  - Events are only delivered through a consent-gated channel (the monitoring
 *    facade), so a "telemetry off" user emits nothing.
 *  - The schema version is attached to every event so future ingest pipelines
 *    can migrate payloads without guessing.
 */

/** Bumped whenever a payload shape below changes incompatibly. @const {number} */
export const ANALYTICS_SCHEMA_VERSION = 1 as const;

/** Every product event the app can emit today. Audit before adding. */
export type AnalyticsEventName =
  | 'app_installed'
  | 'app_launched'
  | 'onboarding_started'
  | 'onboarding_goal_selected'
  | 'conversion_started'
  | 'conversion_completed'
  | 'conversion_failed'
  | 'batch_completed'
  | 'profile_applied'
  | 'hw_accel_detected'
  | 'cli_invoked'
  | 'update_available'
  | 'telemetry_opt_in'
  | 'telemetry_opt_out';

/** Categorical goals offered by the first-run onboarding card. */
export type OnboardingGoal = 'convert' | 'compress' | 'extract' | 'trim';

/** Payload for each event. All fields MUST stay categorical (see privacy contract). */
export interface AnalyticsEventPayloadMap {
  app_installed: { version: string; platform: string; arch: string };
  app_launched: { version: string; platform: string; arch: string };
  onboarding_started: { version: string };
  onboarding_goal_selected: { goal: OnboardingGoal };
  conversion_started: { jobKind: 'single' | 'batch'; transcoder: string; hwAccel: boolean };
  conversion_completed: { jobKind: 'single' | 'batch'; transcoder: string; hwAccel: boolean };
  conversion_failed: { jobKind: 'single' | 'batch'; transcoder: string; code?: string };
  batch_completed: { completed: number; failed: number };
  profile_applied: { profileId: string };
  hw_accel_detected: { mode: string; encoderType: string };
  cli_invoked: { version: string; platform: string; arch: string; subcommand?: string };
  update_available: { version: string; newVersion: string };
  telemetry_opt_in: { version: string };
  telemetry_opt_out: { version: string };
}

/** Discriminated shape of a single analytics event. @template K - Event name. */
export type AnalyticsEvent<K extends AnalyticsEventName = AnalyticsEventName> = {
  /** Schema version of the payload shape (see {@link ANALYTICS_SCHEMA_VERSION}). */
  schema: typeof ANALYTICS_SCHEMA_VERSION;
  /** Stable event name (dot-free, snake_case). */
  name: K;
  /** Categorical payload for this event. */
  props: AnalyticsEventPayloadMap[K];
};

/**
 * Builds a typed analytics event. Compile-time guaranteed to match the
 * taxonomy; prefer this over hand-casting at call sites.
 * @template K - Literal event name.
 * @param {K} name - The event to record.
 * @param {AnalyticsEventPayloadMap[K]} props - Categorical payload.
 * @returns {AnalyticsEvent<K>} The fully-typed event.
 */
export function createAnalyticsEvent<K extends AnalyticsEventName>(name: K, props: AnalyticsEventPayloadMap[K]): AnalyticsEvent<K> {
  return { schema: ANALYTICS_SCHEMA_VERSION, name, props };
}
