"use client";

import { useEffect, useRef, useState } from "react";

export interface CountUpOptions {
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Renders the value as "Xh Ym" (input treated as minutes) instead of a plain number. */
  format?: "hm";
  durationMs?: number;
}

function render(value: number, target: number, opts: CountUpOptions): string {
  if (opts.format === "hm") {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    return `${h}h ${m}m`;
  }
  let s = opts.decimals ? value.toFixed(opts.decimals) : Math.round(value).toLocaleString("en-US");
  if (target < 0) s = "−" + s.replace("-", "");
  return `${opts.prefix ?? ""}${s}${opts.suffix ?? ""}`;
}

/**
 * Counts a number up to `target` once its host element scrolls into view.
 * If `target` changes afterwards (e.g. a live count arriving from an API),
 * it tweens from the last displayed value to the new one rather than
 * re-waiting for visibility or freezing.
 */
export function useCountUp(target: number, opts: CountUpOptions = {}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(() => render(0, target, opts));
  const fromRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        io.disconnect();
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce) {
      setDisplay(render(target, target, opts));
      fromRef.current = target;
      return;
    }
    const t0 = performance.now();
    const duration = opts.durationMs ?? 1300;
    let raf: number;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const val = from + (target - from) * eased;
      setDisplay(render(val, target, opts));
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // opts is expected to be constant for a given call site (formatting config, not state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, visible]);

  return { ref, display };
}
