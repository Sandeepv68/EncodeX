/**
 * @fileoverview PostHog adapter for the main Electron process.
 *
 * This is the only module that constructs the PostHog client. Application
 * call sites continue to use the shared AnalyticsService facade, which routes
 * its typed events to this singleton adapter after startup.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logs, type Logger as OpenTelemetryLogger } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PostHog } from 'posthog-node';
import { Logger } from '../../shared/logger';
import { LOG_ANALYTICS_CLOSE_FAILED, LOG_ANALYTICS_INIT_FAILED, LOG_ANALYTICS_TRACK_FAILED } from '../../shared/log-constants';
import { ANALYTICS_EVENT_GROUP, type AnalyticsEvent } from '../../shared/analytics/events';
import { sanitizeAnalyticsProps } from '../../shared/analytics/sanitize';
import { filterPersonProperties } from '../../shared/analytics/personProperties';
import type { AiGeneration, AnalyticsConfig, AnalyticsProvider } from '../../shared/analytics/types';
import { resolveGroupGate } from './groupGate';

const log = new Logger('main/analytics/posthogMainProvider');

/** Events that do not need a person profile update (CP1.5). */
const NO_PERSON_PROFILE_EVENTS = new Set<string>(['ui_error_shown']);

/** PostHog-backed analytics provider for the long-lived Electron main process. */
export class PostHogMainProvider implements AnalyticsProvider {
  readonly name = 'posthog';

  private client: PostHog | null = null;
  private logSdk: NodeSDK | null = null;
  private posthogLog: OpenTelemetryLogger | null = null;
  private active = false;
  private distinctId = `encodex-session-${randomUUID()}`;
  private groupGate: Set<string> | null = null;
  private superProperties: Record<string, unknown> = {};
  private sessionId = randomUUID();
  private lastActivity = Date.now();
  private identified = false;
  private firstSeenVersion: string | null = null;

  /**
   * AI prompt/completion content is only sent when the operator explicitly
   * opts in. The default is metadata-only to uphold the zero-PII contract.
   */
  private get aiContentCaptureEnabled(): boolean {
    return process.env.POSTHOG_AI_CAPTURE_CONTENT === 'true';
  }

  async init(config: AnalyticsConfig): Promise<void> {
    try {
      if (!config.enabled) return;
      const projectToken = config.projectToken ?? process.env.POSTHOG_PROJECT_TOKEN;
      if (!projectToken) {
        log.warn('PostHog analytics inactive: no project token (POSTHOG_PROJECT_TOKEN).');
        return;
      }
      const phHost = config.posthogHost ?? process.env.POSTHOG_HOST;
      if (!phHost || typeof phHost !== 'string') {
        log.warn('PostHog analytics inactive: POSTHOG_HOST is not set.');
        return;
      }
      try {
        new URL(phHost);
      } catch (e) {
        // A bare project id (e.g. "12345") lands here; the SDK would then try
        // to fetch an invalid URL and fail silently on every event.
        log.warn('PostHog analytics inactive: POSTHOG_HOST is not a valid URL.', phHost);
        return;
      }
      this.distinctId = config.installId ?? this.distinctId;
      this.groupGate = resolveGroupGate();
      this.client = new PostHog(projectToken, {
        host: phHost,
        privacyMode: !this.aiContentCaptureEnabled,
      });
      this.active = true;
      log.info('PostHog analytics active.', { host: phHost });

      // Phase 1: super properties, person identity, and session.
      const superProps: Record<string, unknown> = {
        platform: process.platform,
        arch: process.arch,
        $session_id: this.sessionId,
      };
      if (config.appVersion) superProps.app_version = config.appVersion;
      if (config.channel) superProps.channel = config.channel;
      if (config.mode) superProps.mode = config.mode;
      if (config.locale) superProps.locale = config.locale;
      if (config.hwAccelAvailable !== undefined) superProps.hw_accel_available = config.hwAccelAvailable;
      this.superProperties = superProps;

      this.identifyPerson(config);

      // Release tracking (Phase 1.4): one event per version bump. Guarded by a
      // marker file so it fires once per installed version, not every launch.
      this.trackReleaseOnce(config);

      try {
        const logUrl = new URL('/i/v1/logs', phHost).toString();
        this.logSdk = new NodeSDK({
          resource: resourceFromAttributes({ 'service.name': 'encodex-electron-main' }),
          logRecordProcessors: [
            new BatchLogRecordProcessor({
              exporter: new OTLPLogExporter({
                url: logUrl,
                headers: { Authorization: `Bearer ${projectToken}` },
              }),
            }),
          ],
        });
        this.logSdk.start();
        this.posthogLog = logs.getLogger('encodex.posthog.log-capture');
        try {
          this.posthogLog.emit({
            severityText: 'info',
            body: 'posthog_log_capture_started',
            attributes: { 'service.component': 'analytics' },
          });
        } catch (e) {}
      } catch (err) {
        this.logSdk = null;
        this.posthogLog = null;
        log.warn('PostHog log capture initialization failed:', err);
      }
    } catch (err) {
      log.error(LOG_ANALYTICS_INIT_FAILED, err);
      this.active = false;
    }
  }

  isEnabled(): boolean {
    return this.active;
  }

