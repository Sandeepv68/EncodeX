/**
 * @fileoverview Gemini-style aurora backdrop for the Copilot page.
 *
 * Renders four slowly morphing, heavily blurred gradient blobs with a sparkle
 * field painted on a canvas above them. While the composer is idle the aurora
 * fills the page; once a chat is running it shrinks to a short band above the
 * composer, where a gradient overlay dissolves its top edge into the page
 * background. The overlay appears instantly when shrinking and fades out slowly
 * once the aurora has grown back to its full size.
 */

import { useEffect, useRef, useState } from 'react';
import { AURORA_COLORS } from '../../../shared/theme/colors';
import {
  GeminiAuroraBlob,
  GeminiAuroraBlobs,
  GeminiAuroraCanvas,
  GeminiAuroraEdge,
  GeminiAuroraLayer,
  AURORA_BLOB_FILLS,
} from '../../styles/copilot/GeminiAurora.styles';
import type { AuroraBlobPlacement, AuroraSparkle } from './GeminiAurora.types';

/** Duration of the height transition, in milliseconds. */
const HEIGHT_TRANSITION_MS = 600;

/** Placement and timing of the four aurora blobs. */
const BLOB_PLACEMENTS: readonly AuroraBlobPlacement[] = [
  { size: '60vw', top: '20%', left: '10%', duration: 14, delay: '0s' },
  { size: '50vw', top: '40%', right: '15%', duration: 18, delay: '-4s' },
  { size: '55vw', bottom: '10%', left: '25%', duration: 16, delay: '-8s' },
  { size: '45vw', top: '10%', right: '30%', duration: 20, delay: '-12s' },
];

/**
 * Renders the aurora backdrop.
 * @param {object} props - Component props.
 * @param {boolean} props.compact - Whether the chat is active and the aurora
 *   should shrink to the composer band.
 * @returns {JSX.Element} The aurora backdrop.
 */
export default function GeminiAurora({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [masked, setMasked] = useState(compact);

  // The soft top edge stays applied while the aurora shrinks to the composer and
  // while it grows back. Once it has reached its full size again the edge fades
  // out, so the growing aurora never flashes a hard border.
  useEffect(() => {
    if (compact) {
      setMasked(true);
      return;
    }
    const timer = window.setTimeout(() => setMasked(false), HEIGHT_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [compact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const tints = AURORA_COLORS.sparkleTints;
    const sparkles: AuroraSparkle[] = [];
    for (let i = 0; i < 90; i++) {
      sparkles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.6 + 0.3,
        maxAlpha: Math.random() * 0.85 + 0.15,
        alpha: 0,
        speed: Math.random() * 0.012 + 0.004,
        growing: true,
        color: tints[Math.floor(Math.random() * tints.length)],
      });
    }

    const resetSparkle = (sparkle: AuroraSparkle): void => {
      sparkle.x = Math.random() * canvas.width;
      sparkle.y = Math.random() * canvas.height;
      sparkle.size = Math.random() * 1.6 + 0.3;
      sparkle.maxAlpha = Math.random() * 0.85 + 0.15;
      sparkle.alpha = 0;
      sparkle.speed = Math.random() * 0.012 + 0.004;
      sparkle.growing = true;
      sparkle.color = tints[Math.floor(Math.random() * tints.length)];
    };

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparkles.forEach((sparkle) => {
        if (sparkle.growing) {
          sparkle.alpha += sparkle.speed;
          if (sparkle.alpha >= sparkle.maxAlpha) sparkle.growing = false;
        } else {
          sparkle.alpha -= sparkle.speed;
          if (sparkle.alpha <= 0) resetSparkle(sparkle);
        }
        ctx.save();
        ctx.globalAlpha = sparkle.alpha;
        ctx.fillStyle = sparkle.color;
        ctx.beginPath();
        ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
        ctx.fill();
        if (sparkle.size > 1.4 && sparkle.alpha > 0.5) {
          ctx.strokeStyle = sparkle.color;
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(sparkle.x - sparkle.size * 2.5, sparkle.y);
          ctx.lineTo(sparkle.x + sparkle.size * 2.5, sparkle.y);
          ctx.moveTo(sparkle.x, sparkle.y - sparkle.size * 2.5);
          ctx.lineTo(sparkle.x, sparkle.y + sparkle.size * 2.5);
          ctx.stroke();
        }
        ctx.restore();
      });
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <GeminiAuroraLayer $compact={compact}>
      <GeminiAuroraBlobs data-testid="copilot-aurora-blobs">
        {BLOB_PLACEMENTS.map((placement, index) => (
          <GeminiAuroraBlob
            key={placement.delay}
            data-testid="copilot-aurora-blob"
            $fill={AURORA_BLOB_FILLS[index]}
            $duration={placement.duration}
            $delay={placement.delay}
            $placement={placement}
          />
        ))}
      </GeminiAuroraBlobs>
      <GeminiAuroraCanvas ref={canvasRef} />
      <GeminiAuroraEdge $visible={masked} $instant={compact} />
    </GeminiAuroraLayer>
  );
}
