"use client";

import { create } from "zustand";
import type { SmViewId } from "@/lib/sm/types";

export interface SmViewParams {
  detailId?: string;
  detailTab?: string;
  statusFilter?: string;
  level?: string;
  [key: string]: unknown;
}

export const REPORTING_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"] as const;

interface SmWorkspaceState {
  view: SmViewId;
  params: SmViewParams;
  reportingYear: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  unreadCount: number;
  queueCount: number;
  lastSyncedAt: string | null;
  live: boolean;
  navigate: (view: SmViewId, params?: SmViewParams) => void;
  openDetail: (view: SmViewId, id: string, tab?: string) => void;
  setReportingYear: (y: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setUnreadCount: (n: number) => void;
  setQueueCount: (n: number) => void;
  setLastSyncedAt: (iso: string) => void;
  setLive: (live: boolean) => void;
}

export const useSmWorkspace = create<SmWorkspaceState>((set) => ({
  view: "dashboard",
  params: {},
  reportingYear: "FY 2025-26",
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  unreadCount: 0,
  queueCount: 0,
  lastSyncedAt: null,
  live: true,
  navigate: (view, params = {}) => {
    set({ view, params, mobileNavOpen: false, commandOpen: false });
  },
  openDetail: (view, id, tab) => {
    set({ view, params: { detailId: id, detailTab: tab }, mobileNavOpen: false });
  },
  setReportingYear: (reportingYear) => set({ reportingYear }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setQueueCount: (queueCount) => set({ queueCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setLive: (live) => set({ live }),
}));

export const VIEW_META: Record<SmViewId, { title: string; description: string; group: string }> = {
  dashboard: { title: "Review Dashboard", description: "Live review command center for your subsidiary's reporting.", group: "Overview" },
  notifications: { title: "Notifications & Alerts", description: "Submissions, decisions, deadlines and Group announcements.", group: "Overview" },
  queue: { title: "Review Queue", description: "Reports currently awaiting your decision, prioritised by urgency.", group: "Report Review" },
  "reports-bu": { title: "BU Reports", description: "Directory of business-unit reporting records and their review state.", group: "Report Review" },
  "reports-project": { title: "Project Reports", description: "Directory of project / site submissions and their review state.", group: "Report Review" },
  evidence: { title: "Evidence Review", description: "Inspect supporting evidence attached to submitted reports.", group: "Report Review" },
  corrections: { title: "Corrections & Rejections", description: "Rejected reports, correction tracking and resubmissions.", group: "Report Review" },
  deadlines: { title: "Tasks & Deadlines", description: "Review deadlines, submission windows and correction tracking.", group: "Monitoring" },
  analytics: { title: "ESG Analytics", description: "Subsidiary-scoped reporting and review analytics.", group: "Monitoring" },
  activity: { title: "Activity & History", description: "Reporting activity feed and authoritative review audit trail.", group: "Monitoring" },
  profile: { title: "Profile & Preferences", description: "Your account, notification preferences and session security.", group: "Account" },
};

export const VIEW_ORDER: { group: string; views: SmViewId[] }[] = [
  { group: "Overview", views: ["dashboard", "notifications"] },
  { group: "Report Review", views: ["queue", "reports-bu", "reports-project", "evidence", "corrections"] },
  { group: "Monitoring", views: ["deadlines", "analytics", "activity"] },
  { group: "Account", views: ["profile"] },
];
