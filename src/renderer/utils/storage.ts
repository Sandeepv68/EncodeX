/**
 * @fileoverview Typed localStorage access helpers for the renderer.
 *
 * Consolidates the hand-rolled `getItem → JSON.parse → try/catch → fallback`
 * and `setItem → try/catch → log` patterns that were repeated ~20 times across
 * settings/batchConfig/videoCut/profile/terms stores (refactor.md §4).
 *
 * Callers pass an optional `onError` callback so each store keeps its own
 * per-store log constant; behavior otherwise matches the original sites
 * (missing or corrupt values fall back; write failures are swallowed).
 */

/**
 * Reads and JSON-parses a localStorage value. Returns `fallback` when the key
 * is absent, the stored value is not a JSON object/array (JSON `null`), or
 * parsing fails.
 * @param {string} key - The localStorage key to read.
 * @param {T} fallback - The value returned when the key is missing or invalid.
 * @param {(err: unknown) => void} [onError] - Optional handler for parse failures.
 * @returns {T} The parsed value or the fallback.
 */
export function loadJson<T>(key: string, fallback: T, onError?: (err: unknown) => void): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}

/**
 * Serializes a value to JSON and writes it to localStorage. Write failures
 * (e.g. quota) are routed to `onError` and otherwise swallowed.
 * @param {string} key - The localStorage key to write.
 * @param {unknown} value - The value to serialize.
 * @param {(err: unknown) => void} [onError] - Optional handler for write failures.
 * @returns {void}
 */
export function saveJson(key: string, value: unknown, onError?: (err: unknown) => void): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    onError?.(err);
  }
}

/**
 * Reads a raw string value from localStorage. Returns `fallback` when the key
 * is absent or storage access fails.
 * @param {string} key - The localStorage key to read.
 * @param {string} fallback - The value returned when the key is missing.
 * @param {(err: unknown) => void} [onError] - Optional handler for read failures.
 * @returns {string} The stored string or the fallback.
 */
export function loadString(key: string, fallback: string, onError?: (err: unknown) => void): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}

/**
 * Writes a raw string value to localStorage. Write failures are routed to
 * `onError` and otherwise swallowed.
 * @param {string} key - The localStorage key to write.
 * @param {string} value - The string to store.
 * @param {(err: unknown) => void} [onError] - Optional handler for write failures.
 * @returns {void}
 */
export function saveString(key: string, value: string, onError?: (err: unknown) => void): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    onError?.(err);
  }
}
