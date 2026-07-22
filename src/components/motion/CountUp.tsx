"use client";

import { useCountUp, type CountUpOptions } from "./useCountUp";

export function CountUp({
  target,
  className,
  ...opts
}: CountUpOptions & { target: number; className?: string }) {
  const { ref, display } = useCountUp(target, opts);
  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className={className}>
      {display}
    </span>
  );
}
