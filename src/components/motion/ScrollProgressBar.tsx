"use client";

import { useEffect, useRef } from "react";

/** Thin fixed bar at the top of the viewport tracking scroll progress. */
export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      bar.style.width = `${pct}%`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[999] h-[2px]">
      <div
        ref={barRef}
        className="h-full bg-gradient-to-r from-signal to-[#4dffa0] shadow-[0_0_12px_rgba(0,230,118,0.6)] transition-[width] duration-100 ease-linear"
        style={{ width: 0 }}
      />
    </div>
  );
}
