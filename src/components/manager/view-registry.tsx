"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SmViewId } from "@/lib/sm/types";

export type SmViewComponent = ComponentType;

const loading = () => (
  <div className="glass glass-sheen flex h-64 items-center justify-center rounded-3xl">
    <span className="text-sm text-[color:var(--ink-faint)]">Loading module…</span>
  </div>
);

/* All 11 primary screens — each is a lazily-loaded client view. */
export const SM_VIEWS: Record<SmViewId, SmViewComponent> = {
  dashboard: dynamic(() => import("@/components/manager/views/dashboard"), { ssr: false, loading }),
  notifications: dynamic(() => import("@/components/manager/views/notifications"), { ssr: false, loading }),
  queue: dynamic(() => import("@/components/manager/views/queue"), { ssr: false, loading }),
  "reports-bu": dynamic(() => import("@/components/manager/views/reports").then((m) => m.BuReportsView), { ssr: false, loading }),
  "reports-project": dynamic(() => import("@/components/manager/views/reports").then((m) => m.ProjectReportsView), { ssr: false, loading }),
  evidence: dynamic(() => import("@/components/manager/views/evidence"), { ssr: false, loading }),
  corrections: dynamic(() => import("@/components/manager/views/corrections"), { ssr: false, loading }),
  deadlines: dynamic(() => import("@/components/manager/views/deadlines"), { ssr: false, loading }),
  analytics: dynamic(() => import("@/components/manager/views/analytics"), { ssr: false, loading }),
  activity: dynamic(() => import("@/components/manager/views/activity"), { ssr: false, loading }),
  profile: dynamic(() => import("@/components/manager/views/profile"), { ssr: false, loading }),
};
