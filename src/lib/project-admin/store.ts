/* ═══════════════════════════════════════════════════════════════════════════
   MEIL PROJECT COMMAND CENTER — ZUSTAND STORE
   Central client-side state for navigation, filters & project scope
   ═══════════════════════════════════════════════════════════════════════════ */

import { create } from "zustand";
import type { PaViewId, ContributorRole } from "./types";

export interface ViewMeta {
  id: PaViewId;
  label: string;
  section: "OVERVIEW" | "PEOPLE & OPERATIONS" | "ESG & REPORTING" | "WORKSPACE";
  badge?: string;
  description: string;
}

export const PA_VIEW_ORDER: { section: string; views: PaViewId[] }[] = [
  {
    section: "OVERVIEW",
    views: ["dashboard", "project-overview"],
  },
  {
    section: "PEOPLE & OPERATIONS",
    views: ["users", "categories", "tasks", "collection-status"],
  },
  {
    section: "ESG & REPORTING",
    views: ["approved-dataset", "evidence", "esg-summary", "consolidated-report", "submissions", "corrections"],
  },
  {
    section: "WORKSPACE",
    views: ["notifications", "settings"],
  },
];

export const PA_VIEW_META: Record<PaViewId, ViewMeta> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    section: "OVERVIEW",
    description: "Project Command Center executive summary & reporting health",
  },
  "project-overview": {
    id: "project-overview",
    label: "Project Overview",
    section: "OVERVIEW",
    description: "Detailed site information, boundaries & reporting configuration",
  },
  users: {
    id: "users",
    label: "User Management",
    section: "PEOPLE & OPERATIONS",
    description: "Manage 7 authorized contributor roles & site team assignments",
  },
  categories: {
    id: "categories",
    label: "Contributor Categories",
    section: "PEOPLE & OPERATIONS",
    description: "Monitor & coordinate the 7 ESG contributor functional areas",
  },
  tasks: {
    id: "tasks",
    label: "Task Assignments",
    section: "PEOPLE & OPERATIONS",
    description: "Assign reporting sections, deadlines & track delivery progress",
  },
  "collection-status": {
    id: "collection-status",
    label: "Data Collection Status",
    section: "PEOPLE & OPERATIONS",
    description: "Cross-category submission monitoring, completeness & overdue tracking",
  },
  evidence: {
    id: "evidence",
    label: "Evidence Repository",
    section: "ESG & REPORTING",
    description: "Audit-ready evidence files organized across the 7 categories",
  },
  "esg-summary": {
    id: "esg-summary",
    label: "Environmental & ESG Summary",
    section: "ESG & REPORTING",
    description: "Energy activity, automated GHG calculation engine & ESG metrics",
  },
  "consolidated-report": {
    id: "consolidated-report",
    label: "Consolidated Project Report",
    section: "ESG & REPORTING",
    badge: "Core",
    description: "Assemble 7 categories into 1 project report & submit to BU Manager",
  },
  "approved-dataset": {
    id: "approved-dataset",
    label: "Approved Dataset",
    section: "ESG & REPORTING",
    description: "Consolidated approved submissions ready for Business Unit handoff",
  },
  submissions: {
    id: "submissions",
    label: "Submission History",
    section: "ESG & REPORTING",
    description: "Immutable version ledger & historical BU Manager review audit",
  },
  corrections: {
    id: "corrections",
    label: "Review & Corrections",
    section: "ESG & REPORTING",
    description: "Coordinate BU Manager review remarks & contributor updates",
  },
  notifications: {
    id: "notifications",
    label: "Notifications",
    section: "WORKSPACE",
    description: "Real-time reporting alerts, deadlines & BU review updates",
  },
  settings: {
    id: "settings",
    label: "Profile & Settings",
    section: "WORKSPACE",
    description: "Project Admin preferences, credentials & accessibility options",
  },
};

export const CONTRIBUTOR_CATEGORIES: Record<ContributorRole, { name: string; label: string; color: string; desc: string }> = {
  ENV_DATA_USER: {
    name: "Environment Data User",
    label: "Environment",
    color: "#10B981",
    desc: "Energy, Water, GHG & Air, Waste, Environmental Initiatives",
  },
  FIN_RESOURCE_USER: {
    name: "Finance & Resource Contributor",
    label: "Finance",
    color: "#F59E0B",
    desc: "Financial Data, Resource Allocation, Environmental Capex & Opex",
  },
  HR_USER: {
    name: "HR User",
    label: "HR & Workforce",
    color: "#8B5CF6",
    desc: "Workforce Headcount, Diversity, Training & Employee Welfare",
  },
  EHS_USER: {
    name: "EHS / Safety User",
    label: "EHS & Safety",
    color: "#EF4444",
    desc: "Workplace Health & Safety, Incidents, LTIFR, Safety Audits",
  },
  PROCUREMENT_USER: {
    name: "Procurement User",
    label: "Procurement",
    color: "#06B6D4",
    desc: "Supply Chain, Local Sourcing, Sustainable Procurement",
  },
  CSR_USER: {
    name: "CSR / Community User",
    label: "CSR & Community",
    color: "#EC4899",
    desc: "Community Development, Social Projects, Beneficiaries, CSR Spend",
  },
  COMPLIANCE_USER: {
    name: "Compliance User",
    label: "Compliance",
    color: "#6366F1",
    desc: "Regulatory Approvals, Statutory Clearances, Legal Notices",
  },
};

interface PaStoreState {
  currentView: PaViewId;
  viewParams: Record<string, any>;
  financialYear: string;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  commandPaletteOpen: boolean;
  unreadNotificationsCount: number;

  navigate: (view: PaViewId, params?: Record<string, any>) => void;
  setFinancialYear: (year: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setUnreadNotificationsCount: (count: number) => void;
}

export const usePaStore = create<PaStoreState>((set) => ({
  currentView: "dashboard",
  viewParams: {},
  financialYear: "FY 2025-26",
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  commandPaletteOpen: false,
  unreadNotificationsCount: 3,

  navigate: (view, params = {}) => {
    set({
      currentView: view,
      viewParams: params,
      mobileMenuOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  setFinancialYear: (year) => set({ financialYear: year }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
}));

