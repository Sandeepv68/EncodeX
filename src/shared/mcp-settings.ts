/**
 * @fileoverview Shared contract for the embedded (Phase 2) MCP server settings.
 *
 * Both processes need the same vocabulary: the main process persists and
 * sanitizes the settings, the preload bridge forwards them, and the renderer
 * Settings UI reads and edits them. Keeping the shape and the port rules here
 * (rather than duplicating them in each process) guarantees a single source of
 * truth for what a valid {@link McpSettings} snapshot looks like.
 *
 * Only pure, dependency-free helpers live here so this module can be imported
 * from the renderer bundle, the preload script, and the main process alike.
 */

/**
 * Default port the embedded MCP server listens on.
 * @const {number}
 */
export const MCP_DEFAULT_PORT = 8765;

/**
 * Lower bound for selectable ports (below this range privileged/impractical
 * ports cause failures on most systems).
 * @const {number}
 */
export const MCP_MIN_PORT = 1024;

/**
 * Upper bound for selectable ports (max valid TCP port).
 * @const {number}
 */
export const MCP_MAX_PORT = 65535;

/**
 * Renderer-visible MCP server settings.
 * @interface McpSettings
 * @property {boolean} enabled - True starts the loopback server at startup.
 * @property {number} port - TCP port to bind on 127.0.0.1.
 * @property {string} token - Optional bearer token clients must send.
 */
export interface McpSettings {
  enabled: boolean;
  port: number;
  token: string;
}

/**
 * Canonical default settings used when the stored file is absent or invalid.
 * @returns {McpSettings} Off-by-default, loopback port, no token.
 */
export function defaultMcpSettings(): McpSettings {
  return { enabled: false, port: MCP_DEFAULT_PORT, token: '' };
}

/**
 * Clamps a candidate port into the allowed 1024-65535 range, falling back to
 * {@link MCP_DEFAULT_PORT} for non-integer or NaN values.
 * @param {unknown} value - The raw port value.
 * @returns {number} A valid, in-range TCP port.
 */
export function clampMcpPort(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MCP_MIN_PORT || n > MCP_MAX_PORT) return MCP_DEFAULT_PORT;
  return Math.floor(n);
}

/**
 * Sanitizes raw stored/forwarded values into a complete, valid
 * {@link McpSettings} object (missing or invalid fields fall back to defaults).
 * @param {Partial<McpSettings>} raw - Raw settings input.
 * @returns {McpSettings} The validated settings snapshot.
 */
export function sanitizeMcpSettings(raw: Partial<McpSettings>): McpSettings {
  return {
    enabled: raw.enabled === true,
    port: clampMcpPort(raw.port),
    token: typeof raw.token === 'string' ? raw.token : '',
  };
}
