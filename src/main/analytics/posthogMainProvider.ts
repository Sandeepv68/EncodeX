/**
 * @fileoverview PostHog adapter for the main Electron process.
 *
 * This is the only module that constructs the PostHog client. Application
 * call sites continue to use the shared AnalyticsService facade, which routes
 * its typed events to this singleton adapter after startup.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';
import { logs, type Logger as OpenTelemetryLogger } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PostHog } from 'posthog-node';
import { Logger } from '../../shared/logger';
import {
  LOG_ANALYTICS_CLOSE_FAILED,
  LOG_ANALYTICS_EXCEPTION_CAPTURE_FAILED,
  LOG_ANALYTICS_INIT_FAILED,
  LOG_ANALYTICS_TRACK_FAILED,
} from '../../shared/log-constants';
import { ANALYTICS_EVENT_GROUP, type AnalyticsEvent } from '../../shared/analytics/events';
import { sanitizeAnalyticsProps, sanitizeExceptionContext } from '../../shared/analytics/sanitize';
import { filterPersonProperties } from '../../shared/analytics/personProperties';
import type { AiGeneration, AiSpan, AnalyticsConfig, AnalyticsExceptionContext, AnalyticsProvider } from '../../shared/analytics/types';
import type { LogEntry } from '../../shared/types';
import { logHub } from '../logs/log-hub';
import { resolveGroupGate } from './groupGate';
import { coerceProfileKind, coerceHardwareClass } from './groups';
import { FEATURE_FLAG_DEFAULTS } from './flags';

const log = new Logger('main/analytics/posthogMainProvider');

/** Events that do not need a person profile update (CP1.5). */
const NO_PERSON_PROFILE_EVENTS = new Set<string>(['ui_error_shown']);

const APP_LOG_BODY_MAX_LENGTH = 4000;

