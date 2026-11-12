"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Calculator dock

   A right-edge vertical rail that expands into a docked calculator panel.
   Rendered through a portal on <body> so it docks to the viewport edge
   identically in every console (group, subsidiary, manager, business unit,
   project admin, project user) regardless of each shell's own layout,
   scroll containers or `backdrop-filter` ancestors.

   The MEIL Intelligence floating assistant steps aside while the calculator
   panel is open so the two right-hand surfaces never overlap.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator as CalculatorIcon, GripVertical, Moon, Sun, X } from "lucide-react";
import { CalculatorPanel } from "@/components/shared/calculator/calculator-panel";
import { CarbonCalculator } from "@/components/shared/calculator/carbon-calculator";
import { TravelCalculator } from "@/components/shared/calculator/travel-calculator";
import { useCalculatorDock, CALCULATOR_OPEN_EVENT, CALCULATOR_RAIL_MOVED_EVENT } from "@/lib/calculator/store";
import "./calculator.css";

const THEME_KEY = "meil-calculator-theme-v1";

/* ── Draggable rail positioning ─────────────────────────────────────────────
   The collapsed calculator rail can be dropped anywhere on screen, exactly
   like the MEIL Intelligence pill. The position persists in localStorage so
   it stays where the user put it. */
const RAIL_POS_KEY = "meil-calculator-rail-pos-v1";
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag

function loadRailPos(): { left: number; top: number } | null {
  try {
    const raw = window.localStorage.getItem(RAIL_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left: number; top: number };
    if (typeof p?.left === "number" && typeof p?.top === "number") return p;
  } catch {
    /* ignore corrupt state */
  }
  return null;
}

function clampRailPos(left: number, top: number, w: number, h: number) {
  return {
    left: Math.min(Math.max(left, 4), Math.max(window.innerWidth - w - 4, 4)),
    top: Math.min(Math.max(top, 4), Math.max(window.innerHeight - h - 4, 4)),
  };
}

