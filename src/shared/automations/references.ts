/**
 * @fileoverview Reference helpers for automation option payloads.
 *
 * Options may embed `{{nodeId.field}}` placeholders which create implicit
 * execution dependencies. These helpers follow the workflow module's pattern
 * but operate on automation node ids.
 */

import type { AutomationReference } from './types';

/** Matches `{{nodeId.field}}` placeholders, tolerating internal whitespace. */
const REFERENCE_RE = /\{\{\s*([A-Za-z_][\w-]*)\s*\.\s*([\w.]+)\s*\}\}/g;

/** Valid identifiers for automation node ids. */
const AUTOMATION_ID_RE = /^[A-Za-z_][\w-]*$/;

/** True when a value is a structurally valid automation node id. */
export function isValidAutomationId(value: unknown): value is string {
  return typeof value === 'string' && AUTOMATION_ID_RE.test(value);
}

/** Recursively collects every `{{nodeId.field}}` reference from an unknown value. */
function collectReferences(value: unknown, field: string, out: AutomationReference[]): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(REFERENCE_RE)) {
      out.push({ field, nodeId: match[1], path: match[2] });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectReferences(entry, field, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectReferences(entry, field, out);
    }
  }
}

/** Extracts de-duplicated references from an automation options payload. */
export function automationReferences(options: Record<string, unknown>): AutomationReference[] {
  const collected: AutomationReference[] = [];
  for (const [key, value] of Object.entries(options)) {
    collectReferences(value, key, collected);
  }
  const seen = new Set<string>();
  return collected.filter((ref) => {
    const token = `${ref.field}\u0000${ref.nodeId}\u0000${ref.path}`;
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

/** Resolves placeholders in a value using a per-node context of result fields. */
export function resolveAutomationReferences(value: unknown, context: Record<string, Record<string, unknown>>): unknown {
  if (typeof value === 'string') {
    return value.replace(REFERENCE_RE, (match, nodeId: string, path: string) => {
      const fields = context[nodeId];
      if (!fields) return match;
      const resolved = readAutomationField(fields, path);
      return resolved === undefined ? match : String(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveAutomationReferences(entry, context));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveAutomationReferences(entry, context);
    }
    return result;
  }
  return value;
}

/** Reads a dot-separated field path from a result context. */
function readAutomationField(fields: Record<string, unknown>, path: string): unknown {
  let current: unknown = fields;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
