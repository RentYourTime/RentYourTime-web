"use client";

import { useEffect, useRef } from "react";

export interface GlowBlob {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  marginLeft?: string;
  size: string;
  /** RGB triplet, e.g. "0,230,118" — plugged into the radial-gradient. */
  rgb: string;
  opacity?: number;
}

/**
 * Ambient background blobs that drift with scroll (matches the mockups'
 * glow layer). Purely decorative — aria-hidden, pointer-events none. The
 * parallax listener is skipped under prefers-reduced-motion; the blobs
 * themselves are still shown, just static.
 */
export function GlowLayer({ blobs }: { blobs: GlowBlob[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const onScroll = () => {
      el.style.transform = `translateY(${window.scrollY * 0.12}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[22px]"
          style={{
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            marginLeft: b.marginLeft,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle, rgba(${b.rgb},${b.opacity ?? 0.14}), rgba(${b.rgb},0) 70%)`,
          }}
        />
      ))}
    </div>
  );
}
