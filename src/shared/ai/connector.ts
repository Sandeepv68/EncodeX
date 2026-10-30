/**
 * @fileoverview Transport contract for the AI connector layer (AI connector plan §4).
 *
 * A connector is the *transport* half of a provider: it sends a small,
 * provider-neutral conversation and returns text. It is deliberately tiny,
 * stateless, and fetch-injectable so every provider adapter is trivially
 * fakeable in tests. The *planner* half (`src/shared/ai/llm.ts`) builds the
 * prompt and parses the reply; it never knows which transport produced it.
 *
 * This module is Electron-free and Node-free (type-only imports) so it can be
 * imported by the renderer, preload and main process alike.
 */

export type { AIConnector, ConnectorId, ConnectorMessage, ConnectorRequest, ConnectorResponse } from './types';
