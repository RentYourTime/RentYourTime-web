"use client";

import { useEffect, useRef } from "react";

// Brand-ish festive palette: signal green, white, Discord blurple, rent red, gold.
const COLORS = ["#00E676", "#ffffff", "#5865F2", "#FF3B30", "#FFD23F"];

/**
 * A light, one-shot confetti cascade drawn on a full-viewport canvas.
 * Plays once on mount, fades out, then stops (no perpetual animation).
 * Skipped entirely when the user prefers reduced motion.
 */
export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 90;
    const pieces = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * -h * 0.6 - 10, // staggered above the top → gentle cascade
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      vy: 1.4 + Math.random() * 2.6,
      sway: 0.4 + Math.random() * 1.4,
      swaySpeed: 0.02 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
    }));

    const DURATION = 5200;
    const FADE = 1300;
    // Start timing from the first real frame, not mount — so the animation
    // plays its full length even if rAF is delayed (e.g. tab becomes visible late).
    let start = 0;
    let raf = 0;

    const frame = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = elapsed > DURATION - FADE ? Math.max(0, (DURATION - elapsed) / FADE) : 1;
      let alive = 0;
      for (const p of pieces) {
        p.y += p.vy;
        p.phase += p.swaySpeed;
        p.x += Math.sin(p.phase) * p.sway;
        p.rot += p.rotSpeed;
        if (p.y < h + 20) alive++;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < DURATION && (alive > 0 || elapsed < 1600)) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
