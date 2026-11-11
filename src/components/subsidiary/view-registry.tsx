"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SaViewId } from "@/lib/sa/types";

export type SaViewComponent = ComponentType;

const loading = () => (
  <div className="glass glass-sheen flex h-64 items-center justify-center rounded-3xl">
    <span className="text-sm text-[color:var(--ink-faint)]">Loading module…</span>
  </div>
);

/* All 16 primary screens — each is a lazily-loaded client view. */
export const SA_VIEWS: Record<SaViewId, SaViewComponent> = {
  dashboard: dynamic(() => import("@/components/subsidiary/views/dashboard"), { ssr: false, loading }),
  notifications: dynamic(() => import("@/components/subsidiary/views/notifications"), { ssr: false, loading }),
  units: dynamic(() => import("@/components/subsidiary/views/units"), { ssr: false, loading }),
  projects: dynamic(() => import("@/components/subsidiary/views/projects"), { ssr: false, loading }),
  users: dynamic(() => import("@/components/subsidiary/views/users"), { ssr: false, loading }),
  roles: dynamic(() => import("@/components/subsidiary/views/roles"), { ssr: false, loading }),
  timelines: dynamic(() => import("@/components/subsidiary/views/timelines"), { ssr: false, loading }),
  submissions: dynamic(() => import("@/components/subsidiary/views/submissions"), { ssr: false, loading }),
  monitoring: dynamic(() => import("@/components/subsidiary/views/monitoring"), { ssr: false, loading }),
  evidence: dynamic(() => import("@/components/subsidiary/views/evidence"), { ssr: false, loading }),
  comms: dynamic(() => import("@/components/subsidiary/views/comms"), { ssr: false, loading }),
  esg: dynamic(() => import("@/components/subsidiary/views/esg"), { ssr: false, loading }),
  brsrData: dynamic(() => import("@/components/subsidiary/views/brsr-data"), { ssr: false, loading }),
  verification: dynamic(() => import("@/components/subsidiary/views/verification"), { ssr: false, loading }),
  validation: dynamic(() => import("@/components/subsidiary/views/validation"), { ssr: false, loading }),
  analytics: dynamic(() => import("@/components/subsidiary/views/analytics"), { ssr: false, loading }),
  activity: dynamic(() => import("@/components/subsidiary/views/activity"), { ssr: false, loading }),
  settings: dynamic(() => import("@/components/subsidiary/views/settings"), { ssr: false, loading }),
};