  track(event: AnalyticsEvent): void {
    if (!this.active || !this.client) return;
    if (this.groupGate && !this.groupGate.has(ANALYTICS_EVENT_GROUP[event.name])) {
      log.debug('analytics group gated off:', event.name);
      return;
    }
    // Session rotation: 30 minutes of inactivity starts a new session.
    if (Date.now() - this.lastActivity > 30 * 60 * 1000) {
      this.sessionId = randomUUID();
      this.superProperties.$session_id = this.sessionId;
    }
    this.lastActivity = Date.now();
    try {
      const sanitized = sanitizeAnalyticsProps(event.props) ?? {};
      const properties: Record<string, unknown> = {
        ...this.superProperties,
        ...sanitized,
      };
      if (NO_PERSON_PROFILE_EVENTS.has(event.name)) {
        properties.$process_person_profile = false;
      }
      this.client.capture({
        distinctId: this.distinctId,
        event: event.name,
        properties,
      });
      this.posthogLog?.emit({
        severityText: 'info',
        body: 'posthog_product_event_forwarded',
        attributes: { 'analytics.event_name': event.name },
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Sends `identify` once per install with coarse, non-PII person properties.
   * `$set` overwrites mutable fields; `$set_once` records the first-seen version.
   */
  private identifyPerson(config: AnalyticsConfig): void {
    if (!this.client || this.identified) return;
    if (typeof this.client.identify !== 'function') return;
    try {
      const personProperties: Record<string, unknown> = {};
      if (config.appVersion) personProperties.app_version = config.appVersion;
      if (config.channel) personProperties.channel = config.channel;
      if (config.locale) personProperties.locale = config.locale;
      if (config.hwAccelAvailable !== undefined) personProperties.hw_accel_available = config.hwAccelAvailable;
      personProperties.os = process.platform;
      personProperties.arch = process.arch;
      if (config.mode) personProperties.mode = config.mode;
      const filtered = filterPersonProperties(personProperties);
      this.client.identify({
        distinctId: this.distinctId,
        properties: {
          $set: filtered,
          $set_once: { first_seen_version: config.appVersion },
        },
      });
      this.identified = true;
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Emits `app_release` once per installed version, guarded by a marker file in
   * userData so it fires on first run of a version rather than every launch.
   */
  private trackReleaseOnce(config: AnalyticsConfig): void {
    if (!this.client || !config.appVersion) return;
    try {
      const markerPath = path.join(app.getPath('userData'), 'analytics-release-marker.json');
      let previous: string | null = null;
      try {
        previous = JSON.parse(fs.readFileSync(markerPath, 'utf8')).version ?? null;
      } catch {
        previous = null;
      }
      if (previous === config.appVersion) return;
      this.client.capture({
        distinctId: this.distinctId,
        event: 'app_release',
        properties: { ...this.superProperties, app_version: config.appVersion },
      });
      try {
        fs.writeFileSync(markerPath, JSON.stringify({ version: config.appVersion }), 'utf8');
      } catch {
        // Non-fatal: next launch will re-emit.
      }
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Captures the result of an existing custom LLM transport as an AI
   * Observability generation using the same anonymous main-process identity.
   * Prompt/completion content is withheld unless `POSTHOG_AI_CAPTURE_CONTENT`
   * is explicitly enabled; metadata is always sent.
   */
  captureAiGeneration(generation: AiGeneration): void {
    if (!this.active || !this.client) return;
    const captureContent = this.aiContentCaptureEnabled;
    try {
      this.client.capture({
        distinctId: this.distinctId,
        event: '$ai_generation',
        properties: {
          $ai_trace_id: generation.traceId,
          $ai_session_id: this.distinctId,
          $ai_model: generation.model,
          $ai_provider: generation.provider,
          $ai_latency: generation.latency,
          ...(generation.inputTokens !== undefined ? { $ai_input_tokens: generation.inputTokens } : {}),
          ...(generation.outputTokens !== undefined ? { $ai_output_tokens: generation.outputTokens } : {}),
          ...(generation.isError ? { $ai_is_error: true } : {}),
          ...(captureContent
            ? {
                $ai_input: generation.input,
                ...(generation.output !== undefined ? { $ai_output_choices: [{ role: 'assistant', content: generation.output }] } : {}),
              }
            : {}),
        },
      });
      this.posthogLog?.emit({
        severityText: generation.isError ? 'error' : 'info',
        body: 'posthog_ai_generation_forwarded',
        attributes: { 'ai.provider': generation.provider, 'ai.is_error': generation.isError === true },
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  setEnabled(enabled: boolean): void {
    this.active = enabled && this.client !== null;
  }

  async flush(): Promise<boolean> {
    try {
      await this.client?.flush();
      return true;
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
      return false;
    }
  }

  async close(): Promise<boolean> {
    try {
      await this.client?.shutdown();
      this.posthogLog?.emit({ severityText: 'info', body: 'posthog_log_capture_stopping' });
      await this.logSdk?.shutdown();
      this.client = null;
      this.logSdk = null;
      this.posthogLog = null;
      this.active = false;
      return true;
    } catch (err) {
      log.warn(LOG_ANALYTICS_CLOSE_FAILED, err);
      return false;
    }
  }
}
