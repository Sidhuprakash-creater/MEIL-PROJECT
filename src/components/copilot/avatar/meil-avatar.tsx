"use client";

// MEIL Intelligence — Animated Ink Capsule Avatar (bloub-capsule-excite-encre-anime)
// Preserves unique per-instance mask IDs via useId(), CSS keyframe blinking
// cutout eyes (.mc-oeil0 / .mc-oeil1 in copilot.css), prefers-reduced-motion
// handling, and subtle state accents (searching ring / thinking pulse).

import { useEffect, useId, useState } from "react";
import type { AvatarState } from "@/lib/copilot/types";

export interface MEILAvatarProps {
  state: AvatarState;
  size?: number;
  className?: string;
  label?: string;
}

const CAPSULE_PATH =
  "M104.19 0.33C104.19 3.71 103.87 7.15 103.32 10.49C102.76 13.82 101.95 17.16 100.86 20.35C99.77 23.55 98.37 26.68 96.79 29.63C95.2 32.59 93.38 35.45 91.36 38.09C89.33 40.73 87.04 43.21 84.64 45.47C82.24 47.73 79.66 49.81 76.97 51.64C74.29 53.46 71.42 55.06 68.54 56.42C65.65 57.78 62.64 58.9 59.65 59.79C56.66 60.68 53.6 61.32 50.59 61.75C47.59 62.17 44.49 62.23 41.61 62.33C38.74 62.43 35.95 62.33 33.33 62.33C30.7 62.33 28.26 62.33 25.87 62.33C23.48 62.33 21.22 62.33 18.99 62.33C16.77 62.33 14.64 62.33 12.52 62.33C10.4 62.33 8.35 62.33 6.29 62.33C4.24 62.33 2.22 62.33 0.19 62.33C-1.85 62.33 -3.86 62.33 -5.92 62.33C-7.97 62.33 -10.03 62.33 -12.15 62.33C-14.26 62.33 -16.4 62.33 -18.62 62.33C-20.84 62.33 -23.11 62.33 -25.49 62.33C-27.88 62.33 -30.33 62.33 -32.95 62.33C-35.58 62.33 -38.36 62.43 -41.24 62.33C-44.12 62.23 -47.21 62.17 -50.22 61.75C-53.22 61.32 -56.28 60.68 -59.27 59.79C-62.26 58.9 -65.27 57.78 -68.16 56.42C-71.05 55.06 -73.91 53.46 -76.6 51.64C-79.28 49.81 -81.87 47.73 -84.27 45.47C-86.66 43.21 -88.96 40.73 -90.98 38.09C-93.01 35.45 -94.83 32.59 -96.41 29.63C-98 26.68 -99.4 23.55 -100.49 20.35C-101.57 17.16 -102.39 13.82 -102.94 10.49C-103.5 7.15 -103.81 3.71 -103.81 0.33C-103.81 -3.06 -103.5 -6.49 -102.94 -9.83C-102.39 -13.17 -101.57 -16.51 -100.49 -19.7C-99.4 -22.89 -98 -26.02 -96.41 -28.97C-94.83 -31.93 -93.01 -34.8 -90.98 -37.44C-88.96 -40.07 -86.66 -42.55 -84.27 -44.81C-81.87 -47.07 -79.28 -49.15 -76.6 -50.98C-73.91 -52.8 -71.05 -54.4 -68.16 -55.76C-65.27 -57.12 -62.26 -58.24 -59.27 -59.13C-56.28 -60.02 -53.22 -60.67 -50.22 -61.09C-47.21 -61.51 -44.12 -61.57 -41.24 -61.67C-38.36 -61.77 -35.58 -61.67 -32.95 -61.67C-30.33 -61.67 -27.88 -61.67 -25.49 -61.67C-23.11 -61.67 -20.84 -61.67 -18.62 -61.67C-16.4 -61.67 -14.26 -61.67 -12.15 -61.67C-10.03 -61.67 -7.97 -61.67 -5.92 -61.67C-3.86 -61.67 -1.85 -61.67 0.19 -61.67C2.22 -61.67 4.24 -61.67 6.29 -61.67C8.35 -61.67 10.4 -61.67 12.52 -61.67C14.64 -61.67 16.77 -61.67 18.99 -61.67C21.22 -61.67 23.48 -61.67 25.87 -61.67C28.26 -61.67 30.7 -61.67 33.33 -61.67C35.95 -61.67 38.74 -61.77 41.61 -61.67C44.49 -61.57 47.59 -61.51 50.59 -61.09C53.6 -60.67 56.66 -60.02 59.65 -59.13C62.64 -58.24 65.65 -57.12 68.54 -55.76C71.42 -54.4 74.29 -52.8 76.97 -50.98C79.66 -49.15 82.24 -47.07 84.64 -44.81C87.04 -42.55 89.33 -40.07 91.36 -37.44C93.38 -34.8 95.2 -31.93 96.79 -28.97C98.37 -26.02 99.77 -22.89 100.86 -19.7C101.95 -16.51 102.76 -13.17 103.32 -9.83C103.87 -6.49 104.19 -3.06 104.19 0.33Z";

const EYE_PATH =
  "M-20 -8A20 20 0 0 1 0 -28L0 -28A20 20 0 0 1 20 -8L20 8A20 20 0 0 1 0 28L0 28A20 20 0 0 1 -20 8Z";

export function MEILAvatar({ state, size = 96, className, label }: MEILAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const maskId = `bot-mask-${uid}`;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isBusy = state === "thinking" || state === "searching" || state === "generating";
  const isError = state === "error";
  const boxHeight = Math.round(size * 0.72);

  return (
    <div
      className={`mc-avatar-wrap ${isBusy ? "is-busy" : ""} ${isError ? "is-error" : ""} ${reducedMotion ? "is-reduced" : ""} ${className ?? ""}`}
      style={{ width: size, height: boxHeight, position: "relative", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      aria-label={label ?? `MEIL Intelligence avatar — ${state}`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="-125 -125 250 250"
        style={{ display: "block", overflow: "visible", width: size, height: size, flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-158" y="-158" width="316" height="316">
            <path d={CAPSULE_PATH} fill="#fff" />
            <path d={EYE_PATH} className="mc-oeil0" opacity="1" fill="#000" />
            <path d={EYE_PATH} className="mc-oeil1" opacity="1" fill="#000" />
          </mask>
        </defs>

        {isBusy && !reducedMotion && (
          <ellipse
            cx={0}
            cy={0}
            rx={116}
            ry={74}
            fill="none"
            stroke="#347deb"
            strokeOpacity={0.35}
            strokeWidth={3.5}
            strokeDasharray="34 22"
            className="mc-avatar-scan-ring"
          />
        )}

        <g opacity="1" className={isBusy && !reducedMotion ? "mc-avatar-bob" : ""}>
          <path d={CAPSULE_PATH} fill="#f9f9f9" />
          <g mask={`url(#${maskId})`}>
            <rect x="-158" y="-158" width="316" height="316" fill={isError ? "#991b1b" : "#0a0a0c"} />
          </g>
          <path d={CAPSULE_PATH} fill="none" className="mc-avatar-rim" />
        </g>
      </svg>
    </div>
  );
}
