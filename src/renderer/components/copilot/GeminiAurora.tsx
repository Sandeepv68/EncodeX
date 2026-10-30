/* eslint-disable encodex/no-inline-styles, encodex/no-local-types, encodex/no-hardcoded-colors, encodex/no-hardcoded-px */
import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export default function GeminiAurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    interface Sparkle { x: number; y: number; size: number; maxAlpha: number; alpha: number; speed: number; growing: boolean; color: string; }
    const tints = ['#ffffff', '#a855f7', '#60a5fa', '#38bdf8'];
    const sparkles: Sparkle[] = [];
    for (let i = 0; i < 90; i++) {
      sparkles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 1.6 + 0.3, maxAlpha: Math.random() * 0.85 + 0.15, alpha: 0, speed: Math.random() * 0.012 + 0.004, growing: true, color: tints[Math.floor(Math.random() * tints.length)] });
    }

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparkles.forEach((s) => {
        if (s.growing) { s.alpha += s.speed; if (s.alpha >= s.maxAlpha) s.growing = false; }
        else { s.alpha -= s.speed; if (s.alpha <= 0) { s.x = Math.random() * canvas.width; s.y = Math.random() * canvas.height; s.size = Math.random() * 1.6 + 0.3; s.maxAlpha = Math.random() * 0.85 + 0.15; s.alpha = 0; s.speed = Math.random() * 0.012 + 0.004; s.growing = true; s.color = tints[Math.floor(Math.random() * tints.length)]; } }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        if (s.size > 1.4 && s.alpha > 0.5) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(s.x - s.size * 2.5, s.y);
          ctx.lineTo(s.x + s.size * 2.5, s.y);
          ctx.moveTo(s.x, s.y - s.size * 2.5);
          ctx.lineTo(s.x, s.y + s.size * 2.5);
          ctx.stroke();
        }
        ctx.restore();
      });
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 0, filter: 'blur(90px)', opacity: 0.85 }}>
        <Box sx={{ position: 'absolute', width: '60vw', height: '60vw', top: '20%', left: '10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(66,133,244,0.8) 0%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen', animation: 'morph 14s ease-in-out infinite alternate', '@keyframes morph': { '0%': { transform: 'translate(0px,0px) scale(1) rotate(0deg)' }, '33%': { transform: 'translate(40px,-60px) scale(1.15) rotate(120deg)' }, '66%': { transform: 'translate(-30px,50px) scale(0.9) rotate(240deg)' }, '100%': { transform: 'translate(20px,-20px) scale(1.05) rotate(360deg)' } } }} />
        <Box sx={{ position: 'absolute', width: '50vw', height: '50vw', top: '40%', right: '15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.75) 0%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen', animation: 'morph 18s ease-in-out infinite alternate', animationDelay: '-4s' }} />
        <Box sx={{ position: 'absolute', width: '55vw', height: '55vw', bottom: '10%', left: '25%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.6) 0%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen', animation: 'morph 16s ease-in-out infinite alternate', animationDelay: '-8s' }} />
        <Box sx={{ position: 'absolute', width: '45vw', height: '45vw', top: '10%', right: '30%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.65) 0%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen', animation: 'morph 20s ease-in-out infinite alternate', animationDelay: '-12s' }} />
      </Box>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </Box>
  );
}