function sanitizeAppLogBody(value: string): string {
  return (
    value
      .replace(/[\r\n\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP_LOG_BODY_MAX_LENGTH) || '(empty log message)'
  );
}

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
  private seenGroups = new Set<string>();
  private flags: Record<string, boolean | string | number> = { ...FEATURE_FLAG_DEFAULTS };
  private flagsLoaded = false;
  private logsEnabled = true;
  private logObserverId: number | null = null;
  private exportingAppLog = false;
  private appLogAttributes: Record<string, string | number | boolean> = {};

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
        enableExceptionAutocapture: true,
        disableGeoip: false,
      });
      this.active = true;
      this.logsEnabled = config.posthogLogsEnabled !== false;
      this.appLogAttributes = {
        'app.version': config.appVersion ?? 'unknown',
        'app.channel': config.channel ?? 'unknown',
        'app.environment': config.environment ?? (config.channel === 'dev' ? 'development' : 'production'),
        posthogDistinctId: this.distinctId,
        sessionId: this.sessionId,
      };
      log.info('PostHog analytics active.', { host: phHost });

      // Load cached flags immediately so offline starts have values.
      this.loadCachedFlags();
      // Refresh flags from the server with a 2-second timeout (CP4).
      void this.refreshFlags();

      // Phase 1: super properties, person identity, and session.
      const superProps: Record<string, unknown> = {
        platform: process.platform,
        arch: process.arch,
        os_version: os.release(),
        electron_version: process.versions.electron,
        node_version: process.versions.node,
        $session_id: this.sessionId,
      };
      if (config.appVersion) superProps.app_version = config.appVersion;
      if (config.channel) superProps.channel = config.channel;
      if (config.mode) superProps.mode = config.mode;
      if (config.locale) superProps.locale = config.locale;
      if (config.environment) superProps.environment = config.environment;
      if (config.hwAccelAvailable !== undefined) superProps.hw_accel_available = config.hwAccelAvailable;
      this.superProperties = superProps;
      if (typeof this.client.register === 'function') {
        void this.client.register(superProps as Parameters<PostHog['register']>[0]);
      }

      this.identifyPerson(config);

      // Release tracking (Phase 1.4): one event per version bump. Guarded by a
      // marker file so it fires once per installed version, not every launch.
      this.trackReleaseOnce(config);

      try {
        const logUrl = new URL('/i/v1/logs', phHost).toString();
        this.logSdk = new NodeSDK({
          resource: resourceFromAttributes({
            'service.name': 'encodex-electron-main',
            'service.version': config.appVersion ?? 'unknown',
            'deployment.environment': config.environment ?? (config.channel === 'dev' ? 'development' : 'production'),
          }),
          logRecordProcessors: [
            new BatchLogRecordProcessor({
              exporter: new OTLPLogExporter({
                url: logUrl,
                headers: {
                  Authorization: `Bearer ${projectToken}`,
                },
              }),
            }),
          ],
        });
        this.logSdk.start();
        this.posthogLog = logs.getLogger('encodex.posthog.log-capture');
        this.emitPosthogLog({
          severityText: 'info',
          body: 'posthog_log_capture_started',
          attributes: { 'service.component': 'analytics' },
        });
        this.startAppLogCapture();
      } catch (err) {
        this.stopAppLogCapture();
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

  private emitPosthogLog(record: Parameters<OpenTelemetryLogger['emit']>[0]): void {
    if (!this.logsEnabled || !this.posthogLog) return;
    try {
      this.posthogLog.emit(record);
    } catch {}
  }

  private startAppLogCapture(): void {
    if (!this.active || !this.logsEnabled || !this.posthogLog || this.logObserverId !== null) return;
    this.logObserverId = logHub.addObserver((entry) => this.exportAppLog(entry));
  }

  private stopAppLogCapture(): void {
    if (this.logObserverId === null) return;
    logHub.removeObserver(this.logObserverId);
    this.logObserverId = null;
  }

  private exportAppLog(entry: LogEntry): void {
    if (!this.active || !this.logsEnabled || !this.posthogLog || this.exportingAppLog) return;
    this.exportingAppLog = true;
    try {
      this.posthogLog.emit({
        severityText: entry.level.toLowerCase(),
        body: sanitizeAppLogBody(entry.text),
        attributes: {
          ...this.appLogAttributes,
          'log.source': entry.source,
          'log.seq': entry.seq ?? -1,
          'log.timestamp': entry.timestamp,
        },
      });
    } catch (err) {
      log.debug('PostHog app log export failed:', err);
    } finally {
      this.exportingAppLog = false;
    }
  }

  track(event: AnalyticsEvent): void {
    if (!this.active || !this.client) return;
    const group = ANALYTICS_EVENT_GROUP[event.name];
    if (this.groupGate && !this.groupGate.has(group)) {
      log.debug('analytics group gated off:', event.name);
      return;
    }
    const flagName = `analytics_group_${group}`;
    if (this.isFeatureFlagEnabled(flagName) === false) {
      log.debug('analytics group flagged off:', event.name);
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
      if (event.name === 'page_viewed') {
        this.capturePageView(sanitized);
      } else {
        const properties: Record<string, unknown> = {
          ...this.superProperties,
          ...sanitized,
          environment: this.superProperties.environment,
        };
        if (NO_PERSON_PROFILE_EVENTS.has(event.name)) {
          properties.$process_person_profile = false;
        }

        // Group analytics (CP3): attach bounded group keys and identify groups
        // the first time they are seen.
        const groups: Record<string, string> = {};
        const profileCategory = typeof sanitized.category === 'string' ? sanitized.category : undefined;
        if (event.name === 'profile_applied' || event.name === 'batch_profile_applied') {
          const kind = coerceProfileKind(profileCategory);
          groups.profile_kind = kind;
          this.identifyGroupOnce('profile_kind', kind, { category: kind });
        }
        if (event.name === 'hw_accel_detected' || typeof sanitized.hwAccel === 'boolean') {
          const hwAccel = typeof sanitized.hwAccel === 'boolean' ? sanitized.hwAccel : this.superProperties.hw_accel_available === true;
          const hwClass = coerceHardwareClass(hwAccel);
          groups.hardware_class = hwClass;
          this.identifyGroupOnce('hardware_class', hwClass, { hw_accel: hwClass });
        }

        this.client.capture({
          distinctId: this.distinctId,
          event: event.name,
          properties,
          ...(Object.keys(groups).length > 0 ? { groups } : {}),
        });
      }
      this.emitPosthogLog({
        severityText: 'info',
        body: 'posthog_product_event_forwarded',
        attributes: { 'analytics.event_name': event.name },
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  private capturePageView(properties: Record<string, string | number | boolean>): void {
    if (!this.client) return;
    const path = typeof properties.path === 'string' && properties.path.startsWith('/') ? properties.path : '/';
    const viewProperties: Record<string, unknown> = {
      ...this.superProperties,
      ...properties,
      $current_url: `electron://encodex${path}`,
      $pathname: path,
      $host: 'encodex.app',
      $screen_name: path,
      $browser: 'Electron',
      $device_type: 'Desktop',
      $os: process.platform,
    };
    this.client.capture({ distinctId: this.distinctId, event: '$pageview', properties: viewProperties });
    this.client.capture({ distinctId: this.distinctId, event: '$screen', properties: viewProperties });
  }

  /**
   * Calls `groupIdentify` once per (groupType, groupKey) pair so group profiles
   * are created without spamming the API on every event.
   */
  private identifyGroupOnce(groupType: string, groupKey: string, properties: Record<string, unknown>): void {
    if (!this.client || typeof this.client.groupIdentify !== 'function') return;
    const cacheKey = `${groupType}:${groupKey}`;
    if (this.seenGroups.has(cacheKey)) return;
    this.seenGroups.add(cacheKey);
    try {
      this.client.groupIdentify({ groupType, groupKey, properties });
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
    try {
      const personProperties: Record<string, unknown> = {};
      if (config.appVersion) personProperties.app_version = config.appVersion;
      if (config.channel) personProperties.channel = config.channel;
      if (config.locale) personProperties.locale = config.locale;
      if (config.environment) personProperties.environment = config.environment;
      if (config.hwAccelAvailable !== undefined) personProperties.hw_accel_available = config.hwAccelAvailable;
      personProperties.os = process.platform;
      personProperties.arch = process.arch;
      personProperties.os_version = os.release();
      personProperties.electron_version = process.versions.electron;
      personProperties.node_version = process.versions.node;
      if (config.mode) personProperties.mode = config.mode;
      const filtered = filterPersonProperties(personProperties);
      this.client.capture({
        distinctId: this.distinctId,
        event: '$identify',
        properties: {
          ...this.superProperties,
          $set: filtered,
          $set_once: { first_seen_version: config.appVersion },
        },
      });
      this.identified = true;
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  isFeatureFlagEnabled(flag: string): boolean | undefined {
    if (!this.active) return undefined;
    const value = this.flags[flag];
    if (typeof value === 'boolean') return value;
    return FEATURE_FLAG_DEFAULTS[flag];
  }

  getAllFeatureFlags(): Record<string, boolean | string | number> | undefined {
    if (!this.active) return undefined;
    return { ...this.flags };
  }

  /**
   * Loads cached flag values from disk so offline starts have values.
   */
  private loadCachedFlags(): void {
    try {
      const cachePath = path.join(app.getPath('userData'), 'analytics-flags.json');
      const raw = fs.readFileSync(cachePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
          this.flags[key] = value;
        }
      }
    } catch {
      // No cache yet: defaults remain.
    }
  }

  /**
   * Refreshes flags from the server with a 2-second timeout. Failures keep
   * the cached/compiled defaults.
   */
  private async refreshFlags(): Promise<void> {
    if (!this.client || typeof this.client.getAllFlags !== 'function') return;
    try {
      const client = this.client;
      const result = await Promise.race([
        (async () => {
          const allFlags = await client.getAllFlags(this.distinctId);
          const exposures: Record<string, boolean | string | number> = {};
          if (typeof client.getFeatureFlag === 'function') {
            await Promise.all(
              Object.keys(FEATURE_FLAG_DEFAULTS).map(async (key) => {
                const value = await client.getFeatureFlag(key, this.distinctId, { sendFeatureFlagEvents: true });
                if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
                  exposures[key] = value;
                }
              }),
            );
          }
          return { ...allFlags, ...exposures };
        })(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2000)),
      ]);
      if (result && typeof result === 'object') {
        for (const [key, value] of Object.entries(result)) {
          if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
            this.flags[key] = value;
          }
        }
        try {
          const cachePath = path.join(app.getPath('userData'), 'analytics-flags.json');
          fs.writeFileSync(cachePath, JSON.stringify(this.flags), 'utf8');
        } catch {
          // Non-fatal.
        }
      }
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }
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
          ...this.superProperties,
          $ai_trace_id: generation.traceId,
          $ai_session_id: this.distinctId,
          ...(generation.spanId ? { $ai_span_id: generation.spanId, $ai_span_name: 'llm_generation' } : {}),
          ...(generation.parentSpanId ? { $ai_parent_id: generation.parentSpanId } : {}),
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
      this.emitPosthogLog({
        severityText: generation.isError ? 'error' : 'info',
        body: 'posthog_ai_generation_forwarded',
        attributes: { 'ai.provider': generation.provider, 'ai.is_error': generation.isError === true },
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  captureAiSpan(span: AiSpan): void {
    if (!this.active || !this.client) return;
    try {
      this.client.capture({
        distinctId: this.distinctId,
        event: '$ai_span',
        properties: {
          ...this.superProperties,
          $ai_trace_id: span.traceId,
          $ai_session_id: this.distinctId,
          $ai_span_id: span.spanId,
          $ai_span_name: span.name,
          ...(span.parentSpanId ? { $ai_parent_id: span.parentSpanId } : {}),
          $ai_latency: span.latency,
          ...(span.isError ? { $ai_is_error: true } : {}),
        },
      });
      this.emitPosthogLog({
        severityText: span.isError ? 'error' : 'info',
        body: 'posthog_ai_span_forwarded',
        attributes: { 'ai.span_name': span.name, 'ai.is_error': span.isError === true },
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  captureException(error: unknown, context?: AnalyticsExceptionContext): void {
    if (!this.active || !this.client || typeof this.client.captureException !== 'function') return;
    try {
      const properties: Record<string, string | number | boolean> = {};
      const sanitized = sanitizeExceptionContext(context);
      if (sanitized?.tags) {
        for (const [key, value] of Object.entries(sanitized.tags)) properties[`error_tag.${key}`] = value;
      }
      if (sanitized?.extra) {
        for (const [key, value] of Object.entries(sanitized.extra)) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            properties[`error_extra.${key}`] = value;
          }
        }
      }
      this.client.captureException(error, this.distinctId, properties);
    } catch (err) {
      log.debug(LOG_ANALYTICS_EXCEPTION_CAPTURE_FAILED, err);
    }
  }

  setEnabled(enabled: boolean): void {
    const next = enabled && this.client !== null;
    if (next === this.active) return;
    this.active = next;
    if (next) this.startAppLogCapture();
    else this.stopAppLogCapture();
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
      this.stopAppLogCapture();
      await this.client?.shutdown();
      this.emitPosthogLog({ severityText: 'info', body: 'posthog_log_capture_stopping' });
      await this.logSdk?.shutdown();
      this.client = null;
      this.logSdk = null;
      this.posthogLog = null;
      this.active = false;
      this.logsEnabled = false;
      return true;
    } catch (err) {
      log.warn(LOG_ANALYTICS_CLOSE_FAILED, err);
      return false;
    }
  }
}
