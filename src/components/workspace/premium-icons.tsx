"use client";

// ── Premium duotone gradient icon set — hand-built geometry (no lucide path copies) ──
// Every icon renders gradient line work (strokeWidth 1.7, rounded caps/joins) plus
// ONE soft filled accent shape (fillOpacity 0.18) for a premium two-tone finish.
// Colors derive from a single `hue` prop: gradient runs hue → darkenHex(hue, 0.62).

import * as React from "react";

export interface PremiumIconProps {
  className?: string;
  size?: number;
  hue?: string;
}

const DEFAULT_HUE = "#3a7bff";
const FALLBACK_DARK = "#17263d";

/** Multiply each #rrggbb channel by (1 - amount), clamped to byte range.
 *  Falls back to mixing fully towards the ink base #17263d when unparseable. */
function darkenHex(hue: string, amount: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hue.trim());
  if (!m) return FALLBACK_DARK;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = Number.parseInt(hex, 16);
  const mix = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Shared frame: sanitized gradient id (useId colons stripped), gradient defs,
 *  and an open 24×24 canvas. `children` is a render-prop receiving the uid. */
function PremiumIconFrame({
  hue = DEFAULT_HUE,
  className,
  size,
  children,
}: PremiumIconProps & { children: (uid: string) => React.ReactNode }) {
  const uid = `pg${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const dark = darkenHex(hue, 0.62);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hue} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {children(uid)}
    </svg>
  );
}

/** Shared duotone stroke treatment for the line-work layer. */
function LineGroup({ uid, children }: { uid: string; children: React.ReactNode }) {
  return (
    <g stroke={`url(#${uid})`} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {children}
    </g>
  );
}

/* ────────────────────────────── 1. Org (landmark) ────────────────────────────── */

export function OrgIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft pediment accent */}
          <path d="M12 3.6 L20.2 8.8 H3.8 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M3.8 8.8 L12 3.6 L20.2 8.8" />
          <path d="M5.4 12.1 H18.6" />
          <path d="M7.4 12.1 V20.2" />
          <path d="M12 12.1 V20.2" />
          <path d="M16.6 12.1 V20.2" />
          <path d="M4.1 20.2 H19.9" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 2. Units (3 stacked layers) ────────────────────────────── */

export function UnitsIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft top-layer accent */}
          <path d="M12 3.7 L20.4 8.2 L12 12.7 L3.6 8.2 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M12 3.7 L20.4 8.2 L12 12.7 L3.6 8.2 Z" />
          <path d="M20.4 12.6 L12 17.1 L3.6 12.6" />
          <path d="M20.4 17 L12 21.5 L3.6 17" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 3. Projects (2 buildings) ────────────────────────────── */

export function ProjectsIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft tall-building accent */}
          <path d="M12.2 4.6 H19.4 V20.2 H12.2 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M4.6 20.2 V10 H12.2" />
          <path d="M12.2 20.2 V4.6 H19.4 V20.2" />
          <path d="M3.6 20.2 H20.4" />
          <path d="M7 12.8 H9.6" />
          <path d="M7 15.6 H9.6" />
          <path d="M14.7 7.6 H17" />
          <path d="M14.7 10.4 H17" />
          <path d="M14.7 13.2 H17" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 4. People (2 persons) ────────────────────────────── */

export function PeopleIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft front-head accent */}
          <circle cx={9.2} cy={7.8} r={3.4} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <circle cx={9.2} cy={7.8} r={3.4} />
          <path d="M3.4 20.3 C3.4 16 5.9 13.7 9.2 13.7 C12.5 13.7 15 16 15 20.3" />
          <path d="M16.6 4.5 A3.4 3.4 0 0 1 16.6 11.3" />
          <path d="M17.1 13.8 C19.4 14.7 20.7 16.9 20.7 20.3" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 5. Files (2 offset pages + fold) ────────────────────────────── */

export function FilesIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft front-page accent */}
          <path d="M3.7 8.75 H10.1 L14.1 12.75 V20.3 H3.7 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M8.6 9 V3.7 H14.9 L19.3 8.1 V14.4 H14.2" />
          <path d="M3.7 8.75 H10.1 L14.1 12.75 V20.3 H3.7 Z" />
          <path d="M10.1 8.75 V12.75 H14.1" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 6. Check seal (double circle + check) ────────────────────────────── */

export function CheckSealIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft inner-seal accent */}
          <circle cx={12} cy={12} r={5.7} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <circle cx={12} cy={12} r={8.75} />
          <circle cx={12} cy={12} r={5.7} />
          <path d="M9.3 12.15 L11.25 14.1 L14.9 10.35" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 7. Hourglass (frame + sand) ────────────────────────────── */

export function HourglassIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft sand-pile accent */}
          <path d="M9.3 20 L12 15.9 L14.7 20 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M6.4 3.6 H17.6" />
          <path d="M6.4 20.4 H17.6" />
          <path d="M7.6 3.6 C7.6 8.9 12 10.5 12 12 C12 13.5 16.4 15.1 16.4 20.4" />
          <path d="M16.4 3.6 C16.4 8.9 12 10.5 12 12 C12 13.5 7.6 15.1 7.6 20.4" />
          {/* falling-sand dots */}
          <circle cx={12} cy={13.3} r={0.85} fill={`url(#${uid})`} stroke="none" />
          <circle cx={12} cy={14.9} r={0.85} fill={`url(#${uid})`} stroke="none" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 8. Alarm alert (clock + bells + alert dot) ────────────────────────────── */

