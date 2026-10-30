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

/**
 * In-memory shape of the consent file.
 */
export interface MonitoringConsentFile {
  /** Whether the user consents to error reporting. */
  enabled: boolean;
}

/**
 * Minimal structural type of the `@sentry/electron/main` module surface the
 * Sentry adapter uses. Declaring it here keeps the adapter file free of a
 * static import (the real module is loaded lazily) while still giving type
 * safety.
 */
export interface SentryMainSdk {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, hint?: Record<string, unknown>): string | undefined;
  captureMessage(message: string, level?: string, hint?: Record<string, unknown>): string | undefined;
  captureFeedback(feedback: { message: string; name?: string; email?: string }, hint?: Record<string, unknown>): string | undefined;
  setTag(key: string, value: string): void;
  setUser(user: Record<string, unknown> | null): void;
  addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  /**
   * Renderer ANR detection: captures App Not Responding events from renderer
   * processes (the main-process `anrIntegration` is not part of the Electron
   * SDK's supported surface in v7).
   */
  rendererEventLoopBlockIntegration(options?: { captureNativeStacktrace?: boolean }): Record<string, unknown>;
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
}
