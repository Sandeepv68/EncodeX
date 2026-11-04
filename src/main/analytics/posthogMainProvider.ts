/**
 * @fileoverview PostHog adapter for the main Electron process.
 *
 * This is the only module that constructs the PostHog client. Application
 * call sites continue to use the shared AnalyticsService facade, which routes
 * its typed events to this singleton adapter after startup.
 */

import { randomUUID } from 'crypto';
import { logs, type Logger as OpenTelemetryLogger } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PostHog } from 'posthog-node';
import { Logger } from '../../shared/logger';
import { LOG_ANALYTICS_CLOSE_FAILED, LOG_ANALYTICS_INIT_FAILED, LOG_ANALYTICS_TRACK_FAILED } from '../../shared/log-constants';
import type { AnalyticsEvent } from '../../shared/analytics/events';
import type { AiGeneration, AnalyticsConfig, AnalyticsProvider } from '../../shared/analytics/types';

const log = new Logger('main/analytics/posthogMainProvider');

/** PostHog-backed analytics provider for the long-lived Electron main process. */
export class PostHogMainProvider implements AnalyticsProvider {
  readonly name = 'posthog';

  private client: PostHog | null = null;
  private logSdk: NodeSDK | null = null;
  private posthogLog: OpenTelemetryLogger | null = null;
  private active = false;
  private readonly distinctId = `encodex-session-${randomUUID()}`;

  /** Manual AI captures include prompt/completion content unless explicitly protected. */
  private get aiPrivacyMode(): boolean {
    return process.env.POSTHOG_AI_PRIVACY_MODE === 'true';
  }

  async init(config: AnalyticsConfig): Promise<void> {
    try {
      const projectToken = config.projectToken ?? process.env.POSTHOG_PROJECT_TOKEN;
      if (!config.enabled || !projectToken) return;
      const phHost = config.host ?? process.env.POSTHOG_HOST;
      if (!phHost || typeof phHost !== 'string') return;
      try { new URL(phHost); } catch (e) { return; }
      this.client = new PostHog(projectToken, {
        host: phHost,
        enableExceptionAutocapture: true,
        privacyMode: this.aiPrivacyMode,
      });
      this.active = true;

      const host = config.host ?? process.env.POSTHOG_HOST;
      if (!host || typeof host !== 'string') return;
      try {
        let logUrl;
        try {
          logUrl = new URL('/i/v1/logs', host).toString();
        } catch (e) {
          return;
        }
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
    try {
      this.client.capture({
        distinctId: this.distinctId,
        event: event.name,
        properties: event.props,
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
   * Captures the result of an existing custom LLM transport as an AI
   * Observability generation using the same anonymous main-process identity.
   */
  captureAiGeneration(generation: AiGeneration): void {
    if (!this.active || !this.client) return;
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
          ...(this.aiPrivacyMode
            ? {}
            : {
                $ai_input: generation.input,
                ...(generation.output !== undefined ? { $ai_output_choices: [{ role: 'assistant', content: generation.output }] } : {}),
              }),
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
