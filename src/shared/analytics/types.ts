/**
 * @fileoverview Provider-agnostic product-analytics contracts for the application.
 *
 * These types define the "port" of a ports-and-adapters design for usage
 * analytics. Application code depends only on the {@link AnalyticsProvider}
 * interface (via the `analyticsService` facade in `AnalyticsService.ts`) and
 * never on a concrete backend such as Aptabase. Swapping backends means
 * implementing this interface once and registering it with the provider
 * factory - no call sites change.
 *
 * The contract mirrors the monitoring contracts in
 * `src/shared/monitoring/types.ts`: adapters are defensive (never throw),
 * consent is enforced centrally by the facade, and everything that crosses
 * process boundaries stays JSON-serializable.
 */

import { ANALYTICS_SCHEMA_VERSION } from './events';

/**
 * State exposed to the renderer about the analytics subsystem.
 */
export interface AnalyticsState {
  /** Whether usage analytics are consented/enabled for this installation. */
  enabled: boolean;
  /** Active backend adapter name in main ('aptabase' | 'noop'), so the
   *  renderer initializes its matching counterpart or stays idle. */
  backend: string;
}

/**
 * Configuration accepted by {@link AnalyticsProvider.init}. Providers ignore
 * fields they do not understand so new options can be added without breaking
 * existing adapters.
 */
export interface AnalyticsConfig {
  /**
   * Explicit provider selection ('aptabase' | 'noop' today). When omitted the
   * host factory auto-detects from other config (e.g. App Key presence).
   */
  provider?: string;
  /** Backend project key (`A-{US|EU|DEV|SH}-...` for Aptabase). Absent
   *  usually means "disabled". Kept main-process only by design - the
   *  renderer never receives it. */
  appKey?: string;
  /** Custom ingest endpoint; required only for self-hosted (`A-SH-*`) keys. */
  host?: string;
  /** Master switch reflecting user consent. Providers must respect it. */
  enabled: boolean;
  /** Environment label, e.g. 'development' | 'production'. */
  environment?: string;
  /** Release identifier, typically the app version. */
  release?: string;
  /** Verbose SDK diagnostics for local debugging. */
  debug?: boolean;
}

/**
 * The contract every analytics backend adapter must implement.
 *
 * Implementations MUST be defensive: they are invoked from application paths
 * that must never crash, so adapters must not throw. The facade also guards
 * calls, but adapters should uphold the same guarantee themselves.
 */
export interface AnalyticsProvider {
  /** Identifier of this adapter, e.g. 'noop' or 'aptabase'. */
  readonly name: string;

  /**
   * Initializes the backend. Called once at application startup (per process)
   * before any {@link track} calls are expected to work.
   * @param {AnalyticsConfig} config - Resolved configuration incl. consent.
   */
  init(config: AnalyticsConfig): void | Promise<void>;

  /**
   * Records a single, already-taxonomy-validated event.
   * @param {AnalyticsEvent} event - A typed event (see `events.ts`).
   */
  track(event: AnalyticsEvent): void | Promise<void>;

  /**
   * Enables/disables recording at runtime (user consent toggle). Disabling
   * must stop ALL future tracks, including any buffered internal events.
   * @param {boolean} enabled - Whether recording should occur.
   */
  setEnabled(enabled: boolean): void | Promise<void>;

  /**
   * @returns {boolean} Whether the provider is initialized and accepting events.
   */
  isEnabled(): boolean;

  /**
   * Flushes queued/buffered events within the timeout.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when everything was sent in time.
   */
  flush?(timeoutMs?: number): Promise<boolean>;

  /**
   * Shuts the backend down, draining pending events first. After close the
   * provider may be re-initialized via {@link init}.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when shutdown completed cleanly.
   */
  close?(timeoutMs?: number): Promise<boolean>;
}

/**
 * Factory that resolves the concrete provider for a given configuration.
 * Returning `undefined`/`null` selects the no-op fallback.
 * @param {AnalyticsConfig} config - Resolved startup configuration.
 * @returns {AnalyticsProvider | undefined | null} The adapter to activate.
 */
export type AnalyticsProviderFactory = (config: AnalyticsConfig) => AnalyticsProvider | undefined | null;

/**
 * Rollout tier of an event: 'v1' = launch cut, 'v2' = gated follow-up.
 * @typedef {('v1' | 'v2')} AnalyticsTier
 */
export type AnalyticsTier = 'v1' | 'v2';

