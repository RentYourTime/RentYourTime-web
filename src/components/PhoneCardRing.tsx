"use client";

import { useEffect, useRef, useState } from "react";

function ringGradient(p: number): string {
  const overEnd = Math.min(p + 3, 100);
  return `conic-gradient(#00e676 0 ${p}%, #ff3b30 ${p}% ${overEnd}%, rgba(255,255,255,0.08) ${overEnd}% 100%)`;
}

/** The demo phone card's usage ring — draws from empty to `target`% once scrolled into view. */
export function PhoneCardRing({ target = 91 }: { target?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState(() => ringGradient(0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          setBg(ringGradient(target));
          return;
        }
        const t0 = performance.now();
        const duration = 1100;
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - k, 3);
          setBg(ringGradient(target * eased));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div
      ref={ref}
      className="mx-auto flex size-[150px] items-center justify-center rounded-full"
      style={{ background: bg }}
    >
      <div className="flex size-[122px] flex-col items-center justify-center rounded-full bg-card">
        <div className="tnum text-[32px] font-bold">3:18</div>
        <div className="text-[11px] text-rent">18m over</div>
      </div>
    </div>
  );
}
