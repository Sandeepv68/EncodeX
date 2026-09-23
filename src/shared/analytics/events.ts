/**
 * @fileoverview Typed, versioned product-analytics event taxonomy.
 *
 * Defines every product event the application may emit, together with its
 * payload shape. The taxonomy is the single source of truth for the download ->
 * install -> first launch -> first conversion -> success -> repeat funnel
 * defined in `plans/APTABASE_ANALYTICS_PLAN.md` (§4, 16 user journeys J1-J16).
 *
 * Privacy contract (non-negotiable):
 *  - NO payload field below may contain personal data, file paths, file names,
 *    or User-Agent-style identifiers. Everything is categorical: how many,
 *    what kind, which mode. If a task needs a path to be useful, it does NOT
 *    belong in analytics (put it in a breadcrumb/logger instead).
 *  - Events are only delivered through a consent-gated channel (the analytics
 *    facade), so a "telemetry off" user emits nothing.
 *  - The schema version is attached to every event so future ingest pipelines
 *    can migrate payloads without guessing.
 *  - Every event carries its functional {@link AnalyticsGroup} (for the D10
 *    per-group `ANALYTICS_GROUPS` emission gate) and its rollout
 *    {@link AnalyticsTier} ('v1' launch cut, 'v2' gated follow-up).
 */

/** Bumped whenever a payload shape below changes incompatibly. @const {number} */
export const ANALYTICS_SCHEMA_VERSION = 2 as const;

/** Rollout tier of an event: 'v1' = launch cut, 'v2' = gated follow-up. */
export type AnalyticsTier = 'v1' | 'v2';

/**
 * Functional group every event belongs to. Used by the per-group emission
 * gate (`ANALYTICS_GROUPS`, D10) so a noisy group can be disabled without a
 * release.
 */
export type AnalyticsGroup =
  | 'lifecycle'
  | 'onboarding'
  | 'nav'
  | 'convert'
  | 'image'
  | 'audio'
  | 'cut'
  | 'queue'
  | 'profiles'
  | 'settings'
  | 'mcp'
  | 'updates'
  | 'hw'
  | 'cli'
  | 'ux';

/** Every product event the app can emit. Audit before adding. */
export type AnalyticsEventName =
  | 'app_installed'
  | 'app_launched'
  | 'app_quit'
  | 'window_maximize_toggled'
  | 'window_close_requested'
  | 'window_close_deferred'
  | 'terms_accepted'
  | 'terms_rejected'
  | 'onboarding_started'
  | 'onboarding_goal_selected'
  | 'onboarding_dismissed'
  | 'dashboard_card_clicked'
  | 'dashboard_shortcut_used'
  | 'tool_opened'
  | 'locale_changed'
  | 'convert_input_selected'
  | 'convert_output_selected'
  | 'suggested_extension_applied'
  | 'codec_changed'
  | 'preview_opened'
  | 'conversion_started'
  | 'conversion_paused'
  | 'conversion_resumed'
  | 'conversion_cancelled'
  | 'conversion_completed'
  | 'conversion_failed'
  | 'copy_mode_toggled'
  | 'transcoder_changed'
  | 'preview_closed'
  | 'convert_form_cleared'
  | 'compress_input_selected'
  | 'compress_format_changed'
  | 'compress_started'
  | 'compress_completed'
  | 'compress_failed'
  | 'audio_input_selected'
  | 'audio_codec_changed'
  | 'audio_extract_started'
  | 'audio_extract_paused'
  | 'audio_extract_resumed'
  | 'audio_extract_cancelled'
  | 'audio_extract_completed'
  | 'audio_extract_failed'
  | 'cut_input_selected'
  | 'cut_use_duration_toggled'
  | 'video_cut_started'
  | 'video_cut_paused'
  | 'video_cut_resumed'
  | 'video_cut_cancelled'
  | 'video_cut_completed'
  | 'video_cut_failed'
  | 'cut_audio_toggled'
  | 'timeline_zoom_changed'
  | 'media_playback_toggled'
  | 'video_cut_form_cleared'
  | 'batch_files_added'
  | 'batch_review_confirmed'
  | 'batch_operation_changed'
  | 'batch_concurrency_changed'
  | 'batch_profile_applied'
  | 'batch_queue_started'
  | 'batch_queue_paused'
  | 'batch_queue_resumed'
  | 'batch_queue_cancelled_all'
  | 'batch_clear_completed'
  | 'batch_job_retried'
  | 'batch_job_removed'
  | 'batch_completed'
  | 'batch_job_reordered'
  | 'batch_job_options_edited'
  | 'batch_job_reveal_in_folder'
  | 'batch_job_path_copied'
  | 'batch_export'
  | 'batch_import'
  | 'batch_condense_toggled'
  | 'batch_filter_changed'
  | 'media_info_probed'
  | 'logs_filter_changed'
  | 'logs_cleared'
  | 'logs_exported'
  | 'profile_applied'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_deleted'
  | 'profile_reset'
  | 'theme_changed'
  | 'telemetry_opt_in'
  | 'telemetry_opt_out'
  | 'hwaccel_toggled'
  | 'hwaccel_mode_changed'
  | 'encoder_type_changed'
  | 'always_on_top_toggled'
  | 'launch_at_login_toggled'
  | 'mcp_server_toggled'
  | 'mcp_port_committed'
  | 'mcp_token_generated'
  | 'mcp_token_cleared'
  | 'mcp_connection_value_copied'
  | 'update_check_triggered'
  | 'update_dialog_opened'
  | 'update_available'
  | 'update_download_started'
  | 'update_downloaded'
  | 'update_install_now'
  | 'update_install_on_restart'
  | 'update_download_cancelled'
  | 'update_restart_install_cancelled'
  | 'update_release_notes_opened'
  | 'update_retry'
  | 'update_installed'
  | 'hw_accel_detected'
  | 'cli_invoked'
  | 'cli_completed'
  | 'ui_error_shown';

