"use client";

// View registry — maps store view ids to lazy-loaded view components (cached).
import { lazy } from "react";
import type { ComponentType } from "react";
import type { ViewId } from "@/lib/esg/types";

export type ViewComponent = ComponentType<Record<string, never>>;

const loaders: Record<ViewId, () => Promise<{ default: ViewComponent }>> = {
  dashboard: () => import("./views/dashboard"),
  notifications: () => import("./views/notifications"),
  hierarchy: () => import("./views/hierarchy"),
  subsidiaries: () => import("./views/subsidiaries"),
  units: () => import("./views/units"),
  projects: () => import("./views/projects"),
  users: () => import("./views/users"),
  roles: () => import("./views/roles"),
  submissions: () => import("./views/submissions"),
  approvals: () => import("./views/approvals"),
  tasks: () => import("./views/tasks"),
  comms: () => import("./views/comms"),
  brsr: () => import("./views/brsr"),
  brsrChecklist: () => import("./views/brsr-checklist"),
  consolidation: () => import("./views/consolidation"),
  analytics: () => import("./views/analytics"),
  intelligence: () => import("./views/intelligence"),
  activity: () => import("./views/activity"),
  audit: () => import("./views/audit"),
  settings: () => import("./views/settings"),
};

const cache = new Map<ViewId, ViewComponent>();

function build(view: ViewId): ViewComponent {
  let c = cache.get(view);
  if (!c) {
    c = lazy(loaders[view] ?? loaders.dashboard) as ViewComponent;
    cache.set(view, c);
  }
  return c;
}

/** Pre-resolved lazy components — created once at module scope (stable identity). */
export const VIEW_COMPONENTS: Record<ViewId, ViewComponent> = {
  dashboard: build("dashboard"),
  notifications: build("notifications"),
  hierarchy: build("hierarchy"),
  subsidiaries: build("subsidiaries"),
  units: build("units"),
  projects: build("projects"),
  users: build("users"),
  roles: build("roles"),
  submissions: build("submissions"),
  approvals: build("approvals"),
  tasks: build("tasks"),
  comms: build("comms"),
  brsr: build("brsr"),
  brsrChecklist: build("brsrChecklist"),
  consolidation: build("consolidation"),
  analytics: build("analytics"),
  intelligence: build("intelligence"),
  activity: build("activity"),
  audit: build("audit"),
  settings: build("settings"),
};

export function getViewComponent(view: ViewId): ViewComponent {
  return VIEW_COMPONENTS[view] ?? build(view);
}
