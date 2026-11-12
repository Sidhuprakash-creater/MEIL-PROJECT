"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Calculator dock state (zustand)

   One shared store so the calculator rail/panel stays consistent no matter
   which console renders it (group, subsidiary, manager, business unit,
   project admin, project user). It also lets the MEIL Intelligence floating
   assistant stand down while the calculator panel is open, so the two
   right-hand surfaces never overlap.
   ═══════════════════════════════════════════════════════════════════════════ */

import { create } from "zustand";

export type CalculatorMode = "std" | "sci" | "car" | "trv";
export type CalculatorSegment = "biz" | "per";

/**
 * Fired on `window` when the calculator panel opens. The MEIL Intelligence
 * floating assistant listens for it and stands down, so the two right-hand
 * surfaces are never on screen at the same time.
 */
export const CALCULATOR_OPEN_EVENT = "meil:calculator-open";

interface CalculatorDockState {
  /** Panel expanded (rail collapsed). */
  open: boolean;
  /** Active top-level mode: standard, scientific, travel or carbon footprint. */
  mode: CalculatorMode;
  /** Active carbon segment: business or personal footprint. */
  segment: CalculatorSegment;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setMode: (mode: CalculatorMode) => void;
  setSegment: (segment: CalculatorSegment) => void;
}

export const useCalculatorDock = create<CalculatorDockState>((set, get) => ({
  open: false,
  mode: "std",
  segment: "biz",
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  setMode: (mode) => set({ mode }),
  setSegment: (segment) => set({ segment }),
}));
