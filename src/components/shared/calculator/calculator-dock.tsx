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
import { Calculator as CalculatorIcon, Moon, Sun, X } from "lucide-react";
import { CalculatorPanel } from "@/components/shared/calculator/calculator-panel";
import { CarbonCalculator } from "@/components/shared/calculator/carbon-calculator";
import { useCalculatorDock, CALCULATOR_OPEN_EVENT } from "@/lib/calculator/store";
import "./calculator.css";

const THEME_KEY = "meil-calculator-theme-v1";

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
          className="mcalc-rail"
          onClick={toggle}
          aria-label="Open calculator"
          aria-expanded={false}
        >
          <span className="mcalc-rail-icon">
            <CalculatorIcon size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="mcalc-rail-label">Calculator</span>
        </button>
      ) : null}

      {/* ── Expanded panel docked to the right edge ── */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="mcalc-panel"
            ref={panelRef}
            className="mcalc-panel"
            role="dialog"
            aria-label="Calculator"
            tabIndex={-1}
            initial={{ opacity: 0, x: 34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 34 }}
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
              {mode === "car" ? (
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
        ) : null}
      </AnimatePresence>
    </div>
  );

  return createPortal(dock, document.body);
}
