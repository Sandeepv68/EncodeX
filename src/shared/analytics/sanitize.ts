/**
 * @fileoverview Shared defense-in-depth sanitizer for analytics event props.
 *
 * The event taxonomy already constrains payloads to categorical values, but
 * adapters independently reduce props to the primitive shapes their SDKs
 * accept. Keeping the rule in one place guarantees every backend applies the
 * same contract: strings (non-empty), numbers, and booleans survive; anything
 * else is dropped.
 */

import type { AnalyticsExceptionContext, AnalyticsExceptionPayload } from './types';

const EXCEPTION_VALUE_MAX_LENGTH = 200;
const EXCEPTION_NAME_MAX_LENGTH = 100;
const EXCEPTION_MESSAGE_MAX_LENGTH = 1000;
const EXCEPTION_STACK_MAX_LENGTH = 8000;
const SENSITIVE_EXCEPTION_KEY = /(file|path|url|uri|email|user|message|query|stack)/i;

/**
 * Reduces raw taxonomy props to the primitive shape analytics SDKs accept.
 * @param {Record<string, unknown>} props - Raw event props.
 * @returns {Record<string, string | number | boolean> | undefined} Sanitized
 *   props, or undefined when every value was dropped.
 */
export function sanitizeAnalyticsProps(props: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (value.length > 0) out[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function truncateExceptionString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function isSafeExceptionContextValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= EXCEPTION_VALUE_MAX_LENGTH && !/[\/@\\\r\n]/.test(trimmed);
}

function sanitizeExceptionContextRecord(record: unknown): Record<string, string | number | boolean> | undefined {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_EXCEPTION_KEY.test(key) || !isSafeExceptionContextValue(value)) continue;
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return truncateExceptionString(trimmed, maxLength);
}

export function sanitizeExceptionContext(context?: AnalyticsExceptionContext): AnalyticsExceptionContext | undefined {
  if (!context) return undefined;
  const tags = sanitizeExceptionContextRecord(context.tags);
  const extra = sanitizeExceptionContextRecord(context.extra);
  if (!tags && !extra) return undefined;
  return {
    ...(tags ? { tags } : {}),
    ...(extra ? { extra } : {}),
  };
}

export function createAnalyticsExceptionPayload(error: unknown, context?: AnalyticsExceptionContext): AnalyticsExceptionPayload {
  const payload: AnalyticsExceptionPayload = {};
  if (error instanceof Error) {
    const name = readBoundedString(error.name, EXCEPTION_NAME_MAX_LENGTH);
    const message = readBoundedString(error.message, EXCEPTION_MESSAGE_MAX_LENGTH);
    const stack = readBoundedString(error.stack ?? '', EXCEPTION_STACK_MAX_LENGTH);
    if (name) payload.name = name;
    if (message) payload.message = message;
    if (stack) payload.stack = stack;
  } else if (typeof error === 'string') {
    const message = readBoundedString(error, EXCEPTION_MESSAGE_MAX_LENGTH);
    if (message) payload.message = message;
  } else if (isRecord(error)) {
    const name = readBoundedString(error.name, EXCEPTION_NAME_MAX_LENGTH);
    const message = readBoundedString(error.message, EXCEPTION_MESSAGE_MAX_LENGTH);
    if (name) payload.name = name;
    if (message) payload.message = message;
  }
  const sanitizedContext = sanitizeExceptionContext(context);
  if (sanitizedContext) payload.context = sanitizedContext;
  return payload;
}

export function parseAnalyticsExceptionPayload(value: unknown): AnalyticsExceptionPayload | undefined {
  if (!isRecord(value)) return undefined;
  const payload: AnalyticsExceptionPayload = {};
  const name = readBoundedString(value.name, EXCEPTION_NAME_MAX_LENGTH);
  const message = readBoundedString(value.message, EXCEPTION_MESSAGE_MAX_LENGTH);
  const stack = readBoundedString(value.stack, EXCEPTION_STACK_MAX_LENGTH);
  if (name) payload.name = name;
  if (message) payload.message = message;
  if (stack) payload.stack = stack;
  if (isRecord(value.context)) {
    const context = sanitizeExceptionContext(value.context as AnalyticsExceptionContext);
    if (context) payload.context = context;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

export function createErrorFromAnalyticsExceptionPayload(payload: AnalyticsExceptionPayload): Error {
  const error = new Error(payload.message ?? 'Renderer exception');
  if (payload.name) error.name = payload.name;
  if (payload.stack) error.stack = payload.stack;
  return error;
}
