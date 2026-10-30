/**
 * @fileoverview Type definitions for the renderer monitoring adapter.
 * Declares the minimal structural surface of the lazily-loaded vendor SDK
 * module the Sentry renderer adapter talks to, plus the user record shape it
 * maps facade-level users onto.
 */

/**
 * Minimal structural type of the `@sentry/electron/renderer` module surface
 * used by this adapter. Keeps the file free of static imports (the real
 * module loads lazily inside {@link init}) while retaining type safety.
 */
export interface SentryRendererSdk {
  init(options?: Record<string, unknown>): void;
  captureException(error: unknown, hint?: Record<string, unknown>): string | undefined;
  captureMessage(message: string, level?: string, hint?: Record<string, unknown>): string | undefined;
  captureFeedback(feedback: { message: string; name?: string; email?: string }, hint?: Record<string, unknown>): string | undefined;
  setTag(key: string, value: string): void;
  setUser(user: Record<string, unknown> | null): void;
  addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
}

/** Reuses the user mapping shape of the shared contracts. */
export type MappedUser = Record<string, unknown>;
