"use client";

// Intelligence view — MEIL Intelligence embedded as a full module inside the
// Group Admin workspace. Supports synchronized light & dark surfaces.

import * as React from "react";
import { CopilotWorkspace } from "@/components/copilot/workspace";
import { useCopilot } from "@/lib/copilot/store";

export default function IntelligenceView() {
  const theme = useCopilot((s) => s.theme);
  const hydrateTheme = useCopilot((s) => s.hydrateTheme);

  React.useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  return (
    <div
      className={`mc-intelligence-frame ${theme === "dark" ? "mc-dark dark" : ""}`}
      style={{ height: "calc(100dvh - 132px)", minHeight: 560, borderRadius: 24, overflow: "hidden", padding: 0 }}
    >
      <CopilotWorkspace variant="fullscreen" />
    </div>
  );
}
