"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A one-time diagonal light sweep across its parent, triggered when scrolled
 * into view. Parent must be `position:relative` + `overflow-hidden`.
 */
export function ShineSweep() {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const t = setTimeout(() => setPlay(true), 350);
        return () => clearTimeout(t);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 w-3/5"
      style={{
        background: "linear-gradient(105deg, transparent, rgba(0,230,118,0.10), transparent)",
        transform: play ? "translateX(240%)" : "translateX(-120%)",
        transition: play ? "transform 1.6s cubic-bezier(0.4,0,0.2,1)" : "none",
      }}
    />
  );
}