/** Categorical goals offered by the first-run onboarding card. */
export type OnboardingGoal = 'convert' | 'compress' | 'extract' | 'trim';

/** Source disambiguator shared by input-selection events (D9). */
export type InputSource = 'dialog' | 'drop' | 'folder';

/** Execution mode: GUI renderer vs CLI. */
export type ExecutionMode = 'gui' | 'cli';

/** Payload for each event. All fields MUST stay categorical (see privacy contract). */
export interface AnalyticsEventPayloadMap {
  app_installed: { version: string; platform: string; arch: string };
  app_launched: { version: string; platform: string; arch: string };
  app_quit: { sessionSec: number; crashDuringSession: boolean };
  window_maximize_toggled: { maximized: boolean };
  window_close_requested: Record<string, never>;
  window_close_deferred: { reason: 'pending' };

  terms_accepted: Record<string, never>;
  terms_rejected: Record<string, never>;
  onboarding_started: { version: string };
  onboarding_goal_selected: { goal: OnboardingGoal };
  onboarding_dismissed: { version: string };
  dashboard_card_clicked: { route: string };
  dashboard_shortcut_used: { shortcutId: string };

  tool_opened: { route: string };
  locale_changed: { language: string; rtl: boolean };

  convert_input_selected: { source: InputSource };
  convert_output_selected: Record<string, never>;
  suggested_extension_applied: { codec: string };
  codec_changed: { codecType: 'video' | 'audio'; codec: string };
  preview_opened: Record<string, never>;
  conversion_started: {
    jobKind: 'single' | 'batch';
    transcoder: string;
    hwAccel: boolean;
    copyMode?: boolean;
    presetClass?: string;
    container?: string;
    mode?: ExecutionMode;
  };
  conversion_paused: Record<string, never>;
  conversion_resumed: Record<string, never>;
  conversion_cancelled: { jobKind: 'single' | 'batch' };
  conversion_completed: {
    jobKind: 'single' | 'batch';
    transcoder: string;
    hwAccel: boolean;
    presetClass?: string;
    container?: string;
    durationSec?: number;
    speedX?: number;
    mode?: ExecutionMode;
  };
  conversion_failed: { jobKind: 'single' | 'batch'; transcoder: string; hwAccel?: boolean; code?: string; mode?: ExecutionMode };
  copy_mode_toggled: { copyMode: boolean };
  transcoder_changed: { transcoder: string };
  preview_closed: Record<string, never>;
  convert_form_cleared: Record<string, never>;

  compress_input_selected: { source: InputSource };
  compress_format_changed: { format: string };
  compress_started: { format: string; qualityBand: string; scaleApplied: boolean };
  compress_completed: { format: string; savedPercent: number };
  compress_failed: { format: string; code?: string };

  audio_input_selected: { source: InputSource };
  audio_codec_changed: { codec: string };
  audio_extract_started: { codec: string };
  audio_extract_paused: Record<string, never>;
  audio_extract_resumed: Record<string, never>;
  audio_extract_cancelled: Record<string, never>;
  audio_extract_completed: { codec: string; durationSec: number };
  audio_extract_failed: { codec: string; code?: string };

