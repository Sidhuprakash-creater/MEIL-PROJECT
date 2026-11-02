"use client";

// ── Console VFX kit — shared liquid-glass motion primitives ──
// Design system for the four distinct console dashboards:
//   nc-*  Subsidiary Admin "Nerve Center"      (emerald aurora bento)
//   cd-*  BU Admin "Operations Command Deck"   (sky horizon instruments)
//   vl-*  Subsidiary Manager "Verification Ledger" (copper/teal ledger)
//   rs-*  BU Manager "Review Spectrum Prism"   (prismatic purple)
// All motion is transform/opacity only and fully disabled under
// prefers-reduced-motion. Tilt/glare engines skip touch devices.

import * as React from "react";

/* ───────────────────────── pointer tilt + glare engine ─────────────────────────
   Attach the returned ref to the dashboard root. Any descendant carrying
   [data-tilt] gets live CSS vars while hovered:
     --mx / --my    glare focal point (%)
     --tilt-x / --tilt-y   3D rotation (deg)
   Event-delegated + rAF-throttled; inert on touch / reduced-motion. */
export function useConsoleTilt<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    let raf = 0;
    let evt: PointerEvent | null = null;
    let target: HTMLElement | null = null;

    const settle = () => {
      raf = 0;
      if (!evt || !target) return;
      const r = target.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (evt.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (evt.clientY - r.top) / r.height));
      target.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
      target.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
      target.style.setProperty("--tilt-x", `${((0.5 - py) * 3.4).toFixed(2)}deg`);
      target.style.setProperty("--tilt-y", `${((px - 0.5) * 4.2).toFixed(2)}deg`);
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest?.("[data-tilt]") as HTMLElement | null;
      if (el !== target) {
        if (target) {
          target.style.setProperty("--tilt-x", "0deg");
          target.style.setProperty("--tilt-y", "0deg");
        }
        target = el;
      }
      evt = e;
      if (!raf) raf = requestAnimationFrame(settle);
    };
    const onLeave = () => {
      if (target) {
        target.style.setProperty("--tilt-x", "0deg");
        target.style.setProperty("--tilt-y", "0deg");
        target = null;
      }
      evt = null;
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

/* ───────────────────────── ambient light specks ─────────────────────────
   Deterministic positions (no hydration mismatch). Purely decorative. */
export function Specks({ count = 9, tint = "#ffffff", className }: { count?: number; tint?: string; className?: string }) {
  const specks = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i * 137.508 * Math.PI) / 180;
        return {
          left: 6 + ((i * 53) % 88),
          top: 8 + ((i * 37) % 78),
          size: 2 + ((i * 7) % 4),
          delay: (i % 6) * 1.9,
          dur: 9 + ((i * 3) % 7),
          drift: Math.sin(a) * 14,
        };
      }),
    [count]
  );
  return (
    <span aria-hidden className={`vfx-specks ${className ?? ""}`}>
      {specks.map((s, i) => (
        <span
          key={i}
          className="vfx-speck"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: tint,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            ["--drift" as string]: `${s.drift}px`,
          }}
        />
      ))}
    </span>
  );
}

/* ───────────────────────── pointer glare overlay ───────────────────────── */
export function Glare({ className }: { className?: string }) {
  return <span aria-hidden className={`vfx-glare ${className ?? ""}`} />;
}

/* ───────────────────────── scanline sweep (heroes) ───────────────────────── */
export function Sweep({ delay = 0, className }: { delay?: number; className?: string }) {
  return <span aria-hidden className={`vfx-scan ${className ?? ""}`} style={{ animationDelay: `${delay}s` }} />;
}

/* ───────────────────────── corner brackets (Nerve Center cards) ───────────────────────── */
export function Brackets({ color = "rgba(16,150,110,0.55)", className }: { color?: string; className?: string }) {
  const base: React.CSSProperties = { borderColor: color };
  return (
    <span aria-hidden className={`nc-brackets ${className ?? ""}`}>
      <span className="nc-bracket nc-bracket-tl" style={base} />
      <span className="nc-bracket nc-bracket-tr" style={base} />
      <span className="nc-bracket nc-bracket-bl" style={base} />
      <span className="nc-bracket nc-bracket-br" style={base} />
    </span>
  );
}

/* ───────────────────────── radar ping rings (Command Deck) ───────────────────────── */
export function RadarRings({ tint = "rgba(52,139,232,0.5)", className }: { tint?: string; className?: string }) {
  return (
    <span aria-hidden className={`cd-radar ${className ?? ""}`}>
      <span className="cd-radar-ring" style={{ borderColor: tint }} />
      <span className="cd-radar-ring" style={{ borderColor: tint, animationDelay: "1.4s" }} />
      <span className="cd-radar-core" style={{ background: tint }} />
    </span>
  );
}

/* ───────────────────────── conic beam ring (Review Spectrum) ─────────────────────────
   Rotating prismatic halo — pure conic-gradient ring masked with radial mask. */
export function BeamRing({ size = 92, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`rs-beam-ring ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}

/* ───────────────────────── animated arc gauge ─────────────────────────
   Full-circle progress arc with gradient stroke + rounded caps.
   Draw-in handled by CSS transition on stroke-dashoffset (triggered on mount). */
export function ProgressArc({
  pct,
  size = 120,
  stroke = 10,
  from = "#10b981",
  to = "#5eead4",
  track = "rgba(16,150,110,0.16)",
  children,
  className,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  from?: string;
  to?: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const gid = React.useId();
  return (
    <span className={`vfx-arc ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={drawn ? circ - (clamped / 100) * circ : circ}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span className="vfx-arc-center">{children}</span>
    </span>
  );
}

/* ───────────────────────── staggered entrance helper ───────────────────────── */
export const vfxStagger = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;
