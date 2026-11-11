"use client";

import * as React from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BorderBeamProps {
  /** Size of the traveling light beam in pixels. */
  size?: number;
  /** Animation duration in seconds for one full loop. */
  duration?: number;
  /** Delay before the animation begins, in seconds. */
  delay?: number;
  /** Leading color of the gradient beam. */
  colorFrom?: string;
  /** Trailing color of the gradient beam. */
  colorTo?: string;
  /** Custom Framer Motion transition overrides. */
  transition?: Transition;
  /** Additional classes applied to the moving beam element. */
  className?: string;
  /** Additional inline styles applied to the moving beam element. */
  style?: React.CSSProperties;
  /** Reverses travel direction along the perimeter. */
  reverse?: boolean;
  /** Starting perimeter offset percentage (0-100). */
  initialOffset?: number;
  /** Border track thickness in pixels. */
  borderWidth?: number;
}

/**
 * Animated gradient light beam that glides smoothly along the border of its
 * nearest `position: relative` rounded parent.
 */
export function BorderBeam({
  className,
  size = 64,
  delay = 0,
  duration = 6,
  colorFrom = "#347deb",
  colorTo = "#8b5cf6",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
}: BorderBeamProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-px overflow-hidden rounded-[inherit]"
      style={{
        padding: borderWidth,
        WebkitMask:
          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      <motion.div
        className={cn(
          "absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--beam-from": colorFrom,
            "--beam-to": colorTo,
            ...style,
          } as React.CSSProperties
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}

