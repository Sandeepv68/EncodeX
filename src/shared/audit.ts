/**
 * @fileoverview Audit trail contract for mutating MCP operations (roadmap §6).
 *
 * "The model can propose, only the app can commit" is the core safety invariant.
 * Every committed (or headlessly executed) mutating operation emits one
 * {@link AuditEntry} recording the tool, its safety tier, a digest of its
 * arguments, and whether it succeeded — surfaced in the desktop Logs page.
 *
 * Dependency-free (no Node crypto) so it can be shared by the Electron-free MCP
 * server, the main process, and the renderer.
 */

/**
 * One audit record for a mutating operation.
 * @interface AuditEntry
 * @property {string} id - Stable unique id (timestamp + digest).
 * @property {string} timestamp - ISO-8601 UTC timestamp.
 * @property {string} tool - The mutating tool that ran.
 * @property {number} tier - Safety tier (2 = write, 3 = destructive).
 * @property {string} argsDigest - Short stable digest of the arguments.
 * @property {'ok' | 'error'} result - Whether the operation was accepted.
 * @property {string} [detail] - Error summary when `result` is 'error'.
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;
  tier: number;
  argsDigest: string;
  result: 'ok' | 'error';
  detail?: string;
}

/**
 * Deterministically serializes a value with object keys sorted, so equal
 * argument objects always produce the same digest regardless of insertion order.
 * @param {unknown} value - Value to serialize.
 * @returns {string} A stable string form.
 */
function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(resolveEntry).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${resolveEntry(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Serializes one value, normalizing undefined/functions to null so a digest is
 * still produced for sparse argument objects.
 * @param {unknown} value - Value to serialize.
 * @returns {string} The serialized value.
 */
function resolveEntry(value: unknown): string {
  if (value === undefined || typeof value === 'function') return 'null';
  return stableStringify(value);
}

/**
 * Computes a short, stable digest of a value (djb2 hash rendered as hex).
 * Not a cryptographic hash: it only needs to be stable and collision-resistant
 * enough to fingerprint an operation's arguments in the audit log.
 * @param {unknown} value - Value to digest.
 * @returns {string} An 8-character hex digest.
 */
export function digestArgs(value: unknown): string {
  const text = stableStringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Builds an audit entry for a mutating operation.
 * @param {{ tool: string; tier: number; args: unknown; result: 'ok' | 'error'; detail?: string; now?: Date }} fields -
 *   The operation to record.
 * @returns {AuditEntry} The audit entry.
 */
export function createAuditEntry(fields: {
  tool: string;
  tier: number;
  args: unknown;
  result: 'ok' | 'error';
  detail?: string;
  now?: Date;
}): AuditEntry {
  const now = fields.now ?? new Date();
  const timestamp = now.toISOString();
  const argsDigest = digestArgs(fields.args);
  const entry: AuditEntry = {
    id: `${timestamp}-${argsDigest}`,
    timestamp,
    tool: fields.tool,
    tier: fields.tier,
    argsDigest,
    result: fields.result,
  };
  if (fields.detail) entry.detail = fields.detail;
  return entry;
}
