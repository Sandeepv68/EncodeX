/**
 * @fileoverview Type definitions for the renderer analytics adapters.
 * Declares the minimal structural surface of the lazily-loaded vendor SDK
 * module the Aptabase renderer adapter talks to.
 */

/**
 * Minimal structural type of the `@aptabase/electron/renderer` module surface
 * used by this adapter. Keeps the file free of static imports (the real
 * module loads lazily inside {@link init}) while retaining type safety.
 */
export interface AptabaseRendererSdk {
  trackEvent(eventName: string, props?: Record<string, string | number | boolean>): Promise<void>;
}
