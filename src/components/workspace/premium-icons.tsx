"use client";

// ── iOS / SF Symbols–inspired premium icon set ──
// Design language (tuned for maximum visibility on glass):
//   • 2px rounded strokes — the SF Symbols "medium" weight, crisp from 16–28px
//   • solid single-color glyphs: `hue` prop or currentColor — no faint gradients,
//     no muddy dark stops, full-contrast line work on any background
//   • one solid accent shape per icon for the signature iOS two-tone feel
//   • rounded caps/joins everywhere, generous 24×24 grid with 2px optical padding

import * as React from "react";

export interface PremiumIconProps {
  className?: string;
  size?: number;
  hue?: string;
}

/** Shared SVG frame. `lines` = 2px stroke layer, `fills` = solid accent layer
 *  (rendered first so line work always sits crisply on top). */
function IosIcon({
  hue,
  className,
  size,
  fills,
  lines,
}: PremiumIconProps & {
  fills?: (c: string) => React.ReactNode;
  lines: (c: string) => React.ReactNode;
}) {
  const c = hue ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {fills && (
        <g fill={c} stroke="none">
          {fills(c)}
        </g>
      )}
      <g stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {lines(c)}
      </g>
    </svg>
  );
}

/* ────────────────────────────── 1. Org (building columns) ────────────────────────────── */

