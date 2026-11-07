/**
 * @fileoverview Type definitions for the Copilot aurora backdrop.
 */

/** A single twinkling point in the sparkle field. */
export interface AuroraSparkle {
  x: number;
  y: number;
  size: number;
  maxAlpha: number;
  alpha: number;
  speed: number;
  growing: boolean;
  color: string;
}

/** Placement and timing of one aurora blob. */
export interface AuroraBlobPlacement {
  size: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  duration: number;
  delay: string;
}
