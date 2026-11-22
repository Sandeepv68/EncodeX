/**
 * @fileoverview Bounded limits for automation JSON crossing IPC or disk.
 *
 * Zod checks shape; these limits keep hostile payloads from expanding into
 * unbounded work before or after validation.
 */

/** Bounds applied to every untrusted automation payload. */
export const AUTOMATION_LIMITS = {
  maxAutomations: 100,
  maxNodesPerGraph: 200,
  maxEdgesPerGraph: 500,
  maxIdLength: 128,
  maxNameLength: 200,
  maxStringLength: 16384,
  maxDescriptionLength: 4000,
  maxOptionsKeys: 100,
  maxArrayLength: 500,
  maxJsonDepth: 12,
  maxJsonNodes: 10000,
  maxNumberMagnitude: Number.MAX_SAFE_INTEGER,
  maxPositionMagnitude: 1e9,
  maxTimestamp: Number.MAX_SAFE_INTEGER,
  maxFileBytes: 4 * 1024 * 1024,
  maxJsonChars: 4 * 1024 * 1024,
} as const;

/** Paths and labels shared by the persisted store and native dialogs. */
export const AUTOMATION_STORE = {
  directory: 'automations',
  filename: 'definitions.json',
  backupSuffix: '.bak',
  dialogFilterName: 'Automation JSON',
  exportFilename: 'automation.json',
  duplicateNameSuffix: ' (Copy)',
} as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function visitBoundedValue(value: unknown, depth: number, ancestors: WeakSet<object>, budget: { nodes: number }): boolean {
  if (value === null) return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= AUTOMATION_LIMITS.maxStringLength;
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= AUTOMATION_LIMITS.maxNumberMagnitude;
  }
  if (typeof value !== 'object') return false;
  if (depth > AUTOMATION_LIMITS.maxJsonDepth) return false;
  budget.nodes += 1;
  if (budget.nodes > AUTOMATION_LIMITS.maxJsonNodes) return false;
  if (ancestors.has(value)) return false;

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return false;
  }

  const isArray = Array.isArray(value);
  if (keys.length > (isArray ? AUTOMATION_LIMITS.maxArrayLength : AUTOMATION_LIMITS.maxOptionsKeys)) return false;
  if (!isArray && !isPlainObject(value)) return false;

  ancestors.add(value);
  try {
    for (const key of keys) {
      if (key.length > AUTOMATION_LIMITS.maxStringLength || FORBIDDEN_KEYS.has(key)) return false;
      let item: unknown;
      if (isArray) {
        item = (value as unknown[])[Number(key)];
      } else {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) return false;
        item = descriptor.value;
      }
      if (!visitBoundedValue(item, depth + 1, ancestors, budget)) return false;
    }
    return true;
  } finally {
    ancestors.delete(value);
  }
}

/** True when a value is JSON-shaped and stays within every automation bound. */
export function isBoundedAutomationJsonValue(value: unknown): boolean {
  try {
    return visitBoundedValue(value, 0, new WeakSet<object>(), { nodes: 0 });
  } catch {
    return false;
  }
}
