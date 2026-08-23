/**
 * @fileoverview Types shared by the main-process monitoring modules.
 */

/**
 * State exposed to the renderer about monitoring.
 */
export interface MonitoringState {
  /** Whether error reporting is consented/enabled for this installation. */
  enabled: boolean;
  /** Active backend adapter name in main ('sentry' | 'noop'), so the
   *  renderer initializes its matching counterpart or stays idle. */
  backend: string;
}
