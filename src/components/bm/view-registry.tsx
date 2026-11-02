"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BmViewId } from "@/lib/bm/types";

export type BmViewComponent = ComponentType;

const loading = () => (
  <div className="glass-bum glass-sheen flex h-64 items-center justify-center rounded-3xl">
    <span className="text-sm text-[color:var(--ink-faint)]">Loading module…</span>
  </div>
);

/* All 11 BU Manager screens — each is a lazily-loaded client view. */
export const BM_VIEWS: Record<BmViewId, BmViewComponent> = {
  dashboard: dynamic(() => import("@/components/bm/views/dashboard"), { ssr: false, loading }),
  notifications: dynamic(() => import("@/components/bm/views/notifications"), { ssr: false, loading }),
  queue: dynamic(() => import("@/components/bm/views/queue"), { ssr: false, loading }),
  submissions: dynamic(() => import("@/components/bm/views/submissions"), { ssr: false, loading }),
  reports: dynamic(() => import("@/components/bm/views/reports"), { ssr: false, loading }),
  evidence: dynamic(() => import("@/components/bm/views/evidence"), { ssr: false, loading }),
  corrections: dynamic(() => import("@/components/bm/views/corrections"), { ssr: false, loading }),
  tasks: dynamic(() => import("@/components/bm/views/tasks"), { ssr: false, loading }),
  validation: dynamic(() => import("@/components/bm/views/validation"), { ssr: false, loading }),
  analytics: dynamic(() => import("@/components/bm/views/analytics"), { ssr: false, loading }),
  activity: dynamic(() => import("@/components/bm/views/activity"), { ssr: false, loading }),
};
