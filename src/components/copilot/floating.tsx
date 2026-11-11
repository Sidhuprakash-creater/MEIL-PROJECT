"use client";

// MEIL Intelligence floating assistant — launcher pill + themed panel.
// Shares the same store as the full-screen Intelligence view, so the
// conversation, theme, activity and avatar state continue seamlessly between surfaces.

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useCopilot } from "@/lib/copilot/store";
import { MEILAvatar } from "@/components/copilot/avatar/meil-avatar";
import { CopilotWorkspace } from "@/components/copilot/workspace";
import { BorderBeam } from "@/components/ui/border-beam";

export function CopilotFloating() {
  const open = useCopilot((s) => s.open);
  const setOpen = useCopilot((s) => s.setOpen);
  const fullscreen = useCopilot((s) => s.fullscreen);
  const avatarState = useCopilot((s) => s.avatarState);
  const streaming = useCopilot((s) => s.streaming);
  const theme = useCopilot((s) => s.theme);
  const hydrateTheme = useCopilot((s) => s.hydrateTheme);

  React.useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

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
          className={`mc-float-launcher ${themeClass}`}
          onClick={() => setOpen(true)}
          aria-label="Open MEIL Intelligence"
        >
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
