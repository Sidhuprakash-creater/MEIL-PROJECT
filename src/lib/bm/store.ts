"use client";

import { create } from "zustand";
import type { BmViewId } from "@/lib/bm/types";

export interface BmViewParams {
  detailId?: string;
  detailTab?: string;
  statusFilter?: string;
  level?: string;
  openId?: string;
  [key: string]: unknown;
}

export const REPORTING_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"] as const;

interface BmWorkspaceState {
  view: BmViewId;
  params: BmViewParams;
  reportingYear: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  unreadCount: number;
  queueCount: number;
  projectReportsCount: number;
  lastSyncedAt: string | null;
  live: boolean;
  navigate: (view: BmViewId, params?: BmViewParams) => void;
  openDetail: (view: BmViewId, id: string, tab?: string) => void;
  setReportingYear: (y: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setUnreadCount: (n: number) => void;
  setQueueCount: (n: number) => void;
  setProjectReportsCount: (n: number) => void;
  setLastSyncedAt: (iso: string) => void;
  setLive: (live: boolean) => void;
}

export const useBmWorkspace = create<BmWorkspaceState>((set) => ({
  view: "dashboard",
  params: {},
  reportingYear: "FY 2025-26",
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  unreadCount: 0,
  queueCount: 0,
  projectReportsCount: 0,
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
  setProjectReportsCount: (projectReportsCount) => set({ projectReportsCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setLive: (live) => set({ live }),
}));

export const VIEW_META: Record<BmViewId, { title: string; description: string; group: string }> = {
  dashboard: { title: "ESG Review Studio", description: "Live review command center for your business unit's reporting.", group: "Overview" },
  notifications: { title: "Notifications & Alerts", description: "Submissions, decisions, deadlines and subsidiary announcements.", group: "Overview" },
  queue: { title: "Review Queue", description: "Reports currently awaiting your decision, prioritised by urgency.", group: "Report Review" },
  submissions: { title: "Data Entry Submissions", description: "Incoming project submissions with version and evidence context.", group: "Report Review" },
  reports: { title: "Project Reports", description: "Directory of project / site reports and their review state.", group: "Report Review" },
  evidence: { title: "Evidence Review", description: "Inspect supporting evidence attached to submitted reports.", group: "Report Review" },
  corrections: { title: "Corrections & Rejections", description: "Rejected reports, correction tracking and resubmissions.", group: "Report Review" },
  tasks: { title: "Tasks & Deadlines", description: "Review deadlines, correction follow-ups and task tracking.", group: "Monitoring" },
  validation: { title: "Data Validation", description: "Validation issues, rule violations and recommended corrections.", group: "Monitoring" },
  analytics: { title: "ESG Analytics", description: "BU-scoped reporting and review analytics.", group: "Monitoring" },
  activity: { title: "Activity & History", description: "Reporting activity feed and authoritative review audit trail.", group: "Monitoring" },
};

export const VIEW_ORDER: { group: string; views: BmViewId[] }[] = [
  { group: "Overview", views: ["dashboard", "notifications"] },
  { group: "Report Review", views: ["queue", "submissions", "reports", "evidence", "corrections"] },
  { group: "Monitoring", views: ["tasks", "validation", "analytics", "activity"] },
];