export function OrgIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M12 3.3 L20.1 8.6 H3.9 Z" />}
      lines={() => (
        <>
          <path d="M4.6 11.6 H19.4" />
          <path d="M7.1 11.6 V19.9" />
          <path d="M12 11.6 V19.9" />
          <path d="M16.9 11.6 V19.9" />
          <path d="M3.7 20.7 H20.3" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 2. Units (3 stacked layers) ────────────────────────────── */

export function UnitsIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M12 3.6 L20.4 8.1 L12 12.6 L3.6 8.1 Z" />}
      lines={() => (
        <>
          <path d="M20.4 12.4 L12 16.9 L3.6 12.4" />
          <path d="M20.4 16.6 L12 21.1 L3.6 16.6" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 3. Projects (two buildings) ────────────────────────────── */

export function ProjectsIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M4.7 20 V10.7 H11.3 V20 Z" />}
      lines={() => (
        <>
          <path d="M11.4 20.1 V4.4 H19.3 V20.1" />
          <path d="M14.2 8 H16.6" />
          <path d="M14.2 11 H16.6" />
          <path d="M14.2 14 H16.6" />
          <path d="M3.5 20.1 H20.5" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 4. People (two persons) ────────────────────────────── */

export function PeopleIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={9.2} cy={7.9} r={3.3} />}
      lines={() => (
        <>
          <path d="M3.4 20.4 C3.4 15.9 6 13.6 9.2 13.6 C12.4 13.6 15 15.9 15 20.4" />
          <path d="M16.3 4.8 A3.3 3.3 0 0 1 16.3 11.4" />
          <path d="M17.2 13.9 C19.4 14.9 20.6 17 20.6 20.4" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 5. Files (two offset pages) ────────────────────────────── */

export function FilesIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M9.9 8.8 L13.9 12.8 H9.9 Z" />}
      lines={() => (
        <>
          <path d="M8.6 8.9 V3.8 H14.9 L19.3 8.2 V14.3 H15.2" />
          <path d="M3.7 8.8 H9.9 L13.9 12.8 V20.3 H3.7 Z" />
          <path d="M9.9 8.8 V12.8 H13.9" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 6. Check seal (approval badge) ────────────────────────────── */

export function CheckSealIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      lines={() => (
        <>
          <circle cx={12} cy={12} r={8.7} />
          <path d="M8.4 12.3 L11 14.9 L15.7 10.2" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 7. Hourglass (tasks) ────────────────────────────── */

export function HourglassIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={(c) => (
        <>
          <path d="M9.5 7.3 L12 10.4 L14.5 7.3 Z" />
          <path d="M9.3 18.6 L12 15.5 L14.7 18.6 Z" />
          <circle cx={12} cy={13.2} r={0.95} />
        </>
      )}
      lines={() => (
        <>
          <path d="M6.4 3.6 H17.6" />
          <path d="M6.4 20.4 H17.6" />
          <path d="M7.7 3.6 C7.7 8.8 12 10.4 12 12 C12 13.6 16.3 15.2 16.3 20.4" />
          <path d="M16.3 3.6 C16.3 8.8 12 10.4 12 12 C12 13.6 7.7 15.2 7.7 20.4" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 8. Alarm alert (deadlines / notifications) ────────────────────────────── */

export function AlarmAlertIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={19.9} cy={19.7} r={2} />}
      lines={() => (
        <>
          <circle cx={11.7} cy={12.9} r={7.1} />
          <path d="M5.9 4.7 L4 6.6" />
          <path d="M17.5 4.7 L19.4 6.6" />
          <path d="M11.7 9.3 V12.9 L14.5 14.6" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 9. User plus ────────────────────────────── */

export function UserPlusIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={9.4} cy={7.8} r={3.3} />}
      lines={() => (
        <>
          <path d="M3.5 20.4 C3.5 16 6 13.7 9.4 13.7 C12.8 13.7 15.3 16 15.3 20.4" />
          <path d="M18.7 6.2 V12.4" />
          <path d="M15.6 9.3 H21.8" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 10. Task check ────────────────────────────── */

export function TaskCheckIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      lines={() => (
        <>
          <rect x={4} y={4} width={16} height={16} rx={4.6} />
          <path d="M8.4 12.4 L11.1 15.1 L15.7 10.4" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 11. Report chart (page + bars) ────────────────────────────── */

export function ReportChartIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M13.5 3.9 L18.3 8.7 H13.5 Z" />}
      lines={() => (
        <>
          <path d="M5.6 3.9 H13.5 L18.3 8.7 V20.1 H5.6 Z" />
          <path d="M13.5 3.9 V8.7 H18.3" />
          <path d="M8.7 16.9 V14.3" />
          <path d="M11.7 16.9 V11.6" />
          <path d="M14.7 16.9 V9.2" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 12. Megaphone ────────────────────────────── */

export function MegaphoneIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M7.9 9.6 H4.3 V14.4 H7.9 L16.9 19.1 V4.9 Z" />}
      lines={() => (
        <>
          <path d="M7.9 9.6 H4.3 V14.4 H7.9 L16.9 19.1 V4.9 Z" />
          <path d="M6.1 14.4 V19.2" />
          <path d="M19.2 9.7 C19.9 11 19.9 13 19.2 14.3" />
          <path d="M20.7 8.2 C21.8 10.4 21.8 13.6 20.7 15.8" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 13. File check ────────────────────────────── */

export function FileCheckIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <path d="M13.5 3.9 L18.3 8.7 H13.5 Z" />}
      lines={() => (
        <>
          <path d="M5.6 3.9 H13.5 L18.3 8.7 V20.1 H5.6 Z" />
          <path d="M13.5 3.9 V8.7 H18.3" />
          <path d="M8.5 14.4 L11 16.9 L15.4 12.1" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 14. Database (cylinder) ────────────────────────────── */

export function DatabaseIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <ellipse cx={12} cy={6.1} rx={7.4} ry={2.8} />}
      lines={() => (
        <>
          <path d="M4.6 6.1 V17.9 C4.6 19.5 7.9 20.8 12 20.8 C16.1 20.8 19.4 19.5 19.4 17.9 V6.1" />
          <path d="M4.6 12 C4.6 13.6 7.9 14.9 12 14.9 C16.1 14.9 19.4 13.6 19.4 12" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 15. Workflow (two nodes + elbow) ────────────────────────────── */

export function WorkflowIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <rect x={15.2} y={15.2} width={5} height={5} rx={1.5} />}
      lines={() => (
        <>
          <rect x={3.8} y={3.8} width={5} height={5} rx={1.5} />
          <path d="M6.3 8.8 V12.4 H17.7 V15.2" />
          <path d="M16.4 13.9 L17.7 15.2 L19 13.9" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 16. Trend (axis + rising line) ────────────────────────────── */

export function TrendIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      lines={() => (
        <>
          <path d="M4.2 3.9 V20.1 H20.1" />
          <path d="M6.8 16.4 L10.4 12.4 L13.1 14.6 L18.6 8.1" />
          <path d="M14.8 8.1 H18.6 V11.9" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 17. Gauge ────────────────────────────── */

export function GaugeIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={12} cy={16.9} r={2.1} />}
      lines={() => (
        <>
          <path d="M4 16.9 A8 8 0 1 1 20 16.9" />
          <path d="M12 16.9 L16.2 10.8" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 18. Pulse (heartbeat) ────────────────────────────── */

export function PulseIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={20.3} cy={12} r={1.5} />}
      lines={() => (
        <>
          <path d="M3.4 12 H6.9 L9.4 6.3 L13.3 17.7 L15.8 12 H18.6" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 19. Bell ────────────────────────────── */

export function BellIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <circle cx={12} cy={20.4} r={1.3} />}
      lines={() => (
        <>
          <path d="M12 3.5 C8.8 3.5 6.7 5.9 6.7 9.1 C6.7 13.5 5.1 15.2 4.3 16.4 C3.9 17 4.3 17.9 5.1 17.9 H18.9 C19.7 17.9 20.1 17 19.7 16.4 C18.9 15.2 17.3 13.5 17.3 9.1 C17.3 5.9 15.2 3.5 12 3.5 Z" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 20. Network (org hierarchy tree) ────────────────────────────── */

export function NetworkIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => <rect x={9.3} y={3.2} width={5.4} height={5.4} rx={1.6} />}
      lines={() => (
        <>
          <rect x={3.3} y={15.4} width={5.4} height={5.4} rx={1.6} />
          <rect x={15.3} y={15.4} width={5.4} height={5.4} rx={1.6} />
          <path d="M6 15.4 V11.6 H18 V15.4" />
          <path d="M12 8.6 V11.6" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 21. Shield (half-filled, roles) ────────────────────────────── */

export function ShieldIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => (
        <path d="M12 3.3 C9.7 4.8 7.5 5.6 5.2 5.8 C5.2 12.5 7.7 17.7 12 20.7 Z" />
      )}
      lines={() => (
        <>
          <path d="M12 3.3 C9.7 4.8 7.5 5.6 5.2 5.8 C5.2 12.5 7.7 17.7 12 20.7 C16.3 17.7 18.8 12.5 18.8 5.8 C16.5 5.6 14.3 4.8 12 3.3 Z" />
        </>
      )}
    />
  );
}

/* ────────────────────────────── 22. Sliders (settings, iOS style) ────────────────────────────── */

export function GearIcon(props: PremiumIconProps) {
  return (
    <IosIcon
      {...props}
      fills={() => (
        <>
          <circle cx={15.2} cy={6.9} r={2.3} />
          <circle cx={8.4} cy={12} r={2.3} />
          <circle cx={16.4} cy={17.1} r={2.3} />
        </>
      )}
      lines={() => (
        <>
          <path d="M3.6 6.9 H12.6" />
          <path d="M17.9 6.9 H20.4" />
          <path d="M3.6 12 H5.8" />
          <path d="M11.1 12 H20.4" />
          <path d="M3.6 17.1 H13.8" />
          <path d="M19 17.1 H20.4" />
        </>
      )}
    />
  );
}
