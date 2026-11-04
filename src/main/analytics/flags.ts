/**
 * @fileoverview Feature-flag registry for the PostHog integration (CP4).
 *
 * Flags are defined here with an owner, default value, and intended removal
 * date so stale flags can be cleaned up. The PostHog adapter evaluates them
 * remotely (project token, no local evaluation) with a 2-second startup timeout
 * and cached values on disk.
 */

export interface FeatureFlagDefinition {
  /** Flag name as it exists in the PostHog project. */
  name: string;
  /** Owner responsible for removal. */
  owner: string;
  /** Value used when the remote value is unavailable (offline, timeout, quota). */
  defaultValue: boolean;
  /** Target removal date (ISO). */
  removeBy: string;
  /** Human-readable purpose. */
  purpose: string;
}

export const FEATURE_FLAGS: FeatureFlagDefinition[] = [
  {
    name: 'analytics_group_convert',
    owner: 'analytics',
    defaultValue: true,
    removeBy: '2027-01-01',
    purpose: 'Remotely disable the `convert` analytics group without a release (replaces the ANALYTICS_GROUPS env gate).',
  },
  {
    name: 'analytics_group_queue',
    owner: 'analytics',
    defaultValue: true,
    removeBy: '2027-01-01',
    purpose: 'Remotely disable the `queue` analytics group without a release.',
  },
  {
    name: 'mcp_server_default_on',
    owner: 'mcp',
    defaultValue: false,
    removeBy: '2027-01-01',
    purpose: 'Staged rollout of the embedded MCP server default-on behaviour.',
  },
];

export const FEATURE_FLAG_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  FEATURE_FLAGS.map((flag) => [flag.name, flag.defaultValue]),
);
