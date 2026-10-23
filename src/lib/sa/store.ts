"use client";

import { create } from "zustand";
import type { SaViewId } from "@/lib/sa/types";

export interface SaViewParams {
  detailId?: string;
  detailTab?: string;
  statusFilter?: string;
  level?: string;
  [key: string]: unknown;
}

export const REPORTING_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"] as const;

interface SaWorkspaceState {
  view: SaViewId;
  params: SaViewParams;
  reportingYear: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  unreadCount: number;
  lastSyncedAt: string | null;
  live: boolean;
  navigate: (view: SaViewId, params?: SaViewParams) => void;
  openDetail: (view: SaViewId, id: string, tab?: string) => void;
  setReportingYear: (y: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setUnreadCount: (n: number) => void;
  setLastSyncedAt: (iso: string) => void;
  setLive: (live: boolean) => void;
}

export const useSaWorkspace = create<SaWorkspaceState>((set) => ({
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

export const VIEW_META: Record<SaViewId, { title: string; description: string; group: string }> = {
  dashboard: { title: "Subsidiary Command Center", description: "Live overview of your subsidiary's reporting, organization and deadlines.", group: "Overview" },
  notifications: { title: "Notifications & Alerts", description: "Submissions, reviews, deadlines, validation and Group announcements.", group: "Overview" },
  units: { title: "Business Unit Management", description: "Create and manage the business units inside your subsidiary.", group: "Organization & Access" },
  projects: { title: "Project & Site Management", description: "Projects and sites under each business unit, with reporting owners.", group: "Organization & Access" },
  users: { title: "User Management", description: "Directory of subsidiary users with roles, scope and account controls.", group: "Organization & Access" },
  roles: { title: "Roles & Access", description: "Role definitions, effective permissions and assignment gaps.", group: "Organization & Access" },
  timelines: { title: "Reporting Timelines", description: "Deadline inheritance from subsidiary to BU to project, with overrides.", group: "Report Operations" },
  submissions: { title: "Submission Center", description: "Central register of all BU and project reporting records.", group: "Report Operations" },
  monitoring: { title: "Report Monitoring", description: "Operational view of BU and project reports — decisions stay with the Subsidiary Manager.", group: "Report Operations" },
  evidence: { title: "Evidence & Documents", description: "Central evidence repository with versions, gaps and downloads.", group: "Report Operations" },
  comms: { title: "Communication Center", description: "Announcements, reminders and role-group messages within your subsidiary.", group: "Report Operations" },
  esg: { title: "ESG Reporting", description: "Subsidiary consolidation, disclosure readiness and package submission to Group.", group: "Reporting & Insights" },
  validation: { title: "Data Validation", description: "Validation issues across the subsidiary with correction workflow.", group: "Reporting & Insights" },
  analytics: { title: "ESG Analytics", description: "Interactive E, S and G analytics for your subsidiary.", group: "Reporting & Insights" },
  activity: { title: "Activity & Audit", description: "Operational activity feed and authoritative audit trail.", group: "Governance" },
  settings: { title: "Settings", description: "Subsidiary profile, notifications, reporting configuration and security.", group: "Configuration" },
};

export const VIEW_ORDER: { group: string; views: SaViewId[] }[] = [
  { group: "Overview", views: ["dashboard", "notifications"] },
  { group: "Organization & Access", views: ["units", "projects", "users", "roles"] },
  { group: "Report Operations", views: ["timelines", "submissions", "monitoring", "evidence", "comms"] },
  { group: "Reporting & Insights", views: ["esg", "validation", "analytics"] },
  { group: "Governance", views: ["activity"] },
  { group: "Configuration", views: ["settings"] },
];
