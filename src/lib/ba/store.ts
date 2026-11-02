"use client";

import { create } from "zustand";
import type { BaViewId } from "@/lib/ba/types";

export interface BaViewParams {
  detailId?: string;
  detailTab?: string;
  statusFilter?: string;
  level?: string;
  create?: number;
  openId?: string;
  [key: string]: unknown;
}

export const REPORTING_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"] as const;

interface BaWorkspaceState {
  view: BaViewId;
  params: BaViewParams;
  reportingYear: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  unreadCount: number;
  lastSyncedAt: string | null;
  live: boolean;
  navigate: (view: BaViewId, params?: BaViewParams) => void;
  openDetail: (view: BaViewId, id: string, tab?: string) => void;
  setReportingYear: (y: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setUnreadCount: (n: number) => void;
  setLastSyncedAt: (iso: string) => void;
  setLive: (live: boolean) => void;
}

export const useBaWorkspace = create<BaWorkspaceState>((set) => ({
  view: "dashboard",
  params: {},
  reportingYear: "FY 2025-26",
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  unreadCount: 0,
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
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setLive: (live) => set({ live }),
}));

export const VIEW_META: Record<BaViewId, { title: string; description: string; group: string }> = {
  dashboard: { title: "BU Operations Command", description: "Live overview of your business unit's reporting, projects and deadlines.", group: "Overview" },
  notifications: { title: "Notifications & Alerts", description: "Submissions, reviews, deadlines, validation and subsidiary announcements.", group: "Overview" },
  users: { title: "User Management", description: "BU-level users, roles and account controls within your scope.", group: "Organization & Access" },
  roles: { title: "Roles & Assignments", description: "Role definitions and project assignment matrix for BU users.", group: "Organization & Access" },
  projects: { title: "Project Directory", description: "Projects and sites assigned to your BU (read-only — created by the Subsidiary Admin).", group: "Organization & Access" },
  timelines: { title: "Reporting Timelines", description: "Project-level deadline assignments within policy.", group: "Report Operations" },
  submissions: { title: "Submission Center", description: "Expected, drafted and submitted reporting records across the BU.", group: "Report Operations" },
  monitoring: { title: "Report Monitoring", description: "Operational monitoring of BU reports — review decisions stay with the BU Manager.", group: "Report Operations" },
  evidence: { title: "Evidence & Documents", description: "BU evidence repository with versions, gaps and downloads.", group: "Report Operations" },
  tasks: { title: "Tasks & Deadlines", description: "Operational tasks, follow-ups and reminders across your BU.", group: "Coordination" },
  comms: { title: "Communication Center", description: "Announcements, reminders and role-group messages within your BU.", group: "Coordination" },
  validation: { title: "Data Validation", description: "Validation issues across the BU with corrective workflow.", group: "Reporting & Insights" },
  esg: { title: "ESG Reporting", description: "BU-level reporting package readiness and submission to the Subsidiary.", group: "Reporting & Insights" },
  analytics: { title: "ESG Analytics", description: "Interactive E, S and G analytics for your business unit.", group: "Reporting & Insights" },
  activity: { title: "Activity & Audit", description: "Operational activity feed and authoritative audit trail.", group: "Governance" },
  settings: { title: "Settings", description: "BU profile, notifications, reporting configuration and security.", group: "Configuration" },
};

export const VIEW_ORDER: { group: string; views: BaViewId[] }[] = [
  { group: "Overview", views: ["dashboard", "notifications"] },
  { group: "Organization & Access", views: ["users", "roles", "projects"] },
  { group: "Report Operations", views: ["timelines", "submissions", "monitoring", "evidence"] },
  { group: "Coordination", views: ["tasks", "comms"] },
  { group: "Reporting & Insights", views: ["validation", "esg", "analytics"] },
  { group: "Governance", views: ["activity"] },
  { group: "Configuration", views: ["settings"] },
];
