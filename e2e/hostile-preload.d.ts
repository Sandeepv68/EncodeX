/**
 * Ambient types for the hostile-preload control surface.
 *
 * `e2e/mocks/hostile-preload.js` exposes `window.__hostile` alongside `window.electronAPI`. It is a test
 * affordance, not part of the bridge contract the renderer depends on, so it is declared here rather
 * than in `src/renderer/electron-api.d.ts` - production code must not be able to reach for it.
 */
interface HostileControlSurface {
  /** The failure mode currently injected into every bridge method. */
  getMode(): string;
  /** Injects `next` from now on; `healthy` restores real round-trips. */
  setMode(next: string): string;
  /** Restricts failure to the named methods; `null` fails everything. Used for attribution. */
  setFailures(list: string[] | null): string[];
  /** The restricted failure set, or null when every method fails. */
  getFailures(): string[] | null;
  /** Method names that reached the bridge, in order. */
  getCalls(): string[];
  /** Sorted member names the hostile preload exposes, for the drift guard. */
  getMembers(): string[];
  /** Every mode the preload understands, including `healthy`. */
  getModes(): string[];
}

declare global {
  interface Window {
    __hostile?: HostileControlSurface;
  }
}

export {};
