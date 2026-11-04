/**
 * @fileoverview Shared defense-in-depth sanitizer for analytics event props.
 *
 * The event taxonomy already constrains payloads to categorical values, but
 * adapters independently reduce props to the primitive shapes their SDKs
 * accept. Keeping the rule in one place guarantees every backend applies the
 * same contract: strings (non-empty), numbers, and booleans survive; anything
 * else is dropped.
 */

/**
 * Reduces raw taxonomy props to the primitive shape analytics SDKs accept.
 * @param {Record<string, unknown>} props - Raw event props.
 * @returns {Record<string, string | number | boolean> | undefined} Sanitized
 *   props, or undefined when every value was dropped.
 */
export function sanitizeAnalyticsProps(
  props: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
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
