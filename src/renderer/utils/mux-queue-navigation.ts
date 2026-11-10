/**
 * @fileoverview Navigation helper for the remux/demux queue tab.
 *
 * The Remux and Demux stores add a job to the mux queue from outside React,
 * so they cannot call `useNavigate`. The renderer runs on a `HashRouter`, so
 * assigning the hash is the equivalent navigation: React Router's hash
 * listener picks the change up and renders the Batch Queue page with the mux
 * tab selected.
 */

/**
 * The hash route of the mux queue tab.
 * @const {string} MUX_QUEUE_HASH_ROUTE
 */
export const MUX_QUEUE_HASH_ROUTE = '#/batch?tab=mux';

/**
 * Navigates to the Batch Queue page with the mux queue tab selected.
 *
 * @returns {void}
 */
export function navigateToMuxQueue(): void {
  if (typeof window === 'undefined') return;
  window.location.hash = MUX_QUEUE_HASH_ROUTE;
}
