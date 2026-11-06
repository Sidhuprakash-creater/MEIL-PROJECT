/**
 * Role-aware navigation configuration.
 * Each role sees a different set of nav items, filtered by their permissions.
 * This makes the nav bar role-specific instead of showing all items to everyone.
 */
import {
  LayoutDashboard, Building2, FileText, Link2, Send, FileBarChart,
  TrendingUp, History, FileCheck2, Users, ShieldCheck,
  Package, HeartHandshake, Scale, BarChart3,
  FileSearch, Wrench, ShoppingCart, Wallet, MapPin, MessageCircle,
  AlertCircle, ClipboardList, Calendar, GraduationCap, HeartPulse, Leaf,
  Database, AlertTriangle, Gauge, Flame, Zap, GitBranch,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/lib/pu/auth-context'

export interface NavItem {
  key: ModuleKey
  label: string
  icon: LucideIcon
  badgeTone?: 'green' | 'blue' | 'amber' | 'rose'
}

// Role-specific navigation maps (per the master spec's role definitions)
const ROLE_NAV: Record<string, NavItem[]> = {
  // Environment Data User — data entry focused
  PROJECT_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'my-project', label: 'My Project', icon: Building2 },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'team', label: 'Team', icon: Users },
  ],

  // Finance & Resource Data Contributor — 8 dedicated tabs matching reference screenshot
  FINANCE_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'fin-assignments', label: 'My Assignments', icon: ClipboardList, badgeTone: 'blue' },
    { key: 'fin-data', label: 'Financial Data', icon: FileText, badgeTone: 'green' },
    { key: 'fin-expenditure', label: 'Resource Expenditure', icon: Leaf },
    { key: 'fin-evidence', label: 'Evidence & Documents', icon: Link2, badgeTone: 'blue' },
    { key: 'fin-submissions', label: 'My Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'fin-reports', label: 'Reports & Exports', icon: FileBarChart },
    { key: 'fin-activity', label: 'Activity Log', icon: History },
  ],

  // HR User — 7 HR-specific tabs (NOT generic tabs)
  HR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'hr-workforce', label: 'Workforce', icon: Users },
    { key: 'hr-training', label: 'Training & Dev', icon: GraduationCap },
    { key: 'hr-wellbeing', label: 'Wellbeing', icon: HeartPulse },
    { key: 'hr-rights', label: 'Human Rights', icon: Scale },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
  ],

  // EHS / Safety User — 12 EHS-specific tabs
  EHS_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'ehs-ops', label: 'Safety Operations', icon: ShieldCheck },
    { key: 'ehs-incidents', label: 'Incidents', icon: AlertTriangle },
    { key: 'ehs-inspections', label: 'Inspections', icon: FileSearch },
    { key: 'ehs-corrective', label: 'Corrective Actions', icon: Wrench },
    { key: 'ehs-environmental', label: 'Environmental', icon: Leaf },
    { key: 'ehs-training', label: 'Safety Training', icon: GraduationCap },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Procurement / Supply Chain User — 11 tabs
  PROCUREMENT_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'proc-suppliers', label: 'Suppliers', icon: Package },
    { key: 'proc-assessments', label: 'Assessments', icon: ClipboardCheck },
    { key: 'proc-sourcing', label: 'Sustainable Sourcing', icon: Leaf },
    { key: 'proc-transactions', label: 'Transactions', icon: ShoppingCart },
    { key: 'proc-valuechain', label: 'ESG / Value Chain', icon: GitBranch },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // CSR / Community User — 12 tabs
  CSR_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'csr-projects', label: 'CSR Projects', icon: HeartHandshake },
    { key: 'csr-budgets', label: 'Budgets & Spend', icon: Wallet },
    { key: 'csr-beneficiaries', label: 'Beneficiaries', icon: Users },
    { key: 'csr-impact', label: 'Impact Assessment', icon: BarChart3 },
    { key: 'csr-community', label: 'Community Engagement', icon: MessageCircle },
    { key: 'csr-local', label: 'Local Sourcing', icon: MapPin },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // Compliance / Governance User — 12 tabs
  COMPLIANCE_USER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'comp-policies', label: 'Policies', icon: FileCheck2 },
    { key: 'comp-obligations', label: 'Compliance Obligations', icon: ClipboardList },
    { key: 'comp-controls', label: 'Controls', icon: ShieldCheck },
    { key: 'comp-cases', label: 'Cases & Incidents', icon: AlertCircle },
    { key: 'comp-ethics', label: 'Ethics & Conduct', icon: Scale },
    { key: 'comp-calendar', label: 'Regulatory Calendar', icon: Calendar },
    { key: 'evidence', label: 'Evidence', icon: Link2, badgeTone: 'blue' },
    { key: 'submissions', label: 'Submissions', icon: Send, badgeTone: 'amber' },
    { key: 'brsr', label: 'BRSR Governance', icon: FileCheck2 },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],

  // ESG Analyst — 11 tabs
  ESG_ANALYST: [
    { key: 'overview', label: 'Analytics Overview', icon: LayoutDashboard },
    { key: 'ana-explorer', label: 'Data Explorer', icon: Database },
    { key: 'ana-metrics', label: 'ESG Metrics', icon: Gauge },
    { key: 'ana-emissions', label: 'Emissions Analysis', icon: Flame },
    { key: 'ana-energy', label: 'Energy & Resources', icon: Zap },
    { key: 'ana-social', label: 'Social Analytics', icon: Users },
    { key: 'ana-governance', label: 'Governance Analytics', icon: Scale },
    { key: 'ana-variance', label: 'Variance & Anomalies', icon: AlertTriangle },
    { key: 'ana-quality', label: 'Data Quality', icon: ShieldCheck },
    { key: 'audit', label: 'Audit', icon: History },
  ],

  // Project Admin — operational review & sign-off authority
  PROJECT_ADMIN: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'submissions', label: 'Submissions & Approvals', icon: Send, badgeTone: 'rose' },
    { key: 'data-entry', label: 'Data Entry', icon: FileText, badgeTone: 'green' },
    { key: 'my-project', label: 'My Project', icon: Building2 },
    { key: 'evidence', label: 'Evidence Vault', icon: Link2, badgeTone: 'blue' },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'audit', label: 'Audit & Trace', icon: History },
  ],
}

/** Minimal nav for roles without a dedicated map (add an entry above when a new role is introduced). */
const FALLBACK_NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
]

/** Get the nav items for a given role key. Falls back to Overview-only for unknown roles. */
export function getNavForRole(roleKey: string): NavItem[] {
  return ROLE_NAV[roleKey] ?? FALLBACK_NAV
}

/** Default nav for fallback (used in contexts where role isn't known yet) */
export const DEFAULT_NAV: NavItem[] = FALLBACK_NAV
