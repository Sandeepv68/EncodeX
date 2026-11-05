/**
 * @fileoverview Shared per-group emission gate for main-process analytics
 * adapters (D10).
 *
 * `ANALYTICS_GROUPS` lets a noisy event group be disabled without a release.
 * The gate is parsed once at init and applied inside the adapter so both
 * backends behave identically.
 */

/**
 * Environment variable listing the event groups to emit (comma separated,
 * D10). Absent/empty means every group is emitted.
 * @const {string}
 */
export const ANALYTICS_GROUPS_ENV_VAR = 'ANALYTICS_GROUPS';

/**
 * Filters a group gate string into a Set of allowed groups. `null` means
 * "no gate" (emit everything).
 * @param {string | undefined} raw - Comma-separated `ANALYTICS_GROUPS` value.
 * @returns {Set<string> | null} The allowed group set, or null when unset.
 */
export function parseGroupGate(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const groups = raw
    .split(',')
    .map((group) => group.trim().toLowerCase())
    .filter(Boolean);
  return groups.length > 0 ? new Set(groups) : null;
}

/**
 * Resolves the group gate from the current environment.
 * @returns {Set<string> | null} The allowed group set, or null when unset.
 */
export function resolveGroupGate(): Set<string> | null {
  return parseGroupGate(process.env[ANALYTICS_GROUPS_ENV_VAR]);
}
