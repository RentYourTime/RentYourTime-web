"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const DURATION_MS = 700;
const RISE_PX = 20;

/**
 * Fades and rises content in the first time it scrolls into view — values
 * match the "Signal" motion treatment from the design mockups (20px rise,
 * 700ms, the app's existing spring easing). `prefers-reduced-motion` needs
 * no branching here: globals.css already collapses all transition/animation
 * durations globally, so the same code just becomes instant.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
  as = "div",
  id,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  as?: "div" | "article" | "section" | "h1" | "h2";
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        timer = setTimeout(() => setShown(true), delayMs);
        io.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [delayMs]);

  // Once revealed, drop the inline `transform` entirely (rather than setting
  // it to "none") so a CSS hover:translate utility on this same element can
  // still take effect — an inline style declaration would otherwise always
  // beat the stylesheet's hover rule, even at transform:none.
  const style = {
    opacity: shown ? 1 : 0,
    transform: shown ? undefined : `translateY(${RISE_PX}px)`,
    transition: `opacity ${DURATION_MS}ms var(--ease-spring), transform ${DURATION_MS}ms var(--ease-spring)`,
  };

  // `ref` is typed broadly (HTMLElement) so this one component can back any
  // of the tags below; each concrete intrinsic element wants a narrower ref
  // type (e.g. HTMLHeadingElement), so this `any` is just satisfying that
  // polymorphism at the JSX call sites below, not hiding a real bug.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commonProps: any = { ref, className, style, id };

  if (as === "article") return <article {...commonProps}>{children}</article>;
  if (as === "section") return <section {...commonProps}>{children}</section>;
  if (as === "h1") return <h1 {...commonProps}>{children}</h1>;
  if (as === "h2") return <h2 {...commonProps}>{children}</h2>;
  return <div {...commonProps}>{children}</div>;
}
