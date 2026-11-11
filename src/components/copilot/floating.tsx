"use client";

// MEIL Intelligence floating assistant — draggable launcher pill + themed panel.
// Shares the same store as the full-screen Intelligence view, so the
// conversation, theme, activity and avatar state continue seamlessly between surfaces.

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useCopilot } from "@/lib/copilot/store";
import { CALCULATOR_OPEN_EVENT } from "@/lib/calculator/store";
import { MEILAvatar } from "@/components/copilot/avatar/meil-avatar";
import { CopilotWorkspace } from "@/components/copilot/workspace";
import { BorderBeam } from "@/components/ui/border-beam";

/* ── Draggable launcher positioning ────────────────────────────────────────
   The pill can be dropped anywhere on screen; its position persists in
   localStorage. Default slot sits at the top of the page body, aligned with
   the dashboard's "Review queue" header action (below the app banner). */
const POS_KEY = "mc-launcher-pos-v1";
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag

function loadSavedPos(): { left: number; top: number } | null {
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left: number; top: number };
    if (typeof p?.left === "number" && typeof p?.top === "number") return p;
  } catch { /* ignore corrupt state */ }
  return null;
}

function defaultPos(pillW: number, pillH: number): { left: number; top: number } {
  // Top-right of the page body — beside / under the "Review queue" action,
  // just below the fixed app banner height.
  const left = Math.max(window.innerWidth - pillW - 26, 12);
  const top = Math.min(96, Math.max(12, window.innerHeight - pillH - 12));
  return { left, top };
}

function clampPos(left: number, top: number, pillW: number, pillH: number): { left: number; top: number } {
  return {
    left: Math.min(Math.max(left, 8), Math.max(window.innerWidth - pillW - 8, 8)),
    top: Math.min(Math.max(top, 8), Math.max(window.innerHeight - pillH - 8, 8)),
  };
}

export function CopilotFloating() {
  const open = useCopilot((s) => s.open);
  const setOpen = useCopilot((s) => s.setOpen);
  const fullscreen = useCopilot((s) => s.fullscreen);
  const setFullscreen = useCopilot((s) => s.setFullscreen);
  const avatarState = useCopilot((s) => s.avatarState);
  const streaming = useCopilot((s) => s.streaming);
  const theme = useCopilot((s) => s.theme);
  const hydrateTheme = useCopilot((s) => s.hydrateTheme);

  const pillRef = React.useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragState = React.useRef<{ startX: number; startY: number; baseLeft: number; baseTop: number; moved: boolean } | null>(null);

  React.useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  /* The calculator dock owns the right edge while it is open — stand the
     assistant down so the two surfaces never overlap. */
  React.useEffect(() => {
    const onCalculatorOpen = () => {
      setOpen(false);
      setFullscreen(false);
    };
    window.addEventListener(CALCULATOR_OPEN_EVENT, onCalculatorOpen);
    return () => window.removeEventListener(CALCULATOR_OPEN_EVENT, onCalculatorOpen);
  }, [setOpen, setFullscreen]);

  // Resolve the initial position after mount (needs window + pill metrics).
  React.useEffect(() => {
    if (pos) return;
    const rect = pillRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 197;
    const h = rect?.height ?? 41;
    setPos(loadSavedPos() ?? defaultPos(w, h));
  }, [pos]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos || e.button !== 0) return;
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, baseLeft: pos.left, baseTop: pos.top, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragState.current;
    const rect = pillRef.current?.getBoundingClientRect();
    if (!st || !pos) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!st.moved) {
      st.moved = true;
      setDragging(true);
    }
    const w = rect?.width ?? 197;
    const h = rect?.height ?? 41;
    setPos(clampPos(st.baseLeft + dx, st.baseTop + dy, w, h));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragState.current;
    dragState.current = null;
    setDragging(false);
    if (st && !st.moved) {
      setOpen(true); // a clean press without movement = open the assistant
      return;
    }
    if (st?.moved && pos) {
      try { window.localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* best effort */ }
    }
    void e;
  };

  const themeClass = theme === "dark" ? "mc-dark dark" : "";

  // When expanded to the full-screen surface from the panel, render the
  // fullscreen workspace variant (its own header offers "exit full screen").
  if (fullscreen) {
    return <CopilotWorkspace variant="fullscreen" />;
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="mc-panel"
            className={`mc-float-panel ${themeClass}`}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-label="MEIL Intelligence assistant"
          >
            <CopilotWorkspace variant="panel" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!open ? (
        <button
          ref={pillRef}
          className={`mc-float-launcher mc-draggable ${dragging ? "mc-dragging" : ""} ${themeClass}`}
          style={pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" } : { visibility: "hidden" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStart={(e) => e.preventDefault()}
          aria-label="Open MEIL Intelligence"
          title="Drag to move • click to open"
        >
          {/* Premium sheen — dark layer sweeping left → right */}
          <span className="mc-launcher-sheen" aria-hidden="true" />
          <BorderBeam
            size={48}
            duration={7}
            borderWidth={1.25}
            colorFrom={theme === "dark" ? "#93c5fd" : "#347deb"}
            colorTo={theme === "dark" ? "#a855f7" : "#8b5cf6"}
          />
          <MEILAvatar
            state={streaming ? "thinking" : avatarState === "idle" ? "excited" : avatarState}
            size={36}
          />
          <span>MEIL Intelligence</span>
          <Sparkles size={13} style={{ color: "var(--mc-purple, #8b5cf6)" }} />
        </button>
      ) : null}
    </>
  );
}
