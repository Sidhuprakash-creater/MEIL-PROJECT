"use client";

import dynamic from "next/dynamic";

const WorkspaceShell = dynamic(
  () => import("@/components/workspace/shell").then((m) => m.WorkspaceShell),
  { ssr: false, loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
        <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
          <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
            <span className="bg-gradient-to-br from-[#3a7bff] to-[#6a5bff] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
          </span>
          <div>
            <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
            <div className="text-xs text-[#66778d]">Loading Group Admin workspace…</div>
          </div>
        </div>
      </div>
    ) }
);

export default function Page() {
  return <WorkspaceShell />;
}