export function CalculatorDock() {
  const open = useCalculatorDock((s) => s.open);
  const setOpen = useCalculatorDock((s) => s.setOpen);
  const toggle = useCalculatorDock((s) => s.toggle);
  const mode = useCalculatorDock((s) => s.mode);
  const setMode = useCalculatorDock((s) => s.setMode);
  const segment = useCalculatorDock((s) => s.segment);
  const setSegment = useCalculatorDock((s) => s.setSegment);

  /* The dock portals into <body>, so it must not render on the server.
     `useSyncExternalStore` gives a hydration-safe "am I on the client?" flag
     without a setState-in-effect. */
  const mounted = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore storage failures */
    }
    return "light";
  });

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const railRef = React.useRef<HTMLButtonElement | null>(null);
  const [railPos, setRailPos] = React.useState<{ left: number; top: number } | null>(null);
  const [railDragging, setRailDragging] = React.useState(false);
  const railDrag = React.useRef<{ startX: number; startY: number; baseLeft: number; baseTop: number; moved: boolean } | null>(null);

  /* Resolve the rail's initial position after mount (needs window metrics). */
  React.useEffect(() => {
    if (railPos) return;
    const rect = railRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 34;
    const h = rect?.height ?? 150;
    const saved = loadRailPos();
    setRailPos(
      saved ?? {
        left: Math.max(window.innerWidth - w, 4),
        top: Math.max(window.innerHeight * 0.68 - h / 2, 80),
      }
    );
  }, [railPos]);

  const onRailPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!railPos || e.button !== 0) return;
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    railDrag.current = { startX: e.clientX, startY: e.clientY, baseLeft: railPos.left, baseTop: railPos.top, moved: false };
  };

  const onRailPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = railDrag.current;
    if (!st || !railPos) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!st.moved) {
      st.moved = true;
      setRailDragging(true);
    }
    const rect = railRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 34;
    const h = rect?.height ?? 150;
    setRailPos(clampRailPos(st.baseLeft + dx, st.baseTop + dy, w, h));
  };

  const endRailDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = railDrag.current;
    railDrag.current = null;
    setRailDragging(false);
    if (st && !st.moved) {
      toggle(); // a clean press without movement = open the calculator
      return;
    }
    if (st?.moved && railPos) {
      try {
        window.localStorage.setItem(RAIL_POS_KEY, JSON.stringify(railPos));
      } catch {
        /* best effort */
      }
      /* Tell the assistant pill where the rail landed so the two surfaces
         never end up stacked on each other. */
      window.dispatchEvent(new CustomEvent(CALCULATOR_RAIL_MOVED_EVENT, { detail: railPos }));
    }
    void e;
  };

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  }, []);

  /* Escape closes the panel. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  /* Move focus into the panel when it opens, and tell the MEIL Intelligence
     assistant to stand down so both right-hand surfaces never overlap. */
  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    window.dispatchEvent(new CustomEvent(CALCULATOR_OPEN_EVENT));
  }, [open]);

  if (!mounted) return null;

  const dock = (
    <div className="mcalc" data-mcalc-theme={theme} data-mcalc-mode={mode}>
      {/* ── Collapsed rail: vertical handle flush to the right edge ── */}
      {!open ? (
        <button
          type="button"
          ref={railRef}
          className={`mcalc-rail${railDragging ? " mcalc-rail-dragging" : ""}`}
          style={
            railPos
              ? { left: railPos.left, top: railPos.top, right: "auto", transform: "none" }
              : { visibility: "hidden" }
          }
          onPointerDown={onRailPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={endRailDrag}
          onPointerCancel={endRailDrag}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
          aria-label="Open calculator — drag to move"
          aria-expanded={false}
          title="Drag to move • click to open"
        >
          <span className="mcalc-rail-icon">
            <CalculatorIcon size={14} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="mcalc-rail-label">Calculator</span>
          <span className="mcalc-rail-grip" aria-hidden="true">
            <GripVertical size={11} strokeWidth={2.2} />
          </span>
        </button>
      ) : null}

      {/* ── Expanded panel docked cleanly to the right edge with dismiss backdrop ── */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="mcalc-backdrop"
              className="mcalc-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              key="mcalc-panel"
              ref={panelRef}
              className="mcalc-panel"
              role="dialog"
              aria-label="Calculator"
              tabIndex={-1}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
            <div className="mcalc-head">
              <div className="mcalc-tabs" role="tablist" aria-label="Calculator mode">
                <button
                  type="button"
                  role="tab"
                  className="mcalc-tab"
                  aria-selected={mode === "std"}
                  onClick={() => setMode("std")}
                >
                  Standard
                </button>
                <button
                  type="button"
                  role="tab"
                  className="mcalc-tab"
                  aria-selected={mode === "sci"}
                  onClick={() => setMode("sci")}
                >
                  Scientific
                </button>
                <button
                  type="button"
                  role="tab"
                  className="mcalc-tab"
                  aria-selected={mode === "trv"}
                  onClick={() => setMode("trv")}
                >
                  Travel
                </button>
                <button
                  type="button"
                  role="tab"
                  className="mcalc-tab"
                  aria-selected={mode === "car"}
                  onClick={() => setMode("car")}
                >
                  Carbon
                </button>
              </div>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="mcalc-icon-btn"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to night mode"}
                title={theme === "dark" ? "Light mode" : "Night mode"}
              >
                {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="mcalc-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close calculator"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="mcalc-body">
              {mode === "trv" ? (
                <TravelCalculator />
              ) : mode === "car" ? (
                <>
                  <div className="mcalc-seg" role="group" aria-label="Footprint segment">
                    <button
                      type="button"
                      className="mcalc-chip"
                      aria-pressed={segment === "biz"}
                      onClick={() => setSegment("biz")}
                    >
                      Business
                    </button>
                    <button
                      type="button"
                      className="mcalc-chip"
                      aria-pressed={segment === "per"}
                      onClick={() => setSegment("per")}
                    >
                      Personal
                    </button>
                  </div>
                  <CarbonCalculator segment={segment} />
                </>
              ) : (
                <CalculatorPanel scientific={mode === "sci"} />
              )}
            </div>
          </motion.div>
        </>
      ) : null}
      </AnimatePresence>
    </div>
  );

  return createPortal(dock, document.body);
}