export function AlarmAlertIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft time-wedge accent */}
          <path d="M11.8 13.1 L11.8 9.3 A3.8 3.8 0 0 1 15.09 15 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <circle cx={11.8} cy={13.1} r={7.3} />
          <path d="M6 4.6 L3.9 6.7" />
          <path d="M17.6 4.6 L19.7 6.7" />
          <path d="M11.8 9.1 L11.8 13.1 L15 14.9" />
          {/* alert dot */}
          <circle cx={20.1} cy={19.8} r={1.8} fill={`url(#${uid})`} stroke="none" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 9. User plus (person + plus) ────────────────────────────── */

export function UserPlusIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft head accent */}
          <circle cx={9.4} cy={7.7} r={3.4} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <circle cx={9.4} cy={7.7} r={3.4} />
          <path d="M3.5 20.3 C3.5 16 6 13.6 9.4 13.6 C12.8 13.6 15.3 16 15.3 20.3" />
          <path d="M18.6 5.9 V12.3" />
          <path d="M15.4 9.1 H21.6" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 10. Task check (rounded square + check) ────────────────────────────── */

export function TaskCheckIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft plate accent */}
          <rect x={3.9} y={3.9} width={16.2} height={16.2} rx={4.6} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <rect x={3.9} y={3.9} width={16.2} height={16.2} rx={4.6} />
          <path d="M8.3 12.4 L11.05 15.1 L15.8 9.5" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 11. Report chart (page + rising bars) ────────────────────────────── */

export function ReportChartIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft fold accent */}
          <path d="M13.7 3.8 V8.3 H18.2 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M5.4 3.8 H13.7 L18.2 8.3 V20.2 H5.4 Z" />
          <path d="M13.7 3.8 V8.3 H18.2" />
          <path d="M8.6 17 V14.4" />
          <path d="M11.6 17 V11.9" />
          <path d="M14.6 17 V9.4" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 12. Megaphone (cone + handle + arcs) ────────────────────────────── */

export function MegaphoneIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft cone accent */}
          <path d="M7.9 9.6 H4.3 V14.4 H7.9 L16.9 19 V5 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M7.9 9.6 H4.3 V14.4 H7.9 L16.9 19 V5 Z" />
          <path d="M6.1 14.4 V19.3" />
          <path d="M19.3 9.7 C20 11 20 13 19.3 14.3" />
          <path d="M20.7 8.2 C21.8 10.4 21.8 13.6 20.7 15.8" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 13. File check (page + check) ────────────────────────────── */

export function FileCheckIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft fold accent */}
          <path d="M13.7 3.8 V8.3 H18.2 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M5.4 3.8 H13.7 L18.2 8.3 V20.2 H5.4 Z" />
          <path d="M13.7 3.8 V8.3 H18.2" />
          <path d="M8.4 14.3 L10.9 16.8 L15.4 11.3" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 14. Database (cylinder) ────────────────────────────── */

export function DatabaseIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft top-disc accent */}
          <ellipse cx={12} cy={6.1} rx={7.3} ry={2.9} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <ellipse cx={12} cy={6.1} rx={7.3} ry={2.9} />
          <path d="M4.7 6.1 V17.9 C4.7 19.5 8 20.8 12 20.8 C16 20.8 19.3 19.5 19.3 17.9 V6.1" />
          <path d="M4.7 12 C4.7 13.6 8 14.9 12 14.9 C16 14.9 19.3 13.6 19.3 12" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 15. Workflow (2 nodes + elbow + arrowhead) ────────────────────────────── */

export function WorkflowIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft end-node accent */}
          <rect x={15.1} y={15.1} width={5.1} height={5.1} rx={1.6} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <rect x={3.8} y={3.8} width={5.1} height={5.1} rx={1.6} />
          <rect x={15.1} y={15.1} width={5.1} height={5.1} rx={1.6} />
          <path d="M6.35 8.9 V12.6 H17.65 V15.1" />
          <path d="M16.3 13.7 L17.65 15.05 L19 13.7" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 16. Trend (axis + rising line + arrow) ────────────────────────────── */

export function TrendIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft area-under-line accent */}
          <path d="M6.6 16.4 L10.4 12.4 L13.1 14.6 L18.5 7.9 V20.1 H6.6 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M3.9 3.9 V20.1 H20.1" />
          <path d="M6.6 16.4 L10.4 12.4 L13.1 14.6 L18.5 7.9" />
          <path d="M14.6 7.9 H18.5 V11.8" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 17. Gauge (arc + needle + hub) ────────────────────────────── */

export function GaugeIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft hub accent */}
          <circle cx={12} cy={17.1} r={2.05} fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M3.9 17.1 A8.1 8.1 0 0 1 20.1 17.1" />
          <path d="M12 17.1 L16.3 10.9" />
          <circle cx={12} cy={17.1} r={2.05} />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}

/* ────────────────────────────── 18. Pulse (heartbeat) ────────────────────────────── */

export function PulseIcon(props: PremiumIconProps) {
  return (
    <PremiumIconFrame {...props}>
      {(uid) => (
        <LineGroup uid={uid}>
          {/* soft dip accent */}
          <path d="M11.5 12 L13.5 17.8 L16 12 Z" fill={`url(#${uid})`} fillOpacity={0.18} stroke="none" />
          <path d="M3.2 12 H7 L9.5 6.2 L13.5 17.8 L16 12 H19.2" />
          <circle cx={20.5} cy={12} r={1.2} fill={`url(#${uid})`} stroke="none" />
        </LineGroup>
      )}
    </PremiumIconFrame>
  );
}
