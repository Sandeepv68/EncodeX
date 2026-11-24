/**
 * @fileoverview Feature-flag registry for the PostHog integration (CP4).
 *
 * Flags are defined here with an owner, default value, and intended removal
 * date so stale flags can be cleaned up. The PostHog adapter evaluates them
 * remotely (project token, no local evaluation) with a 2-second startup timeout
 * and cached values on disk.
 */

import type { FeatureFlagDefinition } from '../../shared/analytics/types';
import { FEATURE_FLAG_DEFAULTS as SHARED_FEATURE_FLAG_DEFAULTS } from '../../shared/analytics/featureFlagDefaults';

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
  {
    name: 'automations_page',
    owner: 'automations',
    defaultValue: SHARED_FEATURE_FLAG_DEFAULTS.automations_page as boolean,
    removeBy: '2027-06-01',
    purpose: 'Gate the Automations page rollout; enabled in development, disabled by default in production.',
  },
];

export const FEATURE_FLAG_DEFAULTS: Record<string, boolean | string | number> = { ...SHARED_FEATURE_FLAG_DEFAULTS };
