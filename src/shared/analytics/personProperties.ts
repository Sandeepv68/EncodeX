/**
 * @fileoverview Allowlist of coarse, non-PII person properties that the
 * PostHog adapter is permitted to send via `identify()`.
 *
 * Anything not in this set is dropped at the adapter boundary. Fields are
 * deliberately coarse (OS family, arch, app version, locale, channel,
 * hardware-acceleration availability) so no user identity, file path, or
 * device fingerprint ever reaches PostHog.
 */

/** Allowlisted person-property keys (PD2). */
export const PERSON_PROPERTY_ALLOWLIST = new Set<string>([
  'app_version',
  'os',
  'arch',
  'os_version',
  'electron_version',
  'node_version',
  'locale',
  'channel',
  'mode',
  'environment',
  'hw_accel_available',
  'first_seen_version',
]);

/**
 * Filters a candidate person-property map to the allowlisted keys.
 * @param {Record<string, unknown>} props - Candidate person properties.
 * @returns {Record<string, unknown>} Only allowlisted keys.
 */
export function filterPersonProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (PERSON_PROPERTY_ALLOWLIST.has(key) && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
