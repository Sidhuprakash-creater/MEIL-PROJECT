"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BaViewId } from "@/lib/ba/types";

export type BaViewComponent = ComponentType;

const loading = () => (
  <div className="glass-ba glass-sheen flex h-64 items-center justify-center rounded-3xl">
    <span className="text-sm text-[color:var(--ink-faint)]">Loading module…</span>
  </div>
);

/* All 16 primary screens — each is a lazily-loaded client view. */
export const BA_VIEWS: Record<BaViewId, BaViewComponent> = {
  dashboard: dynamic(() => import("@/components/ba/views/dashboard"), { ssr: false, loading }),
  notifications: dynamic(() => import("@/components/ba/views/notifications"), { ssr: false, loading }),
  users: dynamic(() => import("@/components/ba/views/users"), { ssr: false, loading }),
  roles: dynamic(() => import("@/components/ba/views/roles"), { ssr: false, loading }),
  projects: dynamic(() => import("@/components/ba/views/projects"), { ssr: false, loading }),
  timelines: dynamic(() => import("@/components/ba/views/timelines"), { ssr: false, loading }),
  submissions: dynamic(() => import("@/components/ba/views/submissions"), { ssr: false, loading }),
  monitoring: dynamic(() => import("@/components/ba/views/monitoring"), { ssr: false, loading }),
  evidence: dynamic(() => import("@/components/ba/views/evidence"), { ssr: false, loading }),
  tasks: dynamic(() => import("@/components/ba/views/tasks"), { ssr: false, loading }),
  comms: dynamic(() => import("@/components/ba/views/comms"), { ssr: false, loading }),
  validation: dynamic(() => import("@/components/ba/views/validation"), { ssr: false, loading }),
  esg: dynamic(() => import("@/components/ba/views/esg"), { ssr: false, loading }),
  analytics: dynamic(() => import("@/components/ba/views/analytics"), { ssr: false, loading }),
  activity: dynamic(() => import("@/components/ba/views/activity"), { ssr: false, loading }),
  settings: dynamic(() => import("@/components/ba/views/settings"), { ssr: false, loading }),
};