/**
 * Functional group every event belongs to. Used by the per-group emission
 * gate (`ANALYTICS_GROUPS`, D10) so a noisy group can be disabled without a
 * release.
 * @typedef {('lifecycle'|'onboarding'|'nav'|'convert'|'image'|'audio'|'cut'|'queue'|'profiles'|'settings'|'mcp'|'updates'|'hw'|'cli'|'ux')} AnalyticsGroup
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
  | 'remux_started'
  | 'remux_completed'
  | 'remux_failed'
  | 'demux_started'
  | 'demux_completed'
  | 'demux_failed'
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
  | 'logs_search_changed'
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
export type OnboardingGoal = 'convert' | 'compress' | 'extract' | 'trim' | 'remux' | 'copilot';

/** Source disambiguator shared by input-selection events (D9). */
export type InputSource = 'dialog' | 'drop' | 'folder';

/** Execution mode: GUI renderer vs CLI. */
export type ExecutionMode = 'gui' | 'cli';

/** Stream kinds a demux target can extract or convert. */
export type DemuxTargetKind = 'video' | 'audio' | 'subtitle';

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
    hasVideoFilters?: boolean;
    filterCount?: number;
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
    hasVideoFilters?: boolean;
    filterCount?: number;
    durationSec?: number;
    speedX?: number;
    mode?: ExecutionMode;
  };
  conversion_failed: { jobKind: 'single' | 'batch'; transcoder: string; hwAccel?: boolean; code?: string; mode?: ExecutionMode };
  remux_started: {
    container: string;
    streamCount: number;
    addedSubs: number;
    addedAudio: number;
    hasThumbnail: boolean;
    hasChapters: boolean;
    hasAudioSync: boolean;
  };
  remux_completed: {
    container: string;
    streamCount: number;
    addedSubs: number;
    addedAudio: number;
    hasThumbnail: boolean;
    hasChapters: boolean;
    hasAudioSync: boolean;
    durationSec?: number;
  };
  remux_failed: {
    container: string;
    code?: string;
  };
  demux_started: {
    kindCounts: Partial<Record<DemuxTargetKind, number>>;
    streamCount: number;
    convertedKinds: DemuxTargetKind[];
  };
  demux_completed: {
    kindCounts: Partial<Record<DemuxTargetKind, number>>;
    streamCount: number;
    convertedKinds: DemuxTargetKind[];
    durationSec?: number;
  };
  demux_failed: {
    kindCounts: Partial<Record<DemuxTargetKind, number>>;
    streamCount: number;
    convertedKinds: DemuxTargetKind[];
    code?: string;
  };
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
  logs_search_changed: { queryLength: number };
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
 * Categorical analytics payload shared by the `remux_started`,
 * `remux_completed`, and `remux_failed` events.
 * @interface RemuxAnalyticsSummary
 * @property {string} container - Target container extension.
 * @property {number} streamCount - Number of `-map` specs copied from the source.
 * @property {number} addedSubs - Number of added subtitle inputs.
 * @property {number} addedAudio - Number of added audio inputs.
 * @property {boolean} hasThumbnail - Whether cover art is being muxed.
 * @property {boolean} hasChapters - Whether chapters are being copied/muxed.
 * @property {boolean} hasAudioSync - Whether any audio timeline shift is applied.
 */
export interface RemuxAnalyticsSummary {
  container: string;
  streamCount: number;
  addedSubs: number;
  addedAudio: number;
  hasThumbnail: boolean;
  hasChapters: boolean;
  hasAudioSync: boolean;
}

/**
 * Categorical analytics payload shared by the `demux_started`,
 * `demux_completed`, and `demux_failed` events.
 * @interface DemuxAnalyticsSummary
 * @property {Partial<Record<DemuxTargetKind, number>>} kindCounts - Extracted stream count per kind.
 * @property {number} streamCount - Total number of extraction targets.
 * @property {DemuxTargetKind[]} convertedKinds - Kinds that are re-encoded rather than stream-copied.
 */
export interface DemuxAnalyticsSummary {
  kindCounts: Partial<Record<DemuxTargetKind, number>>;
  streamCount: number;
  convertedKinds: DemuxTargetKind[];
}

/**
 * Context a caller supplies alongside the built remux options, for the facts
 * that only the caller knows (they are not part of `ConversionOptions`).
 * @interface RemuxAnalyticsContext
 * @property {string} [container] - Target container extension of the remux.
 * @property {string} [input] - Primary source path, used to keep the audio-sync
 *   "re-read" entry (which repeats that path) out of the added-audio count.
 */
export interface RemuxAnalyticsContext {
  container?: string;
  input?: string;
}