  cut_input_selected: { source: InputSource };
  cut_use_duration_toggled: { useDuration: boolean };
  video_cut_started: { useDuration: boolean; includeAudio: boolean; trimSecBucket: string };
  video_cut_paused: Record<string, never>;
  video_cut_resumed: Record<string, never>;
  video_cut_cancelled: Record<string, never>;
  video_cut_completed: { useDuration: boolean; includeAudio: boolean; durationSec: number };
  video_cut_failed: { code?: string; trimSecBucket: string };
  cut_audio_toggled: { includeAudio: boolean };
  timeline_zoom_changed: { direction: 'in' | 'out' };
  media_playback_toggled: { playing: boolean };
  video_cut_form_cleared: Record<string, never>;

  batch_files_added: { source: InputSource; count: number };
  batch_review_confirmed: { count: number };
  batch_operation_changed: { operation: string };
  batch_concurrency_changed: { concurrency: number };
  batch_profile_applied: { profileId: string };
  batch_queue_started: { jobCount: number; operationMix: string; concurrency: number };
  batch_queue_paused: Record<string, never>;
  batch_queue_resumed: Record<string, never>;
  batch_queue_cancelled_all: { count: number };
  batch_clear_completed: { count: number };
  batch_job_retried: { operation: string };
  batch_job_removed: { status: string };
  batch_completed: { completed: number; failed: number };
  batch_job_reordered: { movedBy: number };
  batch_job_options_edited: { operation: string };
  batch_job_reveal_in_folder: Record<string, never>;
  batch_job_path_copied: Record<string, never>;
  batch_export: { count: number };
  batch_import: { count: number };
  batch_condense_toggled: { condensed: boolean };
  batch_filter_changed: { filter: 'all' | 'queued' | 'running' | 'done' | 'failed' };

  media_info_probed: { kind: 'video' | 'image'; streamCountBucket: string; hasExif: boolean };
  logs_filter_changed: { level: string };
  logs_cleared: Record<string, never>;
  logs_exported: { entryCount: number };

  profile_applied: { profileId: string; category: string };
  profile_created: { category: string; advanced: boolean };
  profile_updated: { category: string };
  profile_deleted: { category: string; custom: boolean };
  profile_reset: { category: string };

  theme_changed: { themeId: string };
  telemetry_opt_in: { version: string };
  telemetry_opt_out: { version: string };
  hwaccel_toggled: { enabled: boolean };
  hwaccel_mode_changed: { mode: string };
  encoder_type_changed: { encoderType: string };
  always_on_top_toggled: { enabled: boolean };
  launch_at_login_toggled: { enabled: boolean };

  mcp_server_toggled: { enabled: boolean };
  mcp_port_committed: { isDefaultPort: boolean };
  mcp_token_generated: Record<string, never>;
  mcp_token_cleared: Record<string, never>;
  mcp_connection_value_copied: { valueType: 'token' | 'endpoint' | 'authorization' };

  update_check_triggered: { source: string };
  update_dialog_opened: { source: string };
  update_available: { version: string; newVersion: string };
  update_download_started: Record<string, never>;
  update_downloaded: { version: string; newVersion: string };
  update_install_now: Record<string, never>;
  update_install_on_restart: Record<string, never>;
  update_download_cancelled: Record<string, never>;
  update_restart_install_cancelled: Record<string, never>;
  update_release_notes_opened: Record<string, never>;
  update_retry: Record<string, never>;
  update_installed: { version: string; newVersion: string };

