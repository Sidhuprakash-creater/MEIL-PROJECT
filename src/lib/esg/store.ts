"use client";

import { create } from "zustand";
import type { ViewId } from "@/lib/esg/types";

export interface ViewParams {
  detailId?: string;
  detailTab?: string;
  statusFilter?: string;
  wizardStep?: number;
  wizardReportId?: string;
  [key: string]: unknown;
}

export const REPORTING_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"] as const;

interface WorkspaceState {
  view: ViewId;
  params: ViewParams;
  reportingYear: string;
  orgScope: string; // "GROUP" | subsidiaryId
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  unreadCount: number;
  navigate: (view: ViewId, params?: ViewParams) => void;
  openDetail: (view: ViewId, id: string, tab?: string) => void;
  setReportingYear: (y: string) => void;
  setOrgScope: (s: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setUnreadCount: (n: number) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  view: "dashboard",
  params: {},
  reportingYear: "FY 2025-26",
  orgScope: "GROUP",
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  unreadCount: 0,
  navigate: (view, params = {}) => {
    set({ view, params, mobileNavOpen: false, commandOpen: false });
  },
  openDetail: (view, id, tab) => {
    set({ view, params: { detailId: id, detailTab: tab }, mobileNavOpen: false });
  },
  setReportingYear: (reportingYear) => set({ reportingYear }),
  setOrgScope: (orgScope) => set({ orgScope }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}));

export const VIEW_META: Record<ViewId, { title: string; description: string; group: string }> = {
  dashboard: { title: "Group Command Center", description: "Consolidated overview of the organization, submissions, and ESG performance.", group: "Overview" },
  notifications: { title: "Notifications & Alerts", description: "Deadlines, overdue alerts, approvals, and system notifications.", group: "Overview" },
  hierarchy: { title: "Organization Hierarchy", description: "Group → Subsidiary → Business Unit → Project / Site structure.", group: "Organization" },
  subsidiaries: { title: "Subsidiary Management", description: "Create and manage subsidiaries, assign managers and admins.", group: "Organization" },
  units: { title: "Business Unit Management", description: "Manage business units within subsidiaries and their reporting scope.", group: "Organization" },
  projects: { title: "Project & Site Management", description: "Directory of projects and sites with reporting responsibilities.", group: "Organization" },
  users: { title: "All Users", description: "Complete user directory with roles, status, and assignments.", group: "People & Access" },
  roles: { title: "Roles & Permissions", description: "Permission matrix for the 11 defined role types.", group: "People & Access" },
  submissions: { title: "Submission Center", description: "Central register of all ESG data submissions.", group: "ESG Operations" },
  approvals: { title: "Review & Approvals", description: "Review queue with approve, reject, return, and reopen actions.", group: "ESG Operations" },
  tasks: { title: "Tasks & Deadlines", description: "Assign reporting tasks to users, roles, BUs, or subsidiaries.", group: "ESG Operations" },
  comms: { title: "Communication Center", description: "Announcements, reminders, and role-group communications.", group: "ESG Operations" },
  brsr: { title: "BRSR Reporting Center", description: "Create, review, sign-off, finalize, and export the consolidated BRSR report.", group: "BRSR Reporting" },
  brsrChecklist: { title: "BRSR Data Checklist", description: "Section-wise BRSR template data received from each subsidiary.", group: "BRSR Reporting" },
  consolidation: { title: "Data Consolidation & Validation", description: "Missing data, duplicates, anomalies, lineage, and aggregation.", group: "BRSR Reporting" },
  analytics: { title: "ESG Analytics", description: "Interactive E, S, and G performance dashboards.", group: "Insights & Governance" },
  activity: { title: "Activity Monitoring", description: "Chronological user activity feed across the organization.", group: "Insights & Governance" },
  audit: { title: "Audit Logs", description: "Authoritative, append-only audit trail of sensitive operations.", group: "Insights & Governance" },
  settings: { title: "Settings & Configuration", description: "Reporting periods, workflows, reminders, security, and integrations.", group: "Insights & Governance" },
};

export const VIEW_ORDER: { group: string; views: ViewId[] }[] = [
  { group: "Overview", views: ["dashboard", "notifications"] },
  { group: "Organization", views: ["hierarchy", "subsidiaries", "units", "projects"] },
  { group: "People & Access", views: ["users", "roles"] },
  { group: "ESG Operations", views: ["submissions", "approvals", "tasks", "comms"] },
  { group: "BRSR Reporting", views: ["brsr", "brsrChecklist", "consolidation"] },
  { group: "Insights & Governance", views: ["analytics", "activity", "audit", "settings"] },
];
