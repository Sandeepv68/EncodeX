/**
 * @fileoverview Security-related helpers for the renderer.
 */

/**
 * Generates a cryptographically random, URL-safe bearer token from 32 random
 * bytes (base64url-encoded, padding stripped).
 * @returns {string} A 43-character secure token.
 */
export function generateMcpToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