  hw_accel_detected: { mode: string; encoderType: string };
  cli_invoked: { version: string; platform: string; arch: string; subcommand?: string; hwAccel?: boolean };
  cli_completed: { subcommand?: string; outcome: 'ok' | 'error'; durationSec: number };
  ui_error_shown: { category: string };
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
 * Maps every event name to its functional group. Kept on the taxonomy so the
 * per-group emission gate can never drift from the events.
 * @const {Record<AnalyticsEventName, AnalyticsGroup>}
 */
export const ANALYTICS_EVENT_GROUP: Record<AnalyticsEventName, AnalyticsGroup> = {
  app_installed: 'lifecycle',
  app_launched: 'lifecycle',
  app_quit: 'lifecycle',
  window_maximize_toggled: 'ux',
  window_close_requested: 'ux',
  window_close_deferred: 'ux',
  terms_accepted: 'onboarding',
  terms_rejected: 'onboarding',
  onboarding_started: 'onboarding',
  onboarding_goal_selected: 'onboarding',
  onboarding_dismissed: 'onboarding',
  dashboard_card_clicked: 'nav',
  dashboard_shortcut_used: 'nav',
  tool_opened: 'nav',
  locale_changed: 'nav',
  convert_input_selected: 'convert',
  convert_output_selected: 'convert',
  suggested_extension_applied: 'convert',
  codec_changed: 'convert',
  preview_opened: 'convert',
  conversion_started: 'convert',
  conversion_paused: 'convert',
  conversion_resumed: 'convert',
  conversion_cancelled: 'convert',
  conversion_completed: 'convert',
  conversion_failed: 'convert',
  copy_mode_toggled: 'convert',
  transcoder_changed: 'convert',
  preview_closed: 'convert',
  convert_form_cleared: 'convert',
  compress_input_selected: 'image',
  compress_format_changed: 'image',
  compress_started: 'image',
  compress_completed: 'image',
  compress_failed: 'image',
  audio_input_selected: 'audio',
  audio_codec_changed: 'audio',
  audio_extract_started: 'audio',
  audio_extract_paused: 'audio',
  audio_extract_resumed: 'audio',
  audio_extract_cancelled: 'audio',
  audio_extract_completed: 'audio',
  audio_extract_failed: 'audio',
  cut_input_selected: 'cut',
  cut_use_duration_toggled: 'cut',
  video_cut_started: 'cut',
  video_cut_paused: 'cut',
  video_cut_resumed: 'cut',
  video_cut_cancelled: 'cut',
  video_cut_completed: 'cut',
  video_cut_failed: 'cut',
  cut_audio_toggled: 'cut',
  timeline_zoom_changed: 'cut',
  media_playback_toggled: 'cut',
  video_cut_form_cleared: 'cut',
  batch_files_added: 'queue',
  batch_review_confirmed: 'queue',
  batch_operation_changed: 'queue',
  batch_concurrency_changed: 'queue',
  batch_profile_applied: 'queue',
  batch_queue_started: 'queue',
  batch_queue_paused: 'queue',
  batch_queue_resumed: 'queue',
  batch_queue_cancelled_all: 'queue',
  batch_clear_completed: 'queue',
  batch_job_retried: 'queue',
  batch_job_removed: 'queue',
  batch_completed: 'queue',
  batch_job_reordered: 'queue',
  batch_job_options_edited: 'queue',
  batch_job_reveal_in_folder: 'queue',
  batch_job_path_copied: 'queue',
  batch_export: 'queue',
  batch_import: 'queue',
  batch_condense_toggled: 'queue',
  batch_filter_changed: 'queue',
  media_info_probed: 'ux',
  logs_filter_changed: 'ux',
  logs_cleared: 'ux',
  logs_exported: 'ux',
  profile_applied: 'profiles',
  profile_created: 'profiles',
  profile_updated: 'profiles',
  profile_deleted: 'profiles',
  profile_reset: 'profiles',
  theme_changed: 'settings',
  telemetry_opt_in: 'settings',
  telemetry_opt_out: 'settings',
  hwaccel_toggled: 'settings',
  hwaccel_mode_changed: 'settings',
  encoder_type_changed: 'settings',
  always_on_top_toggled: 'settings',
  launch_at_login_toggled: 'settings',
  mcp_server_toggled: 'mcp',
  mcp_port_committed: 'mcp',
  mcp_token_generated: 'mcp',
  mcp_token_cleared: 'mcp',
  mcp_connection_value_copied: 'mcp',
  update_check_triggered: 'updates',
  update_dialog_opened: 'updates',
  update_available: 'updates',
  update_download_started: 'updates',
  update_downloaded: 'updates',
  update_install_now: 'updates',
  update_install_on_restart: 'updates',
  update_download_cancelled: 'updates',
  update_restart_install_cancelled: 'updates',
  update_release_notes_opened: 'updates',
  update_retry: 'updates',
  update_installed: 'updates',
  hw_accel_detected: 'hw',
  cli_invoked: 'cli',
  cli_completed: 'cli',
  ui_error_shown: 'ux',
};

/**
 * Rollout tier of every event ('v1' launch cut vs 'v2' gated follow-up, D10).
 * @const {Record<AnalyticsEventName, AnalyticsTier>}
 */
export const ANALYTICS_EVENT_TIER: Record<AnalyticsEventName, AnalyticsTier> = {
  app_installed: 'v1',
  app_launched: 'v1',
  app_quit: 'v2',
  window_maximize_toggled: 'v2',
  window_close_requested: 'v2',
  window_close_deferred: 'v2',
  terms_accepted: 'v1',
  terms_rejected: 'v1',
  onboarding_started: 'v1',
  onboarding_goal_selected: 'v1',
  onboarding_dismissed: 'v2',
  dashboard_card_clicked: 'v2',
  dashboard_shortcut_used: 'v2',
  tool_opened: 'v1',
  locale_changed: 'v1',
  convert_input_selected: 'v1',
  convert_output_selected: 'v1',
  suggested_extension_applied: 'v1',
  codec_changed: 'v1',
  preview_opened: 'v1',
  conversion_started: 'v1',
  conversion_paused: 'v1',
  conversion_resumed: 'v1',
  conversion_cancelled: 'v1',
  conversion_completed: 'v1',
  conversion_failed: 'v1',
  copy_mode_toggled: 'v2',
  transcoder_changed: 'v2',
  preview_closed: 'v2',
  convert_form_cleared: 'v2',
  compress_input_selected: 'v1',
  compress_format_changed: 'v1',
  compress_started: 'v1',
  compress_completed: 'v1',
  compress_failed: 'v1',
  audio_input_selected: 'v1',
  audio_codec_changed: 'v1',
  audio_extract_started: 'v1',
  audio_extract_paused: 'v2',
  audio_extract_resumed: 'v2',
  audio_extract_cancelled: 'v2',
  audio_extract_completed: 'v1',
  audio_extract_failed: 'v1',
  cut_input_selected: 'v1',
  cut_use_duration_toggled: 'v1',
  video_cut_started: 'v1',
  video_cut_paused: 'v1',
  video_cut_resumed: 'v1',
  video_cut_cancelled: 'v1',
  video_cut_completed: 'v1',
  video_cut_failed: 'v1',
  cut_audio_toggled: 'v2',
  timeline_zoom_changed: 'v2',
  media_playback_toggled: 'v2',
  video_cut_form_cleared: 'v2',
  batch_files_added: 'v1',
  batch_review_confirmed: 'v1',
  batch_operation_changed: 'v1',
  batch_concurrency_changed: 'v1',
  batch_profile_applied: 'v1',
  batch_queue_started: 'v1',
  batch_queue_paused: 'v1',
  batch_queue_resumed: 'v1',
  batch_queue_cancelled_all: 'v1',
  batch_clear_completed: 'v1',
  batch_job_retried: 'v1',
  batch_job_removed: 'v1',
  batch_completed: 'v1',
  batch_job_reordered: 'v2',
  batch_job_options_edited: 'v2',
  batch_job_reveal_in_folder: 'v2',
  batch_job_path_copied: 'v2',
  batch_export: 'v2',
  batch_import: 'v2',
  batch_condense_toggled: 'v2',
  batch_filter_changed: 'v2',
  media_info_probed: 'v1',
  logs_filter_changed: 'v2',
  logs_cleared: 'v2',
  logs_exported: 'v2',
  profile_applied: 'v1',
  profile_created: 'v1',
  profile_updated: 'v1',
  profile_deleted: 'v1',
  profile_reset: 'v2',
  theme_changed: 'v1',
  telemetry_opt_in: 'v1',
  telemetry_opt_out: 'v1',
  hwaccel_toggled: 'v1',
  hwaccel_mode_changed: 'v1',
  encoder_type_changed: 'v1',
  always_on_top_toggled: 'v2',
  launch_at_login_toggled: 'v2',
  mcp_server_toggled: 'v2',
  mcp_port_committed: 'v2',
  mcp_token_generated: 'v2',
  mcp_token_cleared: 'v2',
  mcp_connection_value_copied: 'v2',
  update_check_triggered: 'v1',
  update_dialog_opened: 'v1',
  update_available: 'v1',
  update_download_started: 'v1',
  update_downloaded: 'v1',
  update_install_now: 'v1',
  update_install_on_restart: 'v1',
  update_download_cancelled: 'v2',
  update_restart_install_cancelled: 'v2',
  update_release_notes_opened: 'v2',
  update_retry: 'v2',
  update_installed: 'v2',
  hw_accel_detected: 'v1',
  cli_invoked: 'v1',
  cli_completed: 'v2',
  ui_error_shown: 'v2',
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
